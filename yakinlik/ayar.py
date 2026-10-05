"""Sunucu ayarları. Öncelik: varsayılanlar < config.toml < komut satırı."""
import argparse
import math
import tomllib
from collections.abc import Sequence
from dataclasses import dataclass, replace
from pathlib import Path

from .cekirdek.cift import ESIK_ARALIGI

KAYNAKLAR = ("benzetim", "kayit", "seri")


@dataclass(frozen=True)
class Ayar:
    port: int = 8002
    host: str = "0.0.0.0"  # masa tableti ve salon ekranı başka cihazdan bağlanır (PLAN Bölüm 11)
    kaynak: str = "benzetim"
    dist: Path = Path("../SaasBridge/dist")
    veri: Path | None = None  # kalıcı veri klasörü; verilmezse veri_klasoru() kuralı
    seri: str | None = None
    esik: float = -72
    # Etkinlik bilgisi (/state.event); varsayılanlar mock ile aynı.
    etkinlik_adi: str = "Yatırımcı Buluşması"
    alt_baslik: str = "Yakınlık kartları · sahte veri"
    tarih: str = "28.09.2026 · Demo Salonu"
    # Benzetim ve kayıt: yalnız komut satırından; adlar ve varsayılanlar mock'un bayraklarıyla aynı.
    kisi: int = 25
    hizlandir: float = 1
    kopma: bool = True
    kaydet: Path | None = None  # her tikin paketleri bu dosyaya yazılır
    iz: Path | None = None  # --kaynak kayit ile oynatılacak dosya
    anlasma_sn: float | None = None  # anlaşma bildirimini bu sürede zorla (rules.dealAfterS; mock'taki --anlasmaSn)
    yeni_etkinlik: bool = False  # eski veri yedeğe taşınır, boş başlanır (yalnız komut satırından)


def veri_klasoru(ayar: Ayar) -> Path | None:
    """Kalıcı veri klasörü (None: kalıcılık kapalı). Gerçek alıcıda (seri) varsayılan "veri": etkinlikte veri hep diske
    yazılır. Benzetim ve oynatma mock gibi her açılışta temiz başlar; denemek için --veri verilir."""
    if ayar.veri is not None:
        return ayar.veri
    return Path("veri") if ayar.kaynak == "seri" else None


def _tam_sayi(deger: object) -> bool:
    return isinstance(deger, int) and not isinstance(deger, bool)  # TOML'da true/false da int sayılmasın


def _sayi(deger: object) -> bool:
    return isinstance(deger, (int, float)) and not isinstance(deger, bool)


def _metin(deger: object) -> bool:
    return isinstance(deger, str) and deger != ""


# config.toml'un üst düzey anahtarı → (değer geçerli mi, iletide "ne olmalı")
_DENETIMLER = {
    "port": (lambda deger: _tam_sayi(deger) and 1 <= deger <= 65535, "1–65535 arası tam sayı"),
    "host": (_metin, "metin"),
    "kaynak": (lambda deger: deger in KAYNAKLAR, " | ".join(KAYNAKLAR)),
    "dist": (_metin, "metin (klasör yolu)"),
    "veri": (_metin, "metin (yol)"),
    "seri": (_metin, "metin (aygıt adı)"),
    "esik": (
        lambda deger: _sayi(deger) and ESIK_ARALIGI[0] <= deger <= ESIK_ARALIGI[1],
        f"{ESIK_ARALIGI[0]} ile {ESIK_ARALIGI[1]} arası sayı (dBm)",
    ),
}
# config.toml'daki [etkinlik] tablosunun anahtarı → Ayar alanı
_ETKINLIK_ALANLARI = {"ad": "etkinlik_adi", "alt_baslik": "alt_baslik", "tarih": "tarih"}
_YOL_ALANLARI = ("dist", "veri")


def ayar_yukle(argumanlar: Sequence[str] | None = None, config_yolu: Path = Path("config.toml")) -> Ayar:
    """Ayarları yükler; `argumanlar` verilmezse sys.argv okunur. Okunamayan ya da geçersiz config → ValueError."""
    ayar = Ayar()
    if config_yolu.exists():
        ayar = replace(ayar, **_configi_oku(config_yolu))
    return _komut_satirindan(ayar, argumanlar)


