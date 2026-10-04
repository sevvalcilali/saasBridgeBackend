"""Sunucu ayarları. Öncelik: varsayılanlar < config.toml < komut satırı."""
import argparse
import tomllib
from collections.abc import Sequence
from dataclasses import dataclass, replace
from pathlib import Path

KAYNAKLAR = ("benzetim", "kayit", "seri")


@dataclass(frozen=True)
class Ayar:
    port: int = 8002
    host: str = "0.0.0.0"  # masa tableti ve salon ekranı başka cihazdan bağlanır (PLAN Bölüm 11)
    kaynak: str = "benzetim"
    dist: Path = Path("../SaasBridge/dist")
    veri: Path | None = None
    seri: str | None = None
    esik: float = -72
    # Etkinlik bilgisi (/state.event); varsayılanlar mock ile aynı.
    etkinlik_adi: str = "Yatırımcı Buluşması"
    alt_baslik: str = "Yakınlık kartları · sahte veri"
    tarih: str = "28.09.2026 · Demo Salonu"


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
    "esik": (_sayi, "sayı (dBm)"),
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


def _komut_satirindan(ayar: Ayar, argumanlar: Sequence[str] | None) -> Ayar:
    ayristirici = argparse.ArgumentParser(prog="python -m yakinlik", description="Yakınlık Takip Sistemi sunucusu")
    ayristirici.add_argument("--port", type=int, help="dinlenecek port")
    ayristirici.add_argument("--kaynak", choices=KAYNAKLAR, help="paket kaynağı")
    ayristirici.add_argument("--dist", type=Path, help="derlenmiş arayüz klasörü (SaasBridge/dist)")
    ayristirici.add_argument("--veri", type=Path, help="veri yolu")
    ayristirici.add_argument("--seri", help="alıcının seri aygıtı (ör. /dev/ttyUSB0, COM5)")
    verilen = {ad: deger for ad, deger in vars(ayristirici.parse_args(argumanlar)).items() if deger is not None}
    return replace(ayar, **verilen)
