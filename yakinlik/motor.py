"""Olay döngüsü (PLAN B2.4): kaynaktan tik → alan → durum bir kez üretilir, JSON'a bir kez çevrilir → bütün izleyicilere
aynı baytlar.

Alan durumunu yalnız burası değiştirir (İ3). Tik işleme hiç `await` içermez: HTTP işleyicilerinin çağırdığı komutlar
(eşik, sıfırla) aynı olay döngüsünde iki tik arasında uygulanır, yarış olmaz.
"""
import asyncio
import json
import logging
from collections.abc import Awaitable, Callable, Mapping
from contextlib import aclosing

from .ayar import Ayar
from .cekirdek import atama
from .cekirdek.alan import Alan
from .cekirdek.csv_ice import AktarmaSonucu, iceri_aktar
from .cekirdek.durum import Etkinlik, durum_uret, kartlar_uret
from .cekirdek.kisi import Kisi, KisiDefteri
from .giris.kaynak import TIK_SN, PaketKaynagi, Tik
from .giris.olustur import kaynak_olustur
from .saat import GercekSaat, Saat

gunluk = logging.getLogger(__name__)

EN_COK_BEKLEYEN = 5  # bu kadar mesaj birikirse izleyici yetişemiyor sayılır, bağlantısı kapatılır (yeniden bağlanır)


class Abone:
    """Bir canlı akış (SSE) izleyicisi: sırasını bekleyen mesajlar."""

    def __init__(self) -> None:
        self._kuyruk: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=EN_COK_BEKLEYEN)
        self.kapandi = False

    def ver(self, veri: bytes) -> bool:
        try:
            self._kuyruk.put_nowait(veri)
        except asyncio.QueueFull:
            return False
        return True

    def kapat(self) -> None:
        self.kapandi = True
        while not self._kuyruk.empty():
            self._kuyruk.get_nowait()
        self._kuyruk.put_nowait(None)

    async def al(self) -> bytes | None:
        """Sıradaki mesaj; akış kapatıldıysa None."""
        return await self._kuyruk.get()

    def bekleyen(self) -> list[bytes]:
        """Bekleyen mesajları alır (testler ve tanılama için)."""
        mesajlar = []
        while not self._kuyruk.empty():
            veri = self._kuyruk.get_nowait()
            if veri is not None:
                mesajlar.append(veri)
        return mesajlar