def _configi_oku(yol: Path) -> dict:
    """config.toml → Ayar alanları. Dosyayı organizatör elle düzenler: her hata dosyayı ve anahtarı söyler,
    yazım ya da tür hatası sessizce geçmez (yoksa sunucu yanlış ayarla açılır ve kimse fark etmez)."""
    try:
        config = tomllib.loads(yol.read_text(encoding="utf-8-sig"))  # -sig: Windows Not Defteri başa BOM koyabilir
    except UnicodeDecodeError as hata:
        raise ValueError(f"{yol}: dosya UTF-8 olarak kaydedilmeli") from hata
    except (OSError, tomllib.TOMLDecodeError) as hata:
        raise ValueError(f"{yol}: okunamadı ({hata})") from hata

    ust = {anahtar: deger for anahtar, deger in config.items() if anahtar != "etkinlik"}
    etkinlik = config.get("etkinlik", {})
    if not isinstance(etkinlik, dict):
        raise ValueError(f"{yol}: etkinlik bir tablo ([etkinlik]) olmalı, gelen: {etkinlik!r}")
    bilinmeyen = sorted(set(ust) - set(_DENETIMLER)) + sorted(
        f"etkinlik.{anahtar}" for anahtar in set(etkinlik) - set(_ETKINLIK_ALANLARI)
    )
    if bilinmeyen:
        raise ValueError(f"{yol}: bilinmeyen anahtar: {', '.join(bilinmeyen)}")
    for anahtar, deger in ust.items():
        gecerli, beklenen = _DENETIMLER[anahtar]
        if not gecerli(deger):
            raise ValueError(f"{yol}: {anahtar} {beklenen} olmalı, gelen: {deger!r}")
    for anahtar, deger in etkinlik.items():
        if not isinstance(deger, str):
            raise ValueError(f"{yol}: etkinlik.{anahtar} metin olmalı, gelen: {deger!r}")

    alanlar = {**ust, **{_ETKINLIK_ALANLARI[anahtar]: deger for anahtar, deger in etkinlik.items()}}
    for alan in _YOL_ALANLARI:
        if alan in alanlar:
            alanlar[alan] = Path(alanlar[alan])
    return alanlar


def _pozitif_tam(metin: str) -> int:
    deger = int(metin)
    if deger < 1:
        raise argparse.ArgumentTypeError("1 ya da daha büyük olmalı")
    return deger


def _pozitif_sayi(metin: str) -> float:
    deger = float(metin)
    if not (math.isfinite(deger) and deger > 0):
        raise argparse.ArgumentTypeError("0'dan büyük, sonlu bir sayı olmalı")
    return deger


def _komut_satirindan(ayar: Ayar, argumanlar: Sequence[str] | None) -> Ayar:
    ayristirici = argparse.ArgumentParser(prog="python -m yakinlik", description="Yakınlık Takip Sistemi sunucusu")
    ayristirici.add_argument("--port", type=int, help="dinlenecek port")
    ayristirici.add_argument("--kaynak", choices=KAYNAKLAR, help="paket kaynağı")
    ayristirici.add_argument("--dist", type=Path, help="derlenmiş arayüz klasörü (SaasBridge/dist)")
    ayristirici.add_argument("--veri", type=Path, help="kalıcı veri klasörü (gerçek alıcıda varsayılan: veri)")
    ayristirici.add_argument("--seri", help="alıcının seri aygıtı (ör. /dev/ttyUSB0, COM5)")
    ayristirici.add_argument("--kisi", type=_pozitif_tam, help="benzetimdeki kişi sayısı (en çok 97)")
    ayristirici.add_argument("--hizlandir", type=_pozitif_sayi, help="benzetim / oynatma zamanı çarpanı")
    ayristirici.add_argument("--kopma", type=int, choices=(0, 1), help="benzetimde alıcı kopması senaryosu (0: kapalı)")
    ayristirici.add_argument("--kaydet", type=Path, help="her tikin paketlerini bu dosyaya yaz (iz.jsonl)")
    ayristirici.add_argument("--iz", type=Path, help="--kaynak kayit ile oynatılacak iz dosyası")
    ayristirici.add_argument(
        "--anlasma-sn", dest="anlasma_sn", type=_pozitif_sayi, help="anlaşma bildirimini bu kadar sn birliktelikte zorla (deneme)"
    )
    ayristirici.add_argument(
        "--yeni-etkinlik", dest="yeni_etkinlik", action="store_true", default=None,
        help="eski veriyi yedek klasörüne taşı, yeni etkinliğe boş başla",
    )
    verilen = {ad: deger for ad, deger in vars(ayristirici.parse_args(argumanlar)).items() if deger is not None}
    if "kopma" in verilen:
        verilen["kopma"] = bool(verilen["kopma"])
    return replace(ayar, **verilen)
