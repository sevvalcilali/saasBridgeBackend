"""Sunucu ayarları. Öncelik: varsayılanlar < config.toml < komut satırı."""
import argparse
import tomllib
from collections.abc import Sequence
from dataclasses import dataclass, fields, replace
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


# config.toml'daki [etkinlik] tablosunun anahtarı → Ayar alanı
_ETKINLIK_ALANLARI = {"ad": "etkinlik_adi", "alt_baslik": "alt_baslik", "tarih": "tarih"}
_UST_ANAHTARLAR = {alan.name for alan in fields(Ayar)} - set(_ETKINLIK_ALANLARI.values())
_YOL_ALANLARI = ("dist", "veri")


def ayar_yukle(argumanlar: Sequence[str] | None = None, config_yolu: Path = Path("config.toml")) -> Ayar:
    """Ayarları yükler; `argumanlar` verilmezse sys.argv okunur. Geçersiz config → ValueError."""
    ayar = Ayar()
    if config_yolu.exists():
        with config_yolu.open("rb") as dosya:
            ayar = _configten(ayar, tomllib.load(dosya))
    return _komut_satirindan(ayar, argumanlar)


def _configten(ayar: Ayar, config: dict) -> Ayar:
    ust = {anahtar: deger for anahtar, deger in config.items() if anahtar != "etkinlik"}
    etkinlik = config.get("etkinlik", {})
    # Yazım hatası sessizce yok sayılmasın: sunucu yanlış ayarla açılır, kimse fark etmez.
    bilinmeyen = sorted(set(ust) - _UST_ANAHTARLAR) + sorted(
        f"etkinlik.{anahtar}" for anahtar in set(etkinlik) - set(_ETKINLIK_ALANLARI)
    )
    if bilinmeyen:
        raise ValueError(f"config.toml: bilinmeyen anahtar: {', '.join(bilinmeyen)}")
    if "kaynak" in ust and ust["kaynak"] not in KAYNAKLAR:
        raise ValueError(f"config.toml: kaynak {' | '.join(KAYNAKLAR)} olmalı, gelen: {ust['kaynak']!r}")
    for alan in _YOL_ALANLARI:
        if alan in ust:
            ust[alan] = Path(ust[alan])
    return replace(ayar, **ust, **{_ETKINLIK_ALANLARI[anahtar]: deger for anahtar, deger in etkinlik.items()})


def _komut_satirindan(ayar: Ayar, argumanlar: Sequence[str] | None) -> Ayar:
    ayristirici = argparse.ArgumentParser(prog="python -m yakinlik", description="Yakınlık Takip Sistemi sunucusu")
    ayristirici.add_argument("--port", type=int, help="dinlenecek port")
    ayristirici.add_argument("--kaynak", choices=KAYNAKLAR, help="paket kaynağı")
    ayristirici.add_argument("--dist", type=Path, help="derlenmiş arayüz klasörü (SaasBridge/dist)")
    ayristirici.add_argument("--veri", type=Path, help="veri yolu")
    ayristirici.add_argument("--seri", help="alıcının seri aygıtı (ör. /dev/ttyUSB0, COM5)")
    verilen = {ad: deger for ad, deger in vars(ayristirici.parse_args(argumanlar)).items() if deger is not None}
    return replace(ayar, **verilen)