class Motor:
    def __init__(
        self,
        kaynak: PaketKaynagi,
        alan: Alan,
        etkinlik: Etkinlik,
        saat: Saat | None = None,
        bekle: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._kaynak = kaynak
        self._alan = alan
        self._etkinlik = etkinlik
        self._saat = saat or GercekSaat()
        self._bekle = bekle
        self._aboneler: set[Abone] = set()
        self.anlik = self._uret()  # son durum, JSON baytları (GET /state bunu verir)

    @classmethod
    def ayardan(cls, ayar: Ayar, bekle: Callable[[float], Awaitable[None]] = asyncio.sleep) -> "Motor":
        """Ayarlardan kaynak, kayıt defteri ve alanı kurar. Kaynak kurulamıyorsa ValueError (sunucu açılmadan)."""
        kaynak = kaynak_olustur(ayar, bekle=bekle)
        benzetim = kaynak.benzetim
        # Benzetimde kayıt defteri sahte kadrodan kurulur (16.3 madde 6 kararı); diğer kaynaklarda boş (B3'te dolar).
        defter = KisiDefteri.kadrodan(benzetim.kadro) if benzetim else KisiDefteri()
        alan = Alan(defter, esik=ayar.esik, anlasma_sn=ayar.anlasma_sn, baslangic=benzetim.sim_sn if benzetim else None)
        return cls(kaynak, alan, Etkinlik(ayar.etkinlik_adi, ayar.alt_baslik, ayar.tarih), bekle=bekle)

    async def calis(self) -> None:
        """Kaynağın tiklerini işler. Kaynak biterse ya da hata verirse yayın boş tiklerle sürer (İ6): zaman ve
        alıcı yaşı ilerler, veri donar; arayüz "ALICI BAĞLI DEĞİL" gösterir, "bağlanılamıyor" göstermez.
        `isle` hiç hata fırlatmaz: buradaki `except` yalnız kaynağın kendi hatasını yakalar."""
        try:
            async with aclosing(self._kaynak.tikler()) as akis:
                async for tik in akis:
                    self.isle(tik)
            gunluk.warning("paket kaynağı bitti; yayın verisiz sürüyor")
        except Exception:
            gunluk.exception("paket kaynağı hata verdi; yayın verisiz sürüyor")
        while True:
            await self._bekle(TIK_SN)
            self.isle(Tik((self._alan.t or 0.0) + TIK_SN, ()))

    def isle(self, tik: Tik) -> None:
        """Bir tiki işleyip yayınlar. Hata fırlatmaz: tek bozuk tik ne kaynağı ne de yayını düşürür."""
        try:
            self._alan.tik(tik, self._saat.simdi())
        except Exception:
            gunluk.exception("tik işlenemedi (t=%s); yayın sürüyor", tik.t)
        self._yayinla()

    # --- karşılama masası (B3): kayıt defteri ve kart hareketleri; değişiklik /state'te hemen görünür ---

    @property
    def defter(self) -> KisiDefteri:
        return self._alan.defter

    def kisi_ekle(self, alanlar: Mapping[str, object]) -> Kisi:
        """Kartsız yeni kişi (panoda görünmez, durum değişmez)."""
        return self.defter.ekle(ad=alanlar.get("ad"), rol=alanlar.get("rol"), kurum=alanlar.get("kurum"),
                                yildiz=alanlar.get("yildiz"), notu=alanlar.get("not"))

    def kisi_guncelle(self, kisi_id: str, alanlar: Mapping[str, object]) -> Kisi | None:
        kisi = self.defter.guncelle(kisi_id, alanlar)
        if kisi is not None and kisi.atanan_kart is not None:
            self._guncelle()  # kartı varsa panodaki adı / rolü hemen değişsin
        return kisi

    def kisi_sil(self, kisi_id: str) -> bool:
        """Kişiyi listeden çıkarır; kartı varsa önce iade edilir. Süreleri silinmez (Soru 4 varsayılanı)."""
        kisi = self.defter.kisi(kisi_id)
        if kisi is None:
            return False
        if kisi.atanan_kart is not None:
            self.iade(kisi.atanan_kart, ayrildi=True)
        self.defter.sil(kisi_id)
        return True

    def iceri_aktar(self, metin: str) -> AktarmaSonucu:
        return iceri_aktar(self.defter, metin)

    def ata(self, kisi_id: str, kart: str) -> bool:
        """Kartı kişiye verir; kişi yoksa False."""
        if self.defter.kisi(kisi_id) is None:
            return False
        self._benzetime_bildir(atama.ata(self._alan, kisi_id, kart, self._saat.simdi()))
        self._guncelle()
        return True

    def iade(self, kart: str, ayrildi: bool) -> None:
        self._benzetime_bildir(atama.iade(self._alan, kart, ayrildi, self._saat.simdi()))
        self._guncelle()

    def kartlar(self) -> list[dict]:
        """Alıcının duyduğu kartlar (GET /api/cards)."""
        return kartlar_uret(self._alan)

    def kart_biliniyor(self, kart: str) -> bool:
        """Kart bir kişide mi ya da alıcı onu hiç duydu mu? Hiç bilinmeyen kart masaya hayalet olarak eklenmesin."""
        return self.defter.kart_sahibi(kart) is not None or self._alan.sinyal.duyuldu_mu(kart)

    def _benzetime_bildir(self, hareket: atama.KartHareketi) -> None:
        """Benzetimde masa kart verip iade ettikçe sahte kartlar salona girer / çıkar (16.3 madde 6 kararı)."""
        benzetim = self._kaynak.benzetim
        if benzetim is None:
            return
        for kart, masaya in hareket.cikan:
            benzetim.kart_al(kart, masaya)
        for kart, rol in hareket.giren:
            benzetim.kart_ver(kart, rol)

    def esik_ayarla(self, dbm: float) -> None:
        self._alan.esik = dbm
        self._guncelle()  # GET /state hemen yeni eşiği görsün; izleyicilere sıradaki tikte gider

    def sifirla(self) -> None:
        self._alan.sifirla()
        self._guncelle()

    def abone_ol(self) -> Abone:
        abone = Abone()
        self._aboneler.add(abone)
        return abone

    def ayril(self, abone: Abone) -> None:
        self._aboneler.discard(abone)

    def _uret(self) -> bytes:
        durum = durum_uret(self._alan, self._etkinlik, self._saat.simdi())
        return json.dumps(durum, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    def _guncelle(self) -> None:
        """Son durumu yeniden üretir; üretilemezse öncekini tutar (izleyiciler son geçerli durumu almaya devam eder)."""
        try:
            self.anlik = self._uret()
        except Exception:
            gunluk.exception("durum üretilemedi; son geçerli durum gönderiliyor")

    def _yayinla(self) -> None:
        self._guncelle()
        for abone in list(self._aboneler):
            if not abone.ver(self.anlik):
                gunluk.warning("canlı akış izleyicisi yetişemiyor; bağlantısı kapatıldı")
                abone.kapat()
                self._aboneler.discard(abone)
