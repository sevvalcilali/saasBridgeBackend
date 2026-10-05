"""Kalıcılık (PLAN B6, Bölüm 9): alanın kalıcı kısmı SQLite'ta; süreç kapanıp açılınca kaldığı yerden sürer."""
import sqlite3
import time
from dataclasses import asdict

import pytest
from destek.salon import DUVAR, KARTLAR, YAKIN, Salon, tik_uret

from yakinlik.cekirdek.atama import ata, iade
from yakinlik.cekirdek.durum import Etkinlik, atamalar_sozluk, durum_uret, oturumlar_sozluk
from yakinlik.depo import sqlite as depo_modulu
from yakinlik.depo.sqlite import DOSYA, Depo

ETKINLIK = Etkinlik("Deneme", "alt", "tarih")
AYSE_MEHMET = {("2", "3"): YAKIN}


@pytest.fixture
def klasor(tmp_path):
    return tmp_path / "veri"


def dolu_salon():
    """Biten ve süren görüşmeler, anlaşma bildirimleri, kişisiz kartın kişiye geçen süresi, kart değişimi, silinen kişi."""
    salon = Salon(anlasma_sn=60).gecir(130.0, {("2", "3"): YAKIN, ("4", "14"): YAKIN})
    salon.gecir(30.0, {("4", "14"): YAKIN})  # Ayşe–Mehmet biter
    deniz = salon.alan.defter.ekle(ad="Deniz", rol="founder", kurum="Fon")
    ata(salon.alan, deniz.kisi_id, "14", salon.duvar)  # kart:14 → k5: süreler, kayıt ve anlaşma Deniz'e geçer
    ata(salon.alan, "k2", "40", salon.duvar)  # Mehmet kart değiştirir
    salon.alan.defter.sil(salon.alan.defter.ekle(ad="Silinen").kisi_id)  # k6
    salon.alan.esik = -70.5
    return salon.gecir(20.0, {("4", "14"): YAKIN}, kartlar=(*KARTLAR, "40"))  # Zeynep–Deniz sürüyor


def kalici_gorunum(alan):
    """Yeniden başlatmada korunması gerekenler (sinyal ölçümleri ve çift sayaçları bellekte kalır, yazılmaz)."""
    return {
        "kisiler": [asdict(kisi) for kisi in alan.defter.kisiler()],
        "kenar": dict(alan.kenarlar.dakika),
        "sure": dict(alan.kenarlar.sure),
        "karma": dict(alan.kenarlar.karma),
        "bildirimler": list(alan.bildirimler),
        "anlasmalar": set(alan.anlasmalar),
        "atamalar": atamalar_sozluk(alan),
        "esik": alan.esik,
        "emekli": alan.emekli_sayac,
    }


def yaz_ve_yeniden_ac(klasor, salon, kapali_sn=0.0):
    """Yazar, süreç ölmüş gibi bağlantıyı kapatır, `kapali_sn` sonra yeniden açıp yükler."""
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()
    yeni = Depo.ac(klasor, salon.duvar + kapali_sn)
    return yeni, yeni.yukle(salon.duvar + kapali_sn)


def satir_sayisi(yol, tablo):
    baglanti = sqlite3.connect(yol)
    try:
        return baglanti.execute(f"SELECT COUNT(*) FROM {tablo}").fetchone()[0]
    finally:
        baglanti.close()


def test_bos_klasorde_yeni_dosya_acilir_yuklenecek_veri_yok(klasor):
    depo = Depo.ac(klasor, DUVAR)

    assert depo.yukle(DUVAR) is None
    assert (klasor / DOSYA).is_file()
    assert depo._db.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert depo._db.execute("PRAGMA user_version").fetchone()[0] == depo_modulu.SURUM


def test_kapanip_acilinca_kisiler_sureler_bildirimler_anlasmalar_atamalar_ve_esik_ayni(klasor):
    salon = dolu_salon()

    _, kalici = yaz_ve_yeniden_ac(klasor, salon)
    alan = kalici.alan()

    assert kalici_gorunum(alan) == kalici_gorunum(salon.alan)
    assert alan.anlasmalar == {("k1", "k2"), ("k3", "k5")}  # kişisiz kartın anlaşması kişiye geçmişti
    assert durum_uret(alan, ETKINLIK, DUVAR)["edges"] == durum_uret(salon.alan, ETKINLIK, DUVAR)["edges"]


