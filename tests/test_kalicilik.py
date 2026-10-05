"""Motor + kalıcılık (PLAN B6): masa işlemleri anında diske gider; sıfırlama önce yedek alır; eşik kalıcıdır."""
import json
import sqlite3

import pytest
from destek.salon import YAKIN, tik_uret

from yakinlik.ayar import Ayar
from yakinlik.http.uygulama import uygulama_olustur
from yakinlik.motor import Motor, SifirlamaHatasi
from yakinlik.saat import SahteSaat

KARTLAR = ("1", "2", "3", "4", "50")


def ac(klasor, **ayar):
    return Motor.ayardan(Ayar(veri=klasor, kisi=4, **ayar), saat=SahteSaat(1e9))


def oldur(motor):
    """Süreç öldü (kill -9): son yazım yapılmadan bağlantı kapanır; diskte yalnız o ana dek yazılanlar kalır."""
    motor._depo.kapat()


def gorusmeli(motor, saniye=90.0):
    """Benzetim kartlarıyla (1–4) iki çift görüşür; tikler elle verilir."""
    t = motor._alan.t or 0.0
    for _ in range(int(saniye / 0.5)):
        t += 0.5
        motor.isle(tik_uret(t, {("1", "2"): YAKIN, ("3", "4"): YAKIN}, kartlar=KARTLAR))
    return motor


def test_masa_islemleri_ve_esik_tik_beklemeden_diske_yazilir(tmp_path):
    motor = ac(tmp_path)
    deniz = motor.kisi_ekle({"ad": "Deniz", "rol": "investor", "yildiz": 4})
    motor.kisi_guncelle("k1", {"not": "VIP"})
    motor.ata(deniz.kisi_id, "50")
    motor.iade(motor.defter.kisi("k2").atanan_kart, ayrildi=True)
    motor.kisi_sil("k3")
    motor.iceri_aktar("Ali;Kaya;Misafir;;\n")
    motor.esik_ayarla(-80)
    oldur(motor)

    yeni = ac(tmp_path)

    assert yeni.defter.kisiler() == motor.defter.kisiler()
    assert yeni.atamalar() == motor.atamalar()
    assert json.loads(yeni.anlik)["threshold"] == -80
    assert yeni.kisi_ekle({"ad": "Sonraki"}).kisi_id == "k7"  # k3 silindi ama kimliği kullanılmaz


def test_tik_sonunda_gorusmeler_diske_yazilir_acilista_kaldigi_yerden_surer(tmp_path):
    motor = gorusmeli(ac(tmp_path))
    durum = json.loads(motor.anlik)
    oldur(motor)

    yeni = ac(tmp_path)
    sonra = json.loads(yeni.anlik)

    assert sonra["edges"] == durum["edges"] and durum["edges"]
    assert [(o["a"], o["b"], o["start"]) for o in yeni.oturumlar()] == [
        (o["a"], o["b"], o["start"]) for o in motor.oturumlar()
    ]
    assert all(o["end"] == durum["elapsed"] for o in yeni.oturumlar())  # açık görüşmeler son yazılan anda kapandı
    assert sonra["elapsed"] >= durum["elapsed"]


def test_kayitli_esik_configdeki_esigi_ezer(tmp_path):
    motor = ac(tmp_path, esik=-60)
    motor.esik_ayarla(-81.5)
    motor.kapat()

    assert json.loads(ac(tmp_path, esik=-60).anlik)["threshold"] == -81.5


def test_sifirlama_once_yedek_alir_kisiler_acik_atamalar_ve_esik_kalir(tmp_path):
    motor = gorusmeli(ac(tmp_path))
    motor.esik_ayarla(-70)
    kisiler = motor.defter.kisiler()

    motor.sifirla()
    oldur(motor)
    yeni = ac(tmp_path)
    durum = json.loads(yeni.anlik)

    (yedek,) = (tmp_path / "yedek").glob("yakinlik-sifirlama-*.sqlite")
    baglanti = sqlite3.connect(yedek)
    assert baglanti.execute("SELECT COUNT(*) FROM oturum").fetchone()[0] == 2  # sıfırlanan veri yedekte
    baglanti.close()
    assert yeni.defter.kisiler() == kisiler
    assert (yeni.oturumlar(), yeni.atamalar(), durum["edges"], durum["alerts"]) == ([], [], [], [])
    assert (durum["threshold"], durum["stats"]["done"]) == (-70, 0)


async def test_yedek_alinamazsa_sifirlanmaz_500_doner(tmp_path, istemci_ac, dist, monkeypatch):
    # Kritik: geri alınamayan silme, yalnız yedek alındıktan sonra.
    motor = gorusmeli(ac(tmp_path))
    once = motor.oturumlar()

    def yedek_yok(*_):
        raise OSError("disk dolu")

    monkeypatch.setattr(motor._depo, "yedekle", yedek_yok)
    async with istemci_ac(uygulama_olustur(Ayar(dist=dist), motor=motor)) as istemci:
        yanit = await istemci.post("/control", content=b'{"cmd":"reset"}')
    with pytest.raises(SifirlamaHatasi):
        motor.sifirla()
    oldur(motor)

    assert yanit.status_code == 500
    assert yanit.json() == {"ok": False, "hata": "sıfırlanmadı: yedek alınamadı (disk dolu)"}
    assert motor.oturumlar() == once and once
    assert len(ac(tmp_path).oturumlar()) == len(once)


