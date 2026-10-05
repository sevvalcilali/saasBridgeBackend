"""Kalıcılık (PLAN Bölüm 9): alan modelinin kalıcı kısmı SQLite'ta (WAL). Okuma bellekten yapılır; disk yalnız açılışta
yükleme ve tik sonunda yazma içindir.

Yazılan yalnız değişenlerdir: diskteki hal bellekte de tutulur (ayna), yeni hal onunla karşılaştırılır, fark tek işlemde
yazılır. Ayna ancak işlem tamamlanınca güncellenir: yazım yarıda kalırsa (disk dolu) hiçbir şey "yazıldı" sayılmaz,
aynı fark sıradaki yazımda yeniden denenir. Bellek her zaman esastır.

Geri alınamayan işlemlerden önce doğrulanmış yedek: sıfırlamadan önce (motor) ve yeni etkinliğe geçerken (eski dosya
ancak yedeği doğrulanınca silinir). Her açılışta da yedek alınır; bunların en yenileri tutulur.
"""
import json
import logging
import sqlite3
import time
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from ..cekirdek.alan import Alan
from ..cekirdek.atama import AtamaKaydi
from ..cekirdek.bildirim import Bildirim
from ..cekirdek.kisi import Kisi, KisiDefteri
from ..cekirdek.oturum import Oturum

gunluk = logging.getLogger(__name__)

SURUM = 1  # şema sürümü (PRAGMA user_version)
DOSYA = "yakinlik.sqlite"
YEDEK_KLASORU = "yedek"
ACILIS_YEDEGI_SAKLA = 10  # açılış yedeklerinin en yenileri tutulur; sıfırlama ve yeni etkinlik yedekleri hiç silinmez
_SEMA = (Path(__file__).parent / "sema.sql").read_text(encoding="utf-8")

# tablo → (birincil anahtar sütunları, bütün sütunlar). Anahtar sütunları başta: satırın anahtarı satir[:len(anahtar)].
_TABLOLAR = {
    "kisi": (("sira",), ("sira", "kisi_id", "ad", "rol", "kurum", "yildiz", "renk", "notu", "kart", "ayrildi", "silindi")),
    "atama": (("id",), ("id", "t", "kisi_id", "kart", "islem")),
    "oturum": (("id",), ("id", "a", "b", "start_s", "end_s")),
    "kenar": (("a", "b"), ("a", "b", "dakika")),
    "toplam": (("kimlik",), ("kimlik", "sure", "karma")),
    "bildirim": (("id",), ("id", "t", "clock", "kind", "severity", "title", "detail", "people", "kisiler")),
    "anlasma": (("a", "b"), ("a", "b")),
    "ayar": (("anahtar",), ("anahtar", "deger")),
}

Tablolar = dict[str, dict[tuple, tuple]]  # tablo → {anahtar: satır}


def _baglan(yol: Path) -> sqlite3.Connection:
    """Dosyayı açar ve kilitler (ikinci bir sunucu aynı dosyaya yazamasın); yeni dosyada şemayı kurar, eskisinde sürümü
    denetler. Açılamıyorsa ValueError: sunucu açılmadan, anlaşılır iletiyle durur."""
    try:
        db = sqlite3.connect(yol, isolation_level=None, check_same_thread=False, timeout=0.2)
    except sqlite3.Error as hata:
        raise ValueError(f"veri dosyası açılamadı: {yol} ({hata})") from hata
    try:
        db.execute("PRAGMA locking_mode = EXCLUSIVE")  # kilit bağlantı kapanana dek bırakılmaz
        db.execute("PRAGMA journal_mode = WAL")
        db.execute("PRAGMA synchronous = NORMAL")  # süreç ölse de kayıp yok; yalnız elektrik kesilirse son tikler
        db.execute("BEGIN IMMEDIATE")  # kilidi şimdi al: dosya başka sunucudaysa burada anlaşılır
        surum = db.execute("PRAGMA user_version").fetchone()[0]
        tablo_sayisi = db.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0]
        db.execute("COMMIT")
        if surum == 0 and tablo_sayisi == 0:
            db.executescript(f"BEGIN IMMEDIATE;\n{_SEMA}\nPRAGMA user_version = {SURUM};\nCOMMIT;")
        elif surum == 0:
            raise ValueError(f"veri dosyası bu sunucuya ait değil: {yol}")
        elif surum > SURUM:
            raise ValueError(f"veri dosyası daha yeni bir sürümle yazılmış (sürüm {surum}): {yol}")
    except sqlite3.Error as hata:
        db.close()
        if hata.sqlite_errorname in ("SQLITE_BUSY", "SQLITE_LOCKED"):
            raise ValueError(f"veri dosyası başka bir sunucu tarafından kullanılıyor: {yol}") from hata
        raise ValueError(f"veri dosyası okunamadı: {yol} ({hata})") from hata
    except BaseException:
        db.close()
        raise
    return db