def test_acik_gorusme_son_yazilan_anda_kapanir_biten_sayilir_sure_kenarla_tutarli(klasor):
    salon = dolu_salon()
    once = oturumlar_sozluk(salon.alan)
    gecen = salon.alan.gecen_sn

    _, kalici = yaz_ve_yeniden_ac(klasor, salon, kapali_sn=600.0)
    alan = kalici.alan()

    # Kapalı kalınan 10 dakika görüşmeye yazılmaz: kayıt toplamı kenar dakikasına eşit kalır (PLAN 5.2 madde 4).
    assert oturumlar_sozluk(alan) == [{**o, "end": gecen if o["end"] is None else o["end"]} for o in once]
    assert alan.biten == salon.alan.biten + sum(1 for o in once if o["end"] is None)
    zeynep_deniz = sum(o["end"] - o["start"] for o in oturumlar_sozluk(alan) if {o["a"], o["b"]} == {"k3", "k5"})
    assert zeynep_deniz / 60 == pytest.approx(alan.kenarlar.dakika[("k3", "k5")])


def test_etkinlik_saati_kapali_kalinan_sureyle_surer(klasor):
    salon = Salon().gecir(90.0, AYSE_MEHMET)

    _, kalici = yaz_ve_yeniden_ac(klasor, salon, kapali_sn=300.0)
    alan = kalici.alan()  # gerçek kaynak: başlangıç bilinmez, ilk tik başlangıç olur
    once = alan.gecen_sn
    alan.tik(tik_uret(5_000.0), DUVAR)
    alan.tik(tik_uret(5_000.5), DUVAR)

    assert once == 390.0
    assert alan.gecen_sn == 390.5


def test_benzetimde_etkinlik_saati_kaynagin_baslangicindan_surer(klasor):
    salon = Salon().gecir(90.0, AYSE_MEHMET)

    _, kalici = yaz_ve_yeniden_ac(klasor, salon, kapali_sn=10.0)

    assert kalici.alan(baslangic=0.0).gecen_sn == 100.0


@pytest.mark.parametrize("diske_yazildi", [True, False])
def test_silinen_kisinin_kimligi_yeniden_kullanilmaz(klasor, diske_yazildi):
    # Kritik: k5 yeniden doğarsa eski k5'in görüşme kayıtları ve süreleri yeni kişiye yazılmış olur.
    salon = Salon()
    depo = Depo.ac(klasor, salon.duvar)
    silinen = salon.alan.defter.ekle(ad="Silinen")
    if diske_yazildi:
        depo.yaz(salon.alan, salon.duvar)
    salon.alan.defter.sil(silinen.kisi_id)
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()

    depo = Depo.ac(klasor, salon.duvar)
    alan = depo.yukle(salon.duvar).alan()
    depo.kapat()

    assert alan.defter.kisi("k5") is None
    assert alan.defter.ekle(ad="Yeni").kisi_id == "k6"
    # Diske yazılmış kişinin satırı silinmez, işaretlenir (adı rapor için durur).
    assert satir_sayisi(klasor / DOSYA, "kisi WHERE silindi = 1") == int(diske_yazildi)


def test_kisisiz_kartin_kaydi_kisiye_gecince_diskte_de_gecer(klasor):
    salon = Salon().gecir(90.0, {("3", "14"): YAKIN})
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)  # diskte "kart:14" yazılı
    sahip = salon.alan.defter.ekle(ad="Sahip")
    ata(salon.alan, sahip.kisi_id, "14", salon.duvar)
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()

    kalici = Depo.ac(klasor, salon.duvar).yukle(salon.duvar)

    assert [(o["a"], o["b"]) for o in oturumlar_sozluk(kalici.alan())] == [("k2", sahip.kisi_id)]
    assert set(kalici.alan().kenarlar.dakika) == {("k2", sahip.kisi_id)}


