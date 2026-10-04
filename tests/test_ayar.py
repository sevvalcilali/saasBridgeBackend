"""Ayarlar: varsayılanlar < config.toml < komut satırı (PLAN B0.2)."""
from pathlib import Path

import pytest

from yakinlik.ayar import Ayar, ayar_yukle


def yukle(tmp_path, config=None, argumanlar=()):
    yol = tmp_path / "config.toml"
    if config is not None:
        yol.write_text(config, encoding="utf-8")
    return ayar_yukle(list(argumanlar), config_yolu=yol)


def test_config_ve_arguman_yokken_sozlesme_varsayilanlari(tmp_path):
    ayar = yukle(tmp_path)

    assert ayar.port == 8002          # arayüzün Vite proxy'si 8002'ye gider
    assert ayar.kaynak == "benzetim"  # donanım yok: benzetimle başlanır
    assert ayar.dist == Path("../SaasBridge/dist")
    assert ayar.esik == -72           # brief §2 varsayılan eşik
    assert ayar.veri is None
    assert ayar.seri is None


def test_config_toml_yalniz_yazdigi_ayarlari_degistirir(tmp_path):
    ayar = yukle(tmp_path, """
port = 9000
host = "127.0.0.1"
dist = "baska/dist"
esik = -68

[etkinlik]
ad = "Deneme Buluşması"
tarih = "04.10.2026"
""")

    assert ayar.port == 9000
    assert ayar.host == "127.0.0.1"
    assert ayar.dist == Path("baska/dist")
    assert ayar.esik == -68
    assert ayar.etkinlik_adi == "Deneme Buluşması"
    assert ayar.tarih == "04.10.2026"
    assert ayar.kaynak == "benzetim"                # yazılmayan ayar varsayılanda kalır
    assert ayar.alt_baslik == Ayar().alt_baslik


def test_komut_satiri_config_tomlu_ezer(tmp_path):
    ayar = yukle(
        tmp_path,
        'port = 9000\nkaynak = "kayit"\nesik = -68\n',
        ["--port", "9100", "--kaynak", "seri", "--seri", "/dev/ttyUSB0", "--dist", "d", "--veri", "v"],
    )

    assert ayar.port == 9100
    assert ayar.kaynak == "seri"
    assert ayar.seri == "/dev/ttyUSB0"
    assert ayar.dist == Path("d")
    assert ayar.veri == Path("v")
    assert ayar.esik == -68  # komut satırında verilmeyen ayar config'ten gelir


def test_configteki_gecersiz_kaynak_reddedilir(tmp_path):
    with pytest.raises(ValueError, match="kaynak"):
        yukle(tmp_path, 'kaynak = "uydurma"\n')


def test_komut_satirindaki_gecersiz_kaynak_reddedilir(tmp_path):
    with pytest.raises(SystemExit):
        yukle(tmp_path, argumanlar=["--kaynak", "uydurma"])


def test_configteki_bilinmeyen_anahtar_reddedilir(tmp_path):
    # Yazım hatası ("prot") sessizce yok sayılırsa sunucu yanlış portta açılır.
    with pytest.raises(ValueError, match="prot"):
        yukle(tmp_path, "prot = 9000\n")


def test_etkinlik_tablosundaki_bilinmeyen_anahtar_reddedilir(tmp_path):
    with pytest.raises(ValueError, match="isim"):
        yukle(tmp_path, '[etkinlik]\nisim = "Deneme"\n')


def test_depodaki_config_toml_yuklenebilir():
    # Depodaki config.toml elle düzenlenir; bozuksa sunucu açılmaz.
    yol = Path(__file__).parent.parent / "config.toml"

    assert yol.exists()
    assert isinstance(ayar_yukle([], config_yolu=yol), Ayar)
