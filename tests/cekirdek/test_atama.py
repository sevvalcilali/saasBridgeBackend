"""Kart verme / iade / geri al / değişim (PLAN B3, SUNUCUDAN_ISTENENLER §2). Kişi ≠ kart: süreler kişide kalır."""
import json

import pytest
from destek.salon import KARTLAR, UZAK, YAKIN, Salon

from yakinlik.cekirdek.atama import AtamaKaydi, KartHareketi, ata, iade
from yakinlik.cekirdek.durum import Etkinlik, durum_uret

AYSE_MEHMET = {("2", "3"): YAKIN}
FAZLA_KART = (*KARTLAR, "22", "40")


def turler(alan):
    return [bildirim.kind for bildirim in alan.bildirimler]


def kisiler_durumda(salon):
    durum = json.loads(json.dumps(durum_uret(salon.alan, Etkinlik("a", "b", "c"), salon.duvar)))
    return {kisi["id"]: kisi for kisi in durum["people"]}, durum["edges"]


def test_kartsiz_kisiye_kart_verilince_sahneye_cikar_ve_gecmise_yazilir():
    salon = Salon()
    kisi = salon.alan.defter.ekle(ad="Yeni", rol="founder", kurum="Yeni A.Ş.")

    hareket = ata(salon.alan, kisi.kisi_id, "40", salon.duvar)

    assert salon.alan.sahnedeki_kartlar() == ["2", "3", "4", "5", "40"]
    assert hareket == KartHareketi(giren=(("40", "founder"),), cikan=())
    assert salon.alan.atama_gecmisi == [AtamaKaydi(salon.duvar, "k5", "40", "ata")]


def test_baskasindaki_karti_almak_eski_sahibi_kartsiz_birakir_ayrilmis_saymaz():
    salon = Salon().gecir(60.0, AYSE_MEHMET)  # Ayşe–Mehmet görüşmede
    yeni = salon.alan.defter.ekle(ad="Yeni", rol="guest")

    hareket = ata(salon.alan, yeni.kisi_id, "3", salon.duvar)  # Mehmet'in kartı

    mehmet = salon.alan.defter.kisi("k2")
    assert (mehmet.atanan_kart, mehmet.ayrildi) == (None, False)
    assert salon.alan.defter.kart_sahibi("3") is yeni
    assert (salon.alan.birlikte_ciftler(), salon.alan.biten) == ({}, 1)  # kartın açık görüşmesi kapandı
    assert salon.alan.kenarlar.dakika == {("k1", "k2"): 1.0}  # süre Mehmet'te kalır
    assert hareket == KartHareketi(giren=(("3", "guest"),), cikan=(("3", False),))
    assert [(k.kisi_id, k.kart, k.islem) for k in salon.alan.atama_gecmisi] == [("k2", "3", "iade"), ("k5", "3", "ata")]


def test_kart_degisiminde_sureler_kiside_birlesir_eski_kart_kapanir():
    salon = Salon().gecir(60.0, AYSE_MEHMET)

    hareket = ata(salon.alan, "k2", "22", salon.duvar)  # Mehmet: kart 3 → 22 (pil bitti)
    salon.gecir(60.0, {("2", "22"): YAKIN}, kartlar=FAZLA_KART)

    assert salon.alan.defter.kisi("k2").atanan_kart == "22"
    assert salon.alan.sahnedeki_kartlar() == ["2", "22", "4", "5"]
    assert hareket == KartHareketi(giren=(("22", "founder"),), cikan=(("3", False),))
    assert salon.alan.atama_gecmisi[-1].islem == "degisim"
    assert salon.alan.kenarlar.dakika[("k1", "k2")] == pytest.approx(2.0)  # iki görüşme aynı kişide birleşti
    kisiler, kenarlar = kisiler_durumda(salon)
    assert "3" not in kisiler
    assert kenarlar == [{"a": "2", "b": "22", "min": 2.0}]