def _yedek_yolu(klasor: Path, neden: str, simdi: float) -> Path:
    klasor.mkdir(parents=True, exist_ok=True)
    ad = f"yakinlik-{neden}-{time.strftime('%Y%m%d-%H%M%S', time.localtime(simdi))}"
    yol, sira = klasor / f"{ad}.sqlite", 1
    while yol.exists():  # aynı saniyede ikinci yedek öncekini ezmez
        sira += 1
        yol = klasor / f"{ad}_{sira}.sqlite"
    return yol


def _yedegi_dogrula(yol: Path) -> None:
    db = sqlite3.connect(yol)
    try:
        sonuc = db.execute("PRAGMA quick_check").fetchone()[0]
        surum = db.execute("PRAGMA user_version").fetchone()[0]
    finally:
        db.close()
    if sonuc != "ok" or surum != SURUM:
        raise ValueError(f"yedek doğrulanamadı: {yol} ({sonuc}, sürüm {surum})")


def _kopyala(kaynak: sqlite3.Connection, hedef: Path) -> Path:
    """Tutarlı kopya (yazılmamış WAL sayfaları dahil) → tek başına taşınabilir dosya; doğrulanmadan dönmez."""
    try:
        db = sqlite3.connect(hedef)
        try:
            kaynak.backup(db)
            db.execute("PRAGMA journal_mode = DELETE")  # yedek tek dosya olsun (-wal'siz)
        finally:
            db.close()
        _yedegi_dogrula(hedef)
    except BaseException:
        hedef.unlink(missing_ok=True)  # yarım ya da bozuk yedek kalmasın
        raise
    return hedef


def _arsivle(yol: Path, simdi: float) -> Path:
    """Yeni etkinlik: eski veri doğrulanmış bir yedeğe kopyalanır, ancak ondan sonra eski dosya silinir."""
    db = _baglan(yol)  # kilit: dosya başka bir sunucudaysa dokunulmaz
    try:
        arsiv = _kopyala(db, _yedek_yolu(yol.parent / YEDEK_KLASORU, "yeni-etkinlik", simdi))
    finally:
        db.close()
    for ek in ("", "-wal", "-shm"):
        Path(f"{yol}{ek}").unlink(missing_ok=True)
    return arsiv


def _satirlar(alan: Alan, simdi: float, onceki_kisiler: Mapping[tuple, tuple]) -> Tablolar:
    """Bellekteki alan → tablo satırları (diskteki hal bununla aynı olmalı)."""
    kisi: dict[tuple, tuple] = {}
    for k in alan.defter.kisiler():
        sira = int(k.kisi_id.removeprefix("k"))
        kisi[(sira,)] = (sira, k.kisi_id, k.ad, k.rol, k.kurum, k.yildiz, k.renk, k.notu, k.atanan_kart, int(k.ayrildi), 0)
    for anahtar, satir in onceki_kisiler.items():
        if anahtar not in kisi:  # listeden çıkarılan kişi: satırı ve kimliği kalır, silindi işaretlenir
            kisi[anahtar] = (*satir[:8], None, satir[9], 1)
    sure, karma = alan.kenarlar.sure, alan.kenarlar.karma
    ayar = {
        "esik": alan.esik, "gecen_sn": alan.gecen_sn, "son_duvar": simdi, "biten": alan.biten,
        "emekli_sayac": alan.emekli_sayac, "kisi_sayac": alan.defter.sayac,
    }
    return {
        "kisi": kisi,
        "atama": {(i,): (i, k.t, k.kisi_id, k.kart, k.islem) for i, k in enumerate(alan.atama_gecmisi, 1)},
        "oturum": {(i,): (i, o.a, o.b, o.start, o.end) for i, o in enumerate(alan.oturumlar, 1)},
        "kenar": {(a, b): (a, b, dakika) for (a, b), dakika in alan.kenarlar.dakika.items()},
        "toplam": {(kimlik,): (kimlik, sure.get(kimlik), karma.get(kimlik)) for kimlik in sure.keys() | karma.keys()},
        "bildirim": {
            (i,): (i, b.t, b.clock, b.kind, b.severity, b.title, b.detail,
                   json.dumps(b.people, ensure_ascii=False), json.dumps(b.kisiler, ensure_ascii=False))
            for i, b in enumerate(alan.bildirimler, 1)
        },
        "anlasma": {cift: cift for cift in alan.anlasmalar},
        "ayar": {(anahtar,): (anahtar, json.dumps(deger)) for anahtar, deger in ayar.items()},
    }


