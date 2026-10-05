"""Ayarlar: varsayılanlar < config.toml < komut satırı (PLAN B0.2)."""
from pathlib import Path

import pytest

from yakinlik.ayar import Ayar, ayar_yukle, veri_klasoru


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
    assert ayar.host == "0.0.0.0"     # masa tableti ve salon ekranı başka cihazdan bağlanır (PLAN Bölüm 11)


@pytest.mark.parametrize(
    ("config", "anahtar"),
    [
        ('port = "8002"\n', "port"),
        ("port = true\n", "port"),
        ("port = 80.5\n", "port"),
        ("port = 99999\n", "port"),
        ("port = 0\n", "port"),
        ("host = 5\n", "host"),
        ("dist = 5\n", "dist"),
        ('veri = ["a"]\n', "veri"),
        ("seri = 5\n", "seri"),
        ('esik = "-68"\n', "esik"),
        ("esik = true\n", "esik"),
        ("etkinlik = 5\n", "etkinlik"),
        ('etkinlik = "x"\n', "etkinlik"),
        ('[[etkinlik]]\nad = "x"\n', "etkinlik"),
        ("[etkinlik]\nad = 5\n", "etkinlik.ad"),
    ],
)
def test_configteki_yanlis_turde_deger_reddedilir(tmp_path, config, anahtar):
    # Yanlış türdeki değer (ör. esik = "-68") sessizce kabul edilirse hata açılışta değil,
    # etkinlik sırasında çıkar. İleti anahtarı ve ne olması gerektiğini söylemeli.
    with pytest.raises(ValueError, match=f"{anahtar}.* olmalı"):
        yukle(tmp_path, config)


@pytest.mark.parametrize("esik", ["-150", "72", "-19.5"])
def test_configteki_esik_kurulum_araligi_disindaysa_reddedilir(tmp_path, esik):
    # Kurulum ekranı −100…−20 kabul eder; "esik = 72" gibi bir yazım hatası bütün gün kimseyi "birlikte" saydırmaz.
    with pytest.raises(ValueError, match="esik"):
        yukle(tmp_path, f"esik = {esik}\n")


def test_configteki_esik_aralik_sinirlari_kabul_edilir(tmp_path):
    assert yukle(tmp_path, "esik = -100\n").esik == -100
    assert yukle(tmp_path, "esik = -20\n").esik == -20


def test_bozuk_toml_hatasi_dosyayi_soyler(tmp_path):
    with pytest.raises(ValueError, match="config.toml"):
        yukle(tmp_path, "port = \n")


def test_bom_ile_kaydedilmis_config_okunur(tmp_path):
    # Windows Not Defteri UTF-8 dosyanın başına BOM koyabilir.
    yol = tmp_path / "config.toml"
    yol.write_bytes(b"\xef\xbb\xbfport = 9000\n")

    assert ayar_yukle([], config_yolu=yol).port == 9000


def test_utf8_olmayan_config_ne_yapilacagini_soyler(tmp_path):
    # Eski Not Defteri "ANSI" (Windows-1254) kaydeder; "ş" o kodlamada tek bayttır, UTF-8 değildir.
    yol = tmp_path / "config.toml"
    yol.write_bytes('[etkinlik]\nad = "Buluşma"\n'.encode("cp1254"))

    with pytest.raises(ValueError, match="UTF-8"):
        ayar_yukle([], config_yolu=yol)


def test_okunamayan_config_dosyayi_soyler(tmp_path):
    yol = tmp_path / "config.toml"
    yol.mkdir()  # dosya yerine klasör

    with pytest.raises(ValueError, match="config.toml"):
        ayar_yukle([], config_yolu=yol)


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


def test_benzetim_varsayilanlari_mock_ile_aynidir(tmp_path):
    ayar = yukle(tmp_path)

    assert (ayar.kisi, ayar.hizlandir, ayar.kopma) == (25, 1, True)  # mock: --kisi=25 --hizlandir=1 --kopma=1
    assert (ayar.kaydet, ayar.iz) == (None, None)


def test_benzetim_ve_kayit_bayraklari_okunur(tmp_path):
    ayar = yukle(tmp_path, argumanlar=[
        "--kisi", "40", "--hizlandir", "10", "--kopma=0", "--kaydet", "iz.jsonl", "--iz", "eski.jsonl",
    ])

    assert (ayar.kisi, ayar.hizlandir, ayar.kopma) == (40, 10, False)
    assert (ayar.kaydet, ayar.iz) == (Path("iz.jsonl"), Path("eski.jsonl"))


@pytest.mark.parametrize(
    "argumanlar",
    [
        ["--kisi", "0"], ["--kisi", "-3"], ["--hizlandir", "0"], ["--hizlandir", "-2"], ["--hizlandir", "inf"],
        ["--hizlandir", "nan"], ["--kopma", "2"],
    ],
)
def test_gecersiz_benzetim_bayragi_reddedilir(tmp_path, argumanlar):
    with pytest.raises(SystemExit):
        yukle(tmp_path, argumanlar=argumanlar)


def test_depodaki_config_toml_yuklenebilir():
    # Depodaki config.toml elle düzenlenir; bozuksa sunucu açılmaz.
    yol = Path(__file__).parent.parent / "config.toml"

    assert yol.exists()
    assert isinstance(ayar_yukle([], config_yolu=yol), Ayar)


def test_kalici_veri_gercek_alicida_varsayilan_benzetimde_istenirse():
    # Benzetim mock gibi her açılışta temiz başlar; gerçek etkinlikte (seri) veri hep diske yazılır.
    assert veri_klasoru(Ayar()) is None
    assert veri_klasoru(Ayar(kaynak="kayit")) is None
    assert veri_klasoru(Ayar(kaynak="seri")) == Path("veri")
    assert veri_klasoru(Ayar(veri=Path("deneme"))) == Path("deneme")


def test_yeni_etkinlik_bayragi_okunur(tmp_path):
    assert yukle(tmp_path).yeni_etkinlik is False
    assert yukle(tmp_path, argumanlar=["--yeni-etkinlik"]).yeni_etkinlik is True