def test_diske_yazilamasa_da_yayin_surer_veri_bellekte_kalir(tmp_path, caplog):
    motor = ac(tmp_path)
    motor._depo._db.execute("CREATE TEMP TRIGGER disk_dolu BEFORE INSERT ON kenar BEGIN SELECT RAISE(ABORT, 'x'); END")

    gorusmeli(motor)
    hatalar = [kayit for kayit in caplog.records if "diske yazılamadı" in kayit.getMessage()]
    motor._depo._db.execute("DROP TRIGGER disk_dolu")
    gorusmeli(motor, 0.5)
    oldur(motor)

    assert len(hatalar) == 1  # her tikte değil, bir kez
    assert json.loads(motor.anlik)["edges"]
    assert json.loads(ac(tmp_path).anlik)["edges"] == json.loads(motor.anlik)["edges"]


def test_benzetim_kalici_veriyle_acilinca_salon_kayit_defterine_uyar(tmp_path):
    motor = ac(tmp_path)
    benzetim = motor._kaynak.benzetim
    yedek = benzetim.masadaki[0]
    iade_edilen = motor.defter.kisi("k1").atanan_kart
    motor.iade(iade_edilen, ayrildi=True)
    motor.ata("k1", yedek)
    oldur(motor)

    yeni = ac(tmp_path)
    salon = yeni._kaynak.benzetim

    assert iade_edilen in salon.masadaki and yedek not in salon.masadaki
    assert salon._salondaki(yedek).rol == yeni.defter.kisi("k1").rol
    assert salon._salondaki(iade_edilen) is None


def test_benzetimde_veri_klasoru_verilmezse_kalici_degil(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    motor = Motor.ayardan(Ayar(kisi=4))
    motor.esik_ayarla(-80)

    assert motor._depo is None
    assert not (tmp_path / "veri").exists()


def test_yeni_etkinlik_kalicilik_kapaliyken_anlasilir_hata(tmp_path):
    with pytest.raises(ValueError, match="--yeni-etkinlik"):
        Motor.ayardan(Ayar(kisi=4, yeni_etkinlik=True))


def test_yeni_etkinlikle_acilinca_eski_veri_yedekte_kadro_bastan(tmp_path):
    motor = gorusmeli(ac(tmp_path))
    motor.kisi_ekle({"ad": "Eski"})
    motor.kapat()

    yeni = ac(tmp_path, yeni_etkinlik=True)

    assert len(yeni.defter.kisiler()) == 4 and yeni.oturumlar() == []
    assert len(list((tmp_path / "yedek").glob("yakinlik-yeni-etkinlik-*.sqlite"))) == 1


def test_sifirlama_diske_yazilamazsa_hata_doner_duzelince_sifirlanmis_hal_yazilir(tmp_path):
    # Yoksa masa "sıfırlandı" görür ama diskte eski etkinlik kalır, yeniden başlatmada geri gelir.
    motor = gorusmeli(ac(tmp_path))
    motor._depo._db.execute("CREATE TEMP TRIGGER disk_dolu BEFORE DELETE ON oturum BEGIN SELECT RAISE(ABORT, 'x'); END")

    with pytest.raises(SifirlamaHatasi, match="diske yazılamadı"):
        motor.sifirla()
    sifirlandi = motor.oturumlar() == []
    motor._depo._db.execute("DROP TRIGGER disk_dolu")
    gorusmeli(motor, 0.5)  # sıradaki tik yeniden yazar
    oldur(motor)

    assert sifirlandi
    assert ac(tmp_path).oturumlar() == []


def test_sifirlama_yedegi_diske_henuz_yazilamamis_son_hali_de_icerir(tmp_path):
    motor = ac(tmp_path)
    motor._depo._db.execute("CREATE TEMP TRIGGER disk_dolu BEFORE INSERT ON kisi BEGIN SELECT RAISE(ABORT, 'x'); END")
    motor.kisi_ekle({"ad": "Yazılamayan"})
    motor._depo._db.execute("DROP TRIGGER disk_dolu")

    motor.sifirla()

    (yedek,) = (tmp_path / "yedek").glob("yakinlik-sifirlama-*.sqlite")
    baglanti = sqlite3.connect(yedek)
    adlar = {ad for (ad,) in baglanti.execute("SELECT ad FROM kisi")}
    baglanti.close()
    assert "Yazılamayan" in adlar


async def test_sunucu_kapanirken_son_hal_diske_yazilir_veri_dosyasi_birakilir(tmp_path, dist):
    motor = ac(tmp_path)
    uygulama = uygulama_olustur(Ayar(dist=dist), motor=motor)

    async with uygulama.router.lifespan_context(uygulama):
        motor._alan.esik = -77  # bellekte; henüz diske yazılmadı

    assert json.loads(ac(tmp_path).anlik)["threshold"] == -77  # kilit bırakıldı, son hal yazıldı