def test_iade_edilen_kisisiz_kartin_arsiv_kimligi_yeniden_baslatmadan_sonra_cakismaz(klasor):
    # Kart 14'ü taşıyan iki ayrı bilinmeyen kişinin süreleri birleşmemeli.
    salon = Salon().gecir(90.0, {("3", "14"): YAKIN})
    iade(salon.alan, "14", ayrildi=True, duvar=salon.duvar)

    _, kalici = yaz_ve_yeniden_ac(klasor, salon)
    alan = kalici.alan()
    alan.kenarlar.ekle("kart:14", "k1", 1.0, False)
    alan.kimligi_emekli_et("kart:14")

    assert set(alan.kenarlar.dakika) == {("arsiv:kart:14:1", "k2"), ("arsiv:kart:14:2", "k1")}


def test_yalniz_degisenler_yazilir(klasor):
    salon = Salon().gecir(130.0, {("2", "3"): YAKIN, ("4", "5"): YAKIN, ("2", "4"): YAKIN})
    salon.gecir(40.0, AYSE_MEHMET)  # diğer iki görüşme biter (10 sn ortanca penceresi + 15 sn çıkış)
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)

    ayni = depo.yaz(salon.alan, salon.duvar)
    salon.gecir(0.5, AYSE_MEHMET)
    bir_tik = depo.yaz(salon.alan, salon.duvar)

    assert ayni == 0
    # Ayşe–Mehmet kenarı, ikisinin toplamları, etkinlik saati ve duvar saati; diğer kenar ve kayıtlar yazılmaz.
    assert bir_tik == 5


def test_yazilamayan_degisiklik_kaybolmaz_sonraki_yazimda_diske_gider(klasor):
    # Kritik: yazım yarıda kalırsa "yazıldı" sayılmamalı; yoksa o fark bir daha hiç yazılmaz.
    salon = Salon().gecir(30.0, AYSE_MEHMET)
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)
    depo._db.execute("CREATE TEMP TRIGGER disk_dolu BEFORE INSERT ON kenar BEGIN SELECT RAISE(ABORT, 'disk dolu'); END")
    salon.gecir(60.0, AYSE_MEHMET)  # görüşme başlar: kenar ve kayıt doğar

    with pytest.raises(sqlite3.Error):
        depo.yaz(salon.alan, salon.duvar)
    depo._db.execute("DROP TRIGGER disk_dolu")
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()
    kalici = Depo.ac(klasor, salon.duvar).yukle(salon.duvar)

    assert kalici_gorunum(kalici.alan()) == kalici_gorunum(salon.alan)
    assert len(oturumlar_sozluk(kalici.alan())) == 1


def test_sifirlanan_alanin_silinen_tablolari_diskte_de_bosalir(klasor):
    salon = dolu_salon()
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)

    salon.alan.sifirla()
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()
    alan = Depo.ac(klasor, salon.duvar).yukle(salon.duvar).alan()

    assert kalici_gorunum(alan) == kalici_gorunum(salon.alan)
    assert (oturumlar_sozluk(alan), alan.bildirimler, alan.biten, alan.gecen_sn) == ([], [], 0, 0.0)
    assert [k.atanan_kart for k in alan.defter.kisiler()] == ["2", "40", "4", "5", "14"]  # açık atamalar kalır


def test_yedek_bütün_veriyi_icerir_ve_ayri_dosyadir(klasor):
    salon = dolu_salon()
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)

    yedek = depo.yedekle("sifirlama", salon.duvar)
    ikinci = depo.yedekle("sifirlama", salon.duvar)  # aynı saniyede ikinci yedek öncekini ezmez

    assert yedek.parent == klasor / "yedek" and yedek != ikinci
    for tablo in ("kisi", "oturum", "kenar", "bildirim", "atama", "anlasma"):
        assert satir_sayisi(yedek, tablo) == satir_sayisi(ikinci, tablo) > 0


def test_acilista_yedek_alinir_en_yeni_10_tanesi_tutulur(klasor):
    for i in range(12):  # ilk açılışta dosya yok, yedek de yok
        depo = Depo.ac(klasor, DUVAR + i)
        depo.yaz(Salon().alan, DUVAR + i)
        depo.kapat()

    yedekler = sorted((klasor / "yedek").glob("yakinlik-acilis-*.sqlite"))
    damga = time.strftime("%Y%m%d-%H%M%S", time.localtime(DUVAR + 2))
    assert len(yedekler) == 10
    assert yedekler[0].name == f"yakinlik-acilis-{damga}.sqlite"  # 2. ve sonraki açılışlar; en eskisi silindi
    assert satir_sayisi(yedekler[-1], "kisi") == 4


