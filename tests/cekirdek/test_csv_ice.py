"""CSV ile toplu kişi yükleme (SUNUCUDAN_ISTENENLER §1, brief §6.2): sütunlar ad, soyad, rol, kurum, yıldız."""
import pytest
from destek.salon import KADRO

from yakinlik.cekirdek.csv_ice import iceri_aktar
from yakinlik.cekirdek.kisi import KisiDefteri


@pytest.fixture
def defter():
    return KisiDefteri.kadrodan(KADRO)


def eklenenler(defter, once):
    return {k.ad: k for k in defter.kisiler()[once:]}


def test_noktali_virgul_turkce_baslik_ve_rol_tirnak_bos_satir(defter):
    # Mock'un iceaktar.test.js senaryosu (Türkçe Excel ";" ile kaydeder).
    metin = "\r\n".join([
        "Ad;Soyad;Rol;Kurum;Yıldız",
        "Deniz;Aksoy;Yatırımcı;Ege Girişim;4",
        'Can;Bulut;girişimci;"Veri; Köprüsü A.Ş.";3',
        "",
        "Lale;Tunç;Misafir;;",
        "Oya;Er;Bilinmez;X;1",
        ";Soyadsız;Misafir;;",
    ])

    sonuc = iceri_aktar(defter, metin)

    assert sonuc.eklenen == 3
    assert [(a.satir, a.sebep) for a in sonuc.atlanan] == [(6, 'rol anlaşılamadı: "Bilinmez"'), (7, "ad boş")]
    yeni = eklenenler(defter, 4)
    assert (yeni["Deniz Aksoy"].rol, yeni["Deniz Aksoy"].yildiz, yeni["Deniz Aksoy"].kurum) == ("investor", 4, "Ege Girişim")
    assert (yeni["Can Bulut"].kurum, yeni["Can Bulut"].yildiz) == ("Veri; Köprüsü A.Ş.", 0)  # yatırımcı değil
    assert yeni["Lale Tunç"].rol == "guest"
    assert all(k.atanan_kart is None and not k.ayrildi for k in yeni.values())  # kart bekliyor


def test_basliksiz_virgul_ingilizce_rol_bom_ve_ayni_kisi_ikinci_kez_eklenmez(defter):
    iceri_aktar(defter, "Deniz;Aksoy;Yatırımcı;Ege Girişim;4\n")

    sonuc = iceri_aktar(defter, "\ufeffEmel,Sarı,investor,Kuzey Fonu,5\nDeniz,Aksoy,Yatırımcı,Ege Girişim,4\n")

    assert sonuc.eklenen == 1
    assert [(a.satir, a.sebep) for a in sonuc.atlanan] == [(2, "Deniz Aksoy zaten kayıtlı")]
    emel = eklenenler(defter, 5)["Emel Sarı"]
    assert (emel.rol, emel.yildiz) == ("investor", 5)


def test_ayni_kisi_ayni_dosyada_iki_kez_varsa_biri_eklenir(defter):
    sonuc = iceri_aktar(defter, "Ali;Kaya;Misafir;;\nali;kaya;misafir;;\n")

    assert (sonuc.eklenen, [a.satir for a in sonuc.atlanan]) == (1, [2])


def test_sekme_ayraci_ve_tirnak_icinde_tirnak(defter):
    sonuc = iceri_aktar(defter, 'ad\tsoyad\trol\tkurum\nNur\tEk\tgirisimci\t"Ay ""Yıldız"" Ltd"\n')

    assert sonuc.eklenen == 1
    assert eklenenler(defter, 4)["Nur Ek"].kurum == 'Ay "Yıldız" Ltd'


@pytest.mark.parametrize("rol", ["YATIRIMCI", "yatirimci", "Investor", "INVESTOR", "yatırımcı"])
def test_rol_buyuk_kucuk_ve_i_ı_farki_gozetmeden(defter, rol):
    # Sözleşme: "büyük-küçük, ı/i farkı gözetmeden". "INVESTOR" Türkçe küçültmede "ınvestor" olur; yine tanınmalı.
    sonuc = iceri_aktar(defter, f"Ali;Kaya;{rol};Fon;3\n")

    assert sonuc.eklenen == 1
    assert eklenenler(defter, 4)["Ali Kaya"].rol == "investor"


def test_baslik_harfsiz_ya_da_farkli_sirada_olabilir(defter):
    sonuc = iceri_aktar(defter, "Sirket;Rol;Isim;Soyadi;Yildiz\nPeak;Yatirimci;Ece;Tan;2\n")

    ece = eklenenler(defter, 4)["Ece Tan"]
    assert (sonuc.eklenen, ece.kurum, ece.rol, ece.yildiz) == (1, "Peak", "investor", 2)


def test_rol_sutunu_olmayan_baslik_her_satiri_gerekceyle_atlar(defter):
    sonuc = iceri_aktar(defter, "ad;kurum\nAli;Fon\n")

    assert (sonuc.eklenen, [(a.satir, a.sebep) for a in sonuc.atlanan]) == (0, [(2, 'rol anlaşılamadı: ""')])


def test_soyad_bossa_ad_tek_basina(defter):
    iceri_aktar(defter, "Ali;;Misafir;;\n")

    assert "Ali" in eklenenler(defter, 4)