@dataclass(frozen=True)
class Kalici:
    """Diskten yüklenen alan. Yarıda kalmış görüşmeler son yazılan anda kapanmış, biten sayılmış olarak gelir: kapalı
    kalınan süre görüşmeye yazılmaz, kayıt toplamı kenar dakikasına eşit kalır (PLAN 5.2 madde 4)."""

    tablolar: Tablolar
    devam_sn: float  # etkinlik saatinin süreceği değer: son yazılan + kapalı kalınan süre (PLAN Bölüm 6)

    def alan(self, anlasma_sn: float | None = None, baslangic: float | None = None) -> Alan:
        """Her çağrıda yeni nesnelerle kurulmuş alan (`baslangic`: kaynak saatinin şimdiki değeri, biliniyorsa)."""
        t = self.tablolar
        ayar = {anahtar: json.loads(deger) for (anahtar,), (_, deger) in t["ayar"].items()}
        kisiler, sayac = [], ayar["kisi_sayac"]
        for sira, kisi_id, ad, rol, kurum, yildiz, renk, notu, kart, ayrildi, silindi in _sirali(t["kisi"]):
            sayac = max(sayac, sira)  # kimlik, silinen kişininki de, yeniden kullanılmaz
            if not silindi:
                kisiler.append(Kisi(kisi_id, ad, rol, kurum, yildiz, renk, atanan_kart=kart, notu=notu,
                                    ayrildi=bool(ayrildi)))
        alan = Alan(KisiDefteri.geri_yukle(kisiler, sayac), esik=ayar["esik"], anlasma_sn=anlasma_sn,
                    baslangic=baslangic, gecen=self.devam_sn)
        son = ayar["gecen_sn"]
        alan.oturumlar = [Oturum(a, b, bas, son if bit is None else bit) for _, a, b, bas, bit in _sirali(t["oturum"])]
        alan.biten = ayar["biten"] + sum(1 for satir in t["oturum"].values() if satir[4] is None)
        alan.emekli_sayac = ayar["emekli_sayac"]
        alan.kenarlar.dakika = {(a, b): dakika for a, b, dakika in t["kenar"].values()}
        alan.kenarlar.sure = {kimlik: sure for kimlik, sure, _ in t["toplam"].values() if sure is not None}
        alan.kenarlar.karma = {kimlik: karma for kimlik, _, karma in t["toplam"].values() if karma is not None}
        alan.bildirimler = [
            Bildirim(zaman, saat, tur, derece, baslik, ayrinti, tuple(json.loads(kartlar)), tuple(json.loads(kimlikler)))
            for _, zaman, saat, tur, derece, baslik, ayrinti, kartlar, kimlikler in _sirali(t["bildirim"])
        ]
        alan.anlasmalar = set(t["anlasma"])
        alan.atama_gecmisi = [AtamaKaydi(zaman, kisi_id, kart, islem) for _, zaman, kisi_id, kart, islem
                              in _sirali(t["atama"])]
        return alan


def _sirali(tablo: Mapping[tuple, tuple]) -> list[tuple]:
    return [tablo[anahtar] for anahtar in sorted(tablo)]


