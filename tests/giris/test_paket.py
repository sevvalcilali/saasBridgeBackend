"""Paket (PLAN B1.1): kart paketi ve kişi kartı / dinleyici cihaz ayrımı."""
import pytest

from yakinlik.giris.paket import Paket, kisi_karti_mi


@pytest.mark.parametrize(
    ("kart", "beklenen"),
    [("1", True), ("14", True), ("99", True), ("0", False), ("100", False), ("250", False), ("", False), ("kart", False)],
)
def test_kisi_karti_1_ile_99_arasidir(kart, beklenen):
    assert kisi_karti_mi(kart) is beklenen


@pytest.mark.parametrize("kart", ["²", "١٢", "1²", " 7", "-7", "+7", "7.0"])
def test_garip_numara_hata_vermez_kisi_karti_sayilmaz(kart):
    # Seri hattan bozuk bayt gelebilir (B8): denetim istisna fırlatmamalı. "²" Python'a göre bir rakamdır
    # ama sayıya çevrilemez; "١٢" Arapça rakamlarla 12'dir ama kart numarası değildir.
    assert kisi_karti_mi(kart) is False


def test_bastaki_sifirlar_atilir_ayni_kart_tek_numarayla_gorunur():
    # Arayüz ve mock "007"yi "7" yapar (kartNoCoz); sunucu da her yerde aynı biçimi kullanmalı.
    paket = Paket(kart="007", duyulanlar=(("012", -60.0), ("0100", -70.0)), t=1.0)

    assert paket.kart == "7"
    assert paket.duyulanlar == (("12", -60.0), ("100", -70.0))


def test_dinleyici_cihaz_paketi_isaretlenir_ama_icerigi_durur():
    # 100+ numaralı cihaz kişi değildir ama paketi atılmaz: /api/cards gösterebilir.
    paket = Paket(kart="101", duyulanlar=(("14", -60.0),), t=3.0)

    assert paket.dinleyici is True
    assert paket.duyulanlar == (("14", -60.0),)


def test_kisi_karti_paketi_dinleyici_degildir():
    assert Paket(kart="14", duyulanlar=(), t=3.0).dinleyici is False