def test_ikinci_sunucu_ayni_veri_dosyasini_acamaz(klasor):
    Depo.ac(klasor, DUVAR)

    with pytest.raises(ValueError, match="başka bir sunucu"):
        Depo.ac(klasor, DUVAR)


def test_yeni_surumun_dosyasi_acilmaz(klasor):
    Depo.ac(klasor, DUVAR).kapat()
    baglanti = sqlite3.connect(klasor / DOSYA)
    baglanti.execute("PRAGMA user_version = 99")
    baglanti.close()

    with pytest.raises(ValueError, match="sürüm"):
        Depo.ac(klasor, DUVAR)


def test_bozuk_veri_dosyasi_anlasilir_hatayla_acilmaz(klasor):
    klasor.mkdir()
    (klasor / DOSYA).write_bytes(b"bu bir veritabani degil " * 100)

    with pytest.raises(ValueError, match="okunamadı"):
        Depo.ac(klasor, DUVAR)


def test_yeni_etkinlik_eski_veriyi_yedege_tasir_bos_baslar(klasor):
    salon = dolu_salon()
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()

    yeni = Depo.ac(klasor, salon.duvar + 60, yeni_etkinlik=True)

    assert yeni.yukle(salon.duvar + 60) is None
    (arsiv,) = (klasor / "yedek").glob("yakinlik-yeni-etkinlik-*.sqlite")
    assert satir_sayisi(arsiv, "oturum") == len(oturumlar_sozluk(salon.alan))
    assert satir_sayisi(arsiv, "kisi") == len(salon.alan.defter.kisiler())


def test_yeni_etkinlikte_yedek_dogrulanamazsa_eski_veri_silinmez(klasor, monkeypatch):
    # Kritik: geri alınamayan silme, yalnız doğrulanmış yedekten sonra.
    salon = dolu_salon()
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()

    def bozuk_yedek(yol):
        raise ValueError(f"yedek doğrulanamadı: {yol}")

    monkeypatch.setattr(depo_modulu, "_yedegi_dogrula", bozuk_yedek)
    with pytest.raises(ValueError, match="doğrulanamadı"):
        Depo.ac(klasor, salon.duvar + 60, yeni_etkinlik=True)
    monkeypatch.undo()

    kalici = Depo.ac(klasor, salon.duvar + 60).yukle(salon.duvar + 60)
    assert kalici_gorunum(kalici.alan()) == kalici_gorunum(salon.alan)


def test_acilis_yedegi_alinamasa_da_veri_acilir(klasor, caplog):
    # Açılış yedeği kolaylıktır; alınamadı diye etkinlik sunucusu açılmamazlık etmemeli.
    salon = Salon().gecir(90.0, AYSE_MEHMET)
    yeni, _ = yaz_ve_yeniden_ac(klasor, salon)  # ikinci açılış: yedek klasörü doğar
    yeni.kapat()
    (klasor / "yedek").rename(klasor / "yedek-eski")
    (klasor / "yedek").write_text("klasör değil", encoding="utf-8")

    depo = Depo.ac(klasor, salon.duvar + 5)

    assert kalici_gorunum(depo.yukle(salon.duvar + 5).alan()) == kalici_gorunum(salon.alan)
    assert "açılış yedeği alınamadı" in caplog.text


def test_yeni_etkinlikte_yedek_klasoru_yazilamazsa_anlasilir_hata_eski_veri_yerinde(klasor):
    salon = Salon().gecir(90.0, AYSE_MEHMET)
    depo = Depo.ac(klasor, salon.duvar)
    depo.yaz(salon.alan, salon.duvar)
    depo.kapat()
    (klasor / "yedek").write_text("klasör değil", encoding="utf-8")

    with pytest.raises(ValueError, match="yedek"):
        Depo.ac(klasor, salon.duvar + 5, yeni_etkinlik=True)
    (klasor / "yedek").unlink()

    assert kalici_gorunum(Depo.ac(klasor, salon.duvar + 5).yukle(salon.duvar + 5).alan()) == kalici_gorunum(salon.alan)
