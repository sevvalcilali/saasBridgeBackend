"""Kişi kayıt defteri (PLAN B3): ekleme, düzenleme, silme, kart bağlama. Kurallar SUNUCUDAN_ISTENENLER §1 ve mock ile aynı."""
import pytest
from destek.salon import KADRO

from yakinlik.cekirdek.kisi import PALET, KisiDefteri


@pytest.fixture
def defter():
    return KisiDefteri.kadrodan(KADRO)  # k1–k4, kart 2–5


def test_yeni_kisi_kartsiz_dogar_kimlik_ve_renk_sirayla(defter):
    kisi = defter.ekle(ad="  Deniz Aksoy ", rol="investor", kurum="Ege Girişim", yildiz=4, notu="VIP")

    assert (kisi.kisi_id, kisi.ad, kisi.rol, kisi.kurum, kisi.yildiz, kisi.notu) == (
        "k5", "Deniz Aksoy", "investor", "Ege Girişim", 4, "VIP")
    assert (kisi.atanan_kart, kisi.ayrildi) == (None, False)
    assert kisi.renk == PALET[4]  # kadronun 4 kişisinden sonra paletin 5. rengi
    assert defter.ekle(ad="Can", rol="guest").renk == PALET[5]
    assert defter.kisi("k5") is kisi


@pytest.mark.parametrize(
    ("girdi", "beklenen"),
    [
        ({"rol": "uydurma"}, {"rol": "guest", "yildiz": 0}),  # geçersiz rol misafir sayılır (mock)
        ({"rol": "founder", "yildiz": 4}, {"rol": "founder", "yildiz": 0}),  # yatırımcı değilse yıldız 0
        ({"rol": "investor", "yildiz": 9}, {"yildiz": 5}),
        ({"rol": "investor", "yildiz": -2}, {"yildiz": 0}),
        ({"rol": "investor", "yildiz": "3"}, {"yildiz": 3}),
        ({"rol": "investor", "yildiz": 4.7}, {"yildiz": 4}),
        ({"rol": "investor", "yildiz": None}, {"yildiz": 0}),
        ({"rol": "investor", "yildiz": "çok"}, {"yildiz": 0}),
        ({"kurum": 5, "notu": {}}, {"kurum": "", "notu": ""}),  # metin olmayan alan yok sayılır
    ],
)
def test_eklerken_alanlar_kurala_uydurulur(defter, girdi, beklenen):
    kisi = defter.ekle(ad="Deneme", **girdi)

    assert {alan: getattr(kisi, alan) for alan in beklenen} == beklenen


def test_duzenleme_yalniz_verilen_alanlari_degistirir_renk_ve_kimlik_sabit(defter):
    kisi = defter.kisi("k2")  # Mehmet Kılıç, girişimci, kart 3
    renk = kisi.renk

    defter.guncelle("k2", {"ad": "Mehmet K.", "rol": "investor", "yildiz": 9, "renk": "#000000", "kisiId": "x"})

    assert (kisi.ad, kisi.rol, kisi.yildiz, kisi.kurum) == ("Mehmet K.", "investor", 5, "Nova Robotik")
    assert (kisi.kisi_id, kisi.renk, kisi.atanan_kart) == ("k2", renk, "3")


def test_duzenlemede_gecersiz_rol_ve_bos_ad_yok_sayilir(defter):
    defter.guncelle("k1", {"rol": "uydurma", "ad": "   ", "kurum": 5})

    kisi = defter.kisi("k1")
    assert (kisi.ad, kisi.rol, kisi.kurum) == ("Ayşe Demir", "investor", "Atlas Ventures")


def test_rol_yatirimcidan_cikinca_yildiz_sifirlanir(defter):
    defter.guncelle("k1", {"rol": "guest"})

    assert defter.kisi("k1").yildiz == 0


def test_kart_baglama_ve_birakma(defter):
    kisi = defter.ekle(ad="Yeni", rol="guest")

    defter.ata(kisi.kisi_id, "40")
    assert (defter.kart_sahibi("40"), defter.kimlik("40"), kisi.atanan_kart, kisi.ayrildi) == (kisi, kisi.kisi_id, "40", False)

    defter.birak("40")
    assert (defter.kart_sahibi("40"), defter.kimlik("40"), kisi.atanan_kart) == (None, "kart:40", None)


def test_silinen_kisi_listede_ve_kartta_yok(defter):
    defter.birak("2")
    defter.sil("k1")

    assert defter.kisi("k1") is None
    assert [k.kisi_id for k in defter.kisiler()] == ["k2", "k3", "k4"]
    sonraki = defter.ekle(ad="Sonraki", rol="guest")
    assert (sonraki.kisi_id, sonraki.renk) == ("k5", PALET[4])  # kimlik ve renk sırası silinenle kaymaz
