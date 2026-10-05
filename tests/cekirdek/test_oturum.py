"""Görüşme kayıtları (PLAN B5, SUNUCUDAN_ISTENENLER §6): kişi kimliğiyle, etkinlik saniyesiyle; kayıtlar silinmez."""
import pytest
from destek.salon import KARTLAR, UZAK, YAKIN, Salon

from yakinlik.cekirdek.atama import ata, iade
from yakinlik.cekirdek.durum import oturumlar_sozluk

AYSE_MEHMET = {("2", "3"): YAKIN}


def kayitlar(salon):
    return [(o["a"], o["b"], o["start"], o["end"]) for o in oturumlar_sozluk(salon.alan)]


def test_gorusme_bekleme_dakikasindan_baslar_surerken_bitisi_bos():
    salon = Salon().gecir(10.0).gecir(70.0, AYSE_MEHMET)

    assert kayitlar(salon) == [("k1", "k2", 10.0, None)]  # eşiğin aşıldığı an (10,5 sn'deki ilk ölçüm tikiyle)


def test_biten_gorusmenin_suresi_kenar_dakikasina_esit():
    salon = Salon().gecir(120.0, AYSE_MEHMET).gecir(30.0, {("2", "3"): UZAK})

    ((a, b, bas, son),) = kayitlar(salon)
    assert (a, b, bas, son) == ("k1", "k2", 0.0, 140.0)
    assert (son - bas) / 60 == pytest.approx(salon.alan.kenarlar.dakika[("k1", "k2")])


def test_cift_basina_kayit_toplami_kenar_dakikasiyla_tutarli():
    salon = Salon()
    for _ in range(3):
        salon.gecir(90.0, AYSE_MEHMET).gecir(30.0, {("2", "3"): UZAK})

    toplam = sum(son - bas for _, _, bas, son in kayitlar(salon))
    assert len(kayitlar(salon)) == 3
    assert toplam / 60 == pytest.approx(salon.alan.kenarlar.dakika[("k1", "k2")])


def test_iade_acik_gorusmeyi_kapatir_kisinin_kayitlari_kalir():
    salon = Salon().gecir(90.0, AYSE_MEHMET)

    iade(salon.alan, "3", ayrildi=True, duvar=salon.duvar)

    assert kayitlar(salon) == [("k1", "k2", 0.0, 90.0)]


def test_kart_degisiminde_eski_kartin_gorusmesi_kapanir_yenisi_ayni_kisiyle_acilir():
    salon = Salon().gecir(90.0, AYSE_MEHMET)
    ata(salon.alan, "k2", "40", salon.duvar)

    salon.gecir(60.0, {("2", "40"): YAKIN}, kartlar=(*KARTLAR, "40"))

    assert kayitlar(salon) == [("k1", "k2", 0.0, 90.0), ("k1", "k2", 90.0, None)]


def test_kisisiz_kartin_kayitlari_kart_verilen_kisiye_gecer():
    salon = Salon().gecir(90.0, {("3", "14"): YAKIN})
    yeni = salon.alan.defter.ekle(ad="Sahip", rol="guest")

    once = kayitlar(salon)
    ata(salon.alan, yeni.kisi_id, "14", salon.duvar)

    assert once == [("k2", "kart:14", 0.0, None)]
    assert kayitlar(salon) == [("k2", yeni.kisi_id, 0.0, None)]


def test_iade_edilen_kisisiz_kartin_kayitlari_kayitsiz_kalir_sonraki_sahibe_gecmez():
    salon = Salon().gecir(90.0, {("3", "14"): YAKIN})
    iade(salon.alan, "14", ayrildi=True, duvar=salon.duvar)
    yeni = salon.alan.defter.ekle(ad="Sonraki", rol="guest")

    ata(salon.alan, yeni.kisi_id, "14", salon.duvar)

    assert kayitlar(salon) == [("k2", "kart:14", 0.0, 90.0)]  # rapor "Kart 14 (kayıtsız)" gösterir


def test_sifirlama_kayitlari_siler():
    salon = Salon().gecir(90.0, AYSE_MEHMET)
    salon.alan.sifirla()

    salon.gecir(60.0, AYSE_MEHMET)

    assert kayitlar(salon) == [("k1", "k2", 0.0, None)]  # yeni etkinlik saatine göre


def test_kisisiz_kart_kaydin_ilk_tarafindaysa_da_kisiye_gecer():
    salon = Salon()
    ata(salon.alan, salon.alan.defter.ekle(ad="Kırk", rol="guest").kisi_id, "40", salon.duvar)
    salon.gecir(90.0, {("14", "40"): YAKIN}, kartlar=(*KARTLAR, "40"))  # çift "14-40": Kart 14 ilk tarafta
    sahip = salon.alan.defter.ekle(ad="Sahip", rol="guest")

    ata(salon.alan, sahip.kisi_id, "14", salon.duvar)

    assert kayitlar(salon) == [(sahip.kisi_id, "k5", 0.0, None)]


def test_kisi_yanindaki_bos_karti_kendine_alirsa_kendisiyle_gorusme_kaydi_kalmaz():
    # Masadaki açık yedek karta 1 dk yakın duran kişi o kartı alırsa: kenar kendiliğinden düşüyor (Kenarlar.tasi);
    # kayıt da düşmeli, yoksa raporda "Mehmet – Mehmet" görünür ve kayıt toplamı kenar dakikasını tutmaz.
    salon = Salon().gecir(90.0, {("3", "14"): YAKIN})

    ata(salon.alan, "k2", "14", salon.duvar)

    assert kayitlar(salon) == []
    assert salon.alan.kenarlar.dakika == {}
