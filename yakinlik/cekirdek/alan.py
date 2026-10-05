"""Alan modeli: bir tikte sinyal → çift kararı → görüşme süreleri → bildirimler (PLAN Bölüm 4, [3]–[5]). Saf.

Zaman tikten okunur (kaynak saati); bildirimlerin zamanı için duvar saati dışarıdan verilir. Kurallar mock'un
`tik()` işleviyle aynı sırada işler; farklar PLAN Bölüm 7 ve 16.3 kararlarıdır (60 sn giriş, ortanca ile karar).
"""
from ..giris.kaynak import Tik
from . import bildirim
from .bildirim import Bildirim
from .cift import CiftDurumu, Gecis, ilerlet
from .kenar import Kenarlar, kimlik_cifti
from .kisi import Kisi, KisiDefteri, kisisiz_kart
from .sinyal import SinyalDeposu


class Alan:
    def __init__(
        self,
        defter: KisiDefteri,
        esik: float = -72.0,
        anlasma_sn: float | None = None,
        baslangic: float | None = None,
    ) -> None:
        """`baslangic`: kaynak saatinin etkinlik başındaki değeri (benzetimde 0); bilinmiyorsa ilk tik başlangıç olur."""
        self.defter = defter
        self.esik = esik
        self.anlasma_sn = anlasma_sn  # verilirse anlaşma bu sürede düşer, rol aranmaz (rules.dealAfterS)
        self.sinyal = SinyalDeposu()
        self.t = baslangic  # son tikin anı (kaynak saati)
        self._baz = baslangic  # etkinlik saatinin başladığı an (sıfırlamada yenilenir)
        self._durumu_temizle()

    def _durumu_temizle(self) -> None:
        self._ciftler: dict[str, CiftDurumu] = {}  # çift anahtarı ("2-3") → karar durumu
        self.kenarlar = Kenarlar()
        self.bildirimler: list[Bildirim] = []
        self.anlasmalar: set[tuple[str, str]] = set()  # anlaşma çıkmış kimlik çiftleri
        self.biten = 0  # biten görüşme sayısı
        self._bosta: dict[str, float] = {}  # kimlik → kesintisiz boşta saniye
        self._yalniz_bildirildi: set[str] = set()  # kimlik
        self._kayip_bildirildi: set[str] = set()  # kart

    @property
    def gecen_sn(self) -> float:
        """Etkinlik saati (`elapsed`): son sıfırlamadan bu yana geçen kaynak saniyesi."""
        return 0.0 if self.t is None else self.t - self._baz

    def sifirla(self) -> None:
        """Süreler, kenarlar, bildirimler, anlaşmalar ve sayaçlar silinir; kişiler, eşik ve ölçümler kalır."""
        self._durumu_temizle()
        self._baz = self.t

    def tik(self, tik: Tik, duvar: float) -> None:
        if self._baz is None:
            self._baz = tik.t
        dt = 0.0 if self.t is None else tik.t - self.t
        self.t = tik.t
        if not tik.paketler:
            return  # alıcı kopuk: ölçüm yok, sayaçlar donar; saat ve görülme yaşları ilerler
        self.sinyal.ekle(tik.paketler)
        self._ciftleri_isle(dt, duvar)
        self._kisileri_isle(dt, duvar)
        self.sinyal.unut(self.t, korunan=set(self.birlikte_ciftler()))

    def kisi(self, kart: str) -> Kisi:
        return self.defter.kart_sahibi(kart) or kisisiz_kart(kart)

    def birlikte_ciftler(self) -> dict[str, CiftDurumu]:
        return {anahtar: durum for anahtar, durum in self._ciftler.items() if durum.birlikte}

    def sahnedeki_kartlar(self) -> list[str]:
        """Panoda görünen kartlar: kişiye atanmış kartlar, sonra ilk görüşmesini yapmış atanmamış kartlar (R7)."""
        atanmis = [kisi.atanan_kart for kisi in self.defter.kisiler() if kisi.atanan_kart]
        gorusmus = {kimlik.removeprefix("kart:") for kimlik in self.kenarlar.sure if kimlik.startswith("kart:")}
        return atanmis + sorted(gorusmus - set(atanmis), key=int)

    def bosta_sn(self, kart: str) -> float:
        """Kişinin kesintisiz kimseyle görüşmeden ve görünür halde geçirdiği süre (people[].idleSinceS)."""
        return self._bosta.get(self.defter.kimlik(kart), 0.0)

    def _ciftleri_isle(self, dt: float, duvar: float) -> None:
        duyulan = {f"{sinyal.a}-{sinyal.b}": sinyal for sinyal in self.sinyal.sinyaller(self.t)}
        anahtarlar = list(duyulan) + [anahtar for anahtar in self._ciftler if anahtar not in duyulan]
        for anahtar in anahtarlar:
            durum = self._ciftler.setdefault(anahtar, CiftDurumu())
            sinyal = duyulan.get(anahtar)
            ustunde = sinyal is not None and sinyal.value >= self.esik  # duyulmayan çift eşik altında sayılır
            gecis, eklenen_sn = ilerlet(durum, ustunde, dt)
            kart_a, kart_b = anahtar.split("-")
            kisi_a, kisi_b = self.kisi(kart_a), self.kisi(kart_b)
            cift = kimlik_cifti(kisi_a.kisi_id, kisi_b.kisi_id)
            if gecis is Gecis.BASLADI and cift in self.anlasmalar:
                self.bildirimler.append(bildirim.tekrar(duvar, kisi_a, kisi_b, kart_a, kart_b))
            if eklenen_sn:
                self.kenarlar.ekle(kisi_a.kisi_id, kisi_b.kisi_id, eklenen_sn / 60, bildirim.karsi_rol(kisi_a, kisi_b))
                gereken = bildirim.anlasma_suresi_sn(kisi_a, kisi_b, self.anlasma_sn)
                if cift not in self.anlasmalar and gereken is not None and durum.birlikte_sn >= gereken:
                    self.anlasmalar.add(cift)
                    self.bildirimler.append(bildirim.anlasma(duvar, kisi_a, kisi_b, kart_a, kart_b, durum.birlikte_sn))
            if gecis is Gecis.BITTI:
                self.biten += 1
            if not durum.birlikte and durum.ustunde_sn == 0:
                del self._ciftler[anahtar]  # ne birlikte ne eşik üstünde: tutacak bilgi yok

    def _kisileri_isle(self, dt: float, duvar: float) -> None:
        birlikte_kartlar = {kart for anahtar in self.birlikte_ciftler() for kart in anahtar.split("-")}
        for kart in self.sahnedeki_kartlar():
            kisi = self.kisi(kart)
            yas = self.sinyal.gorulme_yasi(kart, self.t)
            if yas is not None and yas >= bildirim.KAYIP_SN:
                if kart not in self._kayip_bildirildi:
                    self._kayip_bildirildi.add(kart)
                    self.bildirimler.append(bildirim.kayip(duvar, kisi, kart))
            else:
                self._kayip_bildirildi.discard(kart)  # yeniden duyuldu: bir dahaki susuşta yine bildirilir
            if kart in birlikte_kartlar or yas is None or yas >= bildirim.GORUNUR_SN:
                self._bosta[kisi.kisi_id] = 0.0
                self._yalniz_bildirildi.discard(kisi.kisi_id)
                continue
            self._bosta[kisi.kisi_id] = self._bosta.get(kisi.kisi_id, 0.0) + dt
            onemli = kisi.rol == "investor" and kisi.yildiz >= bildirim.YALNIZ_EN_AZ_YILDIZ
            if onemli and self._bosta[kisi.kisi_id] >= bildirim.YALNIZ_SN and kisi.kisi_id not in self._yalniz_bildirildi:
                self._yalniz_bildirildi.add(kisi.kisi_id)
                self.bildirimler.append(bildirim.yalniz(duvar, kisi, kart))