class Depo:
    def __init__(self, db: sqlite3.Connection, yol: Path) -> None:
        self._db = db
        self.yol = yol
        self._ayna = self._oku()  # diskteki hal

    @classmethod
    def ac(cls, klasor: Path, simdi: float, yeni_etkinlik: bool = False) -> "Depo":
        """`klasor`daki veri dosyasını açar (yoksa kurar). Var olan dosyanın önce yedeği alınır. `yeni_etkinlik`: eski
        veri yedeğe taşınır, boş başlanır. Açılamıyorsa ValueError."""
        try:
            klasor.mkdir(parents=True, exist_ok=True)
        except OSError as hata:
            raise ValueError(f"veri klasörü açılamadı: {klasor} ({hata})") from hata
        yol = klasor / DOSYA
        if yeni_etkinlik and yol.exists():
            try:
                _arsivle(yol, simdi)
            except (OSError, sqlite3.Error) as hata:
                raise ValueError(f"yeni etkinlik: eski veri yedek klasörüne taşınamadı ({hata})") from hata
        vardi = yol.exists()
        depo = cls(_baglan(yol), yol)
        if vardi:
            # Açılış yedeği kolaylıktır: alınamadı diye (disk dolu, klasör yazılamaz) sunucu açılmamazlık etmez.
            try:
                depo.yedekle("acilis", simdi)
                acilis = sorted(klasor.joinpath(YEDEK_KLASORU).glob("yakinlik-acilis-*.sqlite"))
                for eski in acilis[:-ACILIS_YEDEGI_SAKLA]:
                    eski.unlink(missing_ok=True)
            except (OSError, sqlite3.Error, ValueError):
                gunluk.exception("açılış yedeği alınamadı; sunucu yedeksiz açılıyor")
        return depo

    def _oku(self) -> Tablolar:
        tablolar = {}
        for tablo, (anahtar, sutunlar) in _TABLOLAR.items():
            uzunluk = len(anahtar)
            satirlar = self._db.execute(f"SELECT {', '.join(sutunlar)} FROM {tablo}")
            tablolar[tablo] = {satir[:uzunluk]: satir for satir in satirlar}
        return tablolar

    def yukle(self, simdi: float) -> Kalici | None:
        """Diskteki veri; dosyaya hiç yazılmamışsa None."""
        ayar = self._ayna["ayar"]
        if ("gecen_sn",) not in ayar:
            return None
        gecen = json.loads(ayar[("gecen_sn",)][1])
        son_duvar = json.loads(ayar[("son_duvar",)][1])
        return Kalici(self._ayna, devam_sn=gecen + max(0.0, simdi - son_duvar))

    def yaz(self, alan: Alan, simdi: float) -> int:
        """Bellekle disk arasındaki farkı tek işlemde yazar; yazılan (eklenen, değişen, silinen) satır sayısını döndürür.
        Yazılamazsa hata fırlatır ve hiçbir şeyi yazılmış saymaz (sıradaki çağrı aynı farkı yeniden dener)."""
        yeni = _satirlar(alan, simdi, self._ayna["kisi"])
        farklar = {}
        for tablo, satirlar in yeni.items():
            eski = self._ayna[tablo]
            yazilacak = [satir for anahtar, satir in satirlar.items() if eski.get(anahtar) != satir]
            silinecek = [anahtar for anahtar in eski if anahtar not in satirlar]
            if yazilacak or silinecek:
                farklar[tablo] = (yazilacak, silinecek)
        if not farklar:
            return 0
        self._db.execute("BEGIN IMMEDIATE")
        try:
            for tablo, (yazilacak, silinecek) in farklar.items():
                anahtar, sutunlar = _TABLOLAR[tablo]
                if silinecek:
                    kosul = " AND ".join(f"{sutun} = ?" for sutun in anahtar)
                    self._db.executemany(f"DELETE FROM {tablo} WHERE {kosul}", silinecek)
                if yazilacak:
                    yer = ", ".join("?" * len(sutunlar))
                    self._db.executemany(f"INSERT OR REPLACE INTO {tablo} ({', '.join(sutunlar)}) VALUES ({yer})",
                                         yazilacak)
            self._db.execute("COMMIT")
        except BaseException:
            if self._db.in_transaction:
                self._db.execute("ROLLBACK")
            raise
        self._ayna = yeni  # ancak işlem tamamlanınca
        return sum(len(yazilacak) + len(silinecek) for yazilacak, silinecek in farklar.values())

    def yedekle(self, neden: str, simdi: float) -> Path:
        """Diskteki halin doğrulanmış kopyası (`yedek/yakinlik-<neden>-<zaman>.sqlite`). Belleğin son hali için önce
        `yaz`. Alınamazsa hata fırlatır, yarım dosya bırakmaz."""
        return _kopyala(self._db, _yedek_yolu(self.yol.parent / YEDEK_KLASORU, neden, simdi))

    def kapat(self) -> None:
        self._db.close()