def test_iade_kisiyi_ayrildi_yapar_acik_gorusmeyi_kapatir_sureleri_silmez():
    salon = Salon().gecir(60.0, AYSE_MEHMET)

    hareket = iade(salon.alan, "3", ayrildi=True, duvar=salon.duvar)
    salon.gecir(1.0)  # kart masada açık durmaya devam eder

    mehmet = salon.alan.defter.kisi("k2")
    assert (mehmet.atanan_kart, mehmet.ayrildi) == (None, True)
    assert "3" not in salon.alan.sahnedeki_kartlar()
    assert (salon.alan.birlikte_ciftler(), salon.alan.biten) == ({}, 1)
    assert salon.alan.bosta_sn("2") == 1.0  # eşi serbest kaldı
    assert salon.alan.kenarlar.sure["k2"] == 1.0
    assert hareket == KartHareketi(giren=(), cikan=(("3", True),))
    assert salon.alan.atama_gecmisi[-1] == AtamaKaydi(salon.duvar - 1.0, "k2", "3", "iade")


def test_geri_al_kisiyi_kart_bekliyor_birakir():
    salon = Salon()

    iade(salon.alan, "3", ayrildi=False, duvar=salon.duvar)

    mehmet = salon.alan.defter.kisi("k2")
    assert (mehmet.atanan_kart, mehmet.ayrildi) == (None, False)
    assert salon.alan.atama_gecmisi[-1].islem == "geri_al"


def test_kart_verilen_kisinin_ayrildi_isareti_kalkar():
    salon = Salon()
    iade(salon.alan, "3", ayrildi=True, duvar=salon.duvar)

    ata(salon.alan, "k2", "40", salon.duvar)

    assert salon.alan.defter.kisi("k2").ayrildi is False


def test_kisisiz_kartin_gorusmesi_ve_suresi_kart_verilen_kisiye_gecer():
    salon = Salon().gecir(60.0, {("3", "14"): YAKIN})  # Kart 14 (kimseye verilmemiş) Mehmet'le görüştü
    yeni = salon.alan.defter.ekle(ad="Kart Sahibi", rol="investor", yildiz=3)

    hareket = ata(salon.alan, yeni.kisi_id, "14", salon.duvar)
    salon.gecir(30.0, {("3", "14"): YAKIN})

    assert hareket == KartHareketi(giren=(("14", "investor"),), cikan=())  # kart salonda kalır
    assert list(salon.alan.birlikte_ciftler()) == ["3-14"]  # görüşme kesilmez, yeni kimlikle sürer
    assert salon.alan.kenarlar.dakika == {("k2", "k5"): pytest.approx(1.5)}
    assert "kart:14" not in salon.alan.kenarlar.sure
    assert salon.alan.sahnedeki_kartlar() == ["2", "3", "4", "5", "14"]


def test_iade_edilen_kart_baskasina_verilince_eski_sahibin_sureleri_gecmez():
    salon = Salon().gecir(60.0, AYSE_MEHMET)
    iade(salon.alan, "3", ayrildi=True, duvar=salon.duvar)
    taze = salon.alan.defter.ekle(ad="Taze Kişi", rol="guest")

    ata(salon.alan, taze.kisi_id, "3", salon.duvar)

    kisiler, kenarlar = kisiler_durumda(salon)
    assert (kisiler["3"]["name"], kisiler["3"]["min"]) == ("Taze Kişi", 0)
    assert kenarlar == []


def test_iade_edilen_kisi_yeni_kart_alinca_sureleri_geri_gelir():
    salon = Salon().gecir(60.0, AYSE_MEHMET)
    iade(salon.alan, "3", ayrildi=True, duvar=salon.duvar)

    ata(salon.alan, "k2", "40", salon.duvar)

    kisiler, kenarlar = kisiler_durumda(salon)
    assert kisiler["40"]["min"] == 1.0
    assert kenarlar == [{"a": "2", "b": "40", "min": 1.0}]


def test_anlasma_gecmisi_kiside_kalir_kart_baskasina_verilince_tekrar_bildirimi_dusmez():
    salon = Salon(anlasma_sn=60).gecir(60.0, AYSE_MEHMET)
    iade(salon.alan, "3", ayrildi=True, duvar=salon.duvar)
    yeni = salon.alan.defter.ekle(ad="Yeni Sahip", rol="founder", kurum="Peak")
    ata(salon.alan, yeni.kisi_id, "3", salon.duvar)

    salon.gecir(60.0, AYSE_MEHMET)

    assert turler(salon.alan) == ["deal", "deal"]  # yeni kişi çiftinin kendi anlaşması, "Yeniden bir arada" değil
    assert len(salon.alan.anlasmalar) == 2


def test_kisisiz_kartin_anlasmasi_kart_verilen_kisiye_gecer():
    salon = Salon(anlasma_sn=60).gecir(60.0, {("3", "14"): YAKIN})  # Kart 14 ile Mehmet: anlaşma
    yeni = salon.alan.defter.ekle(ad="Kart Sahibi", rol="investor", yildiz=3)
    ata(salon.alan, yeni.kisi_id, "14", salon.duvar)
    salon.gecir(30.0, {("3", "14"): UZAK})  # ayrıldılar

    salon.gecir(70.0, {("3", "14"): YAKIN})  # yeniden bir arada

    assert turler(salon.alan) == ["deal", "repeat"]
    assert salon.alan.anlasmalar == {("k2", "k5")}


def test_gorustugu_kisisiz_karti_kendine_alan_kisinin_suresi_iki_kez_sayilmaz():
    # Ayşe Kart 14 ile görüştü, sonra (pili bitince) Kart 14 ona verildi: kendi kendine kenar olmaz.
    salon = Salon().gecir(60.0, {("2", "14"): YAKIN})

    ata(salon.alan, "k1", "14", salon.duvar)

    kenarlar = salon.alan.kenarlar
    assert all(x != y for x, y in kenarlar.dakika)
    for kimlik, sure in kenarlar.sure.items():  # kişinin süresi = kenar dakikalarının toplamı
        assert sure == pytest.approx(sum(dk for cift, dk in kenarlar.dakika.items() if kimlik in cift))


def test_ayni_karti_ayni_kisiye_yeniden_vermek_bir_sey_degistirmez():
    salon = Salon().gecir(60.0, AYSE_MEHMET)

    hareket = ata(salon.alan, "k1", "2", salon.duvar)

    assert hareket == KartHareketi(giren=(), cikan=())
    assert list(salon.alan.birlikte_ciftler()) == ["2-3"]
    assert salon.alan.atama_gecmisi == []


def test_sifirlama_atama_gecmisini_siler_atamalari_tutar():
    salon = Salon()
    yeni = salon.alan.defter.ekle(ad="Yeni", rol="guest")
    ata(salon.alan, yeni.kisi_id, "40", salon.duvar)

    salon.alan.sifirla()

    assert salon.alan.atama_gecmisi == []
    assert salon.alan.defter.kart_sahibi("40") is yeni


# --- B3+B4 incelemesi ---

def test_kimsesiz_kart_iade_edilince_panodan_duser_sureleri_sonraki_sahibe_gecmez():
    salon = Salon(anlasma_sn=60).gecir(180.0, {("2", "14"): YAKIN})  # Kart 14 Ayşe'yle görüştü, anlaşma da çıktı

    iade(salon.alan, "14", ayrildi=True, duvar=salon.duvar)
    panoda = "14" in salon.alan.sahnedeki_kartlar()
    yeni = salon.alan.defter.ekle(ad="Sonraki Sahip", rol="founder")
    ata(salon.alan, yeni.kisi_id, "14", salon.duvar)

    assert not panoda
    assert yeni.kisi_id not in salon.alan.kenarlar.sure  # bilinmeyen eski taşıyıcının süresi devredilmez
    assert all(yeni.kisi_id not in cift for cift in salon.alan.anlasmalar)
    assert salon.alan.kenarlar.sure["k1"] == pytest.approx(3.0)  # Ayşe'nin süresi silinmez


def test_kartini_iade_eden_kisinin_bosta_sayaci_sifirlanir():
    salon = Salon().gecir(350.0)  # Ayşe (★★★) 350 sn yalnız
    iade(salon.alan, "2", ayrildi=True, duvar=salon.duvar)
    salon.gecir(600.0)
    ata(salon.alan, "k1", "40", salon.duvar)

    salon.gecir(15.0, kartlar=(*FAZLA_KART,))

    assert "idle_investor" not in turler(salon.alan)
    assert salon.alan.bosta_sn("40") == 15.0


def test_anlasma_yaptigi_kimsesiz_karti_alan_kiside_kendiyle_anlasma_olmaz():
    salon = Salon(anlasma_sn=60).gecir(60.0, {("2", "14"): YAKIN})

    ata(salon.alan, "k1", "14", salon.duvar)

    assert all(x != y for x, y in salon.alan.anlasmalar)
