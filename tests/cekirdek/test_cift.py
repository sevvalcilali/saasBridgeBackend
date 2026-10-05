"""Çift kararı (PLAN B2.1, Bölüm 7): eşik üstünde kesintisiz 60 sn → birlikte; 15 sn altta → biter.

Karar (Şevval, 05.10.2026): 1 dakikadan kısa yan yana gelişler sayılmaz; bekleme dakikası görüşmeye sayılır.
"""
from yakinlik.cekirdek.cift import CiftDurumu, Gecis, ilerlet

DT = 0.5


def surdur(durum, ustunde, saniye):
    """`saniye` boyunca her tik aynı durumda; geçişleri ve görüşmeye eklenen toplam süreyi döndürür."""
    gecisler, eklenen = [], 0.0
    for _ in range(round(saniye / DT)):
        gecis, sure = ilerlet(durum, ustunde, DT)
        eklenen += sure
        if gecis is not Gecis.YOK:
            gecisler.append(gecis)
    return gecisler, eklenen


def test_bir_dakikadan_kisa_yan_yana_gelis_sayilmaz():
    durum = CiftDurumu()

    gecisler, eklenen = surdur(durum, True, 59.5)

    assert (gecisler, eklenen, durum.birlikte) == ([], 0.0, False)


def test_kesintisiz_bir_dakika_ustte_kalinca_birlikte_ve_bekleme_sayilir():
    durum = CiftDurumu()

    gecisler, eklenen = surdur(durum, True, 60.0)

    assert gecisler == [Gecis.BASLADI]
    assert durum.birlikte is True
    assert durum.birlikte_sn == 60.0
    assert eklenen == 60.0  # bekleme dakikası görüşmeye sayılır


def test_ustte_kalis_kesilirse_sayac_sifirlanir():
    durum = CiftDurumu()
    surdur(durum, True, 50.0)
    surdur(durum, False, 0.5)

    gecisler, _ = surdur(durum, True, 59.5)

    assert gecisler == []
    assert durum.birlikte is False


def test_birlikteyken_her_tik_sureye_eklenir():
    durum = CiftDurumu()
    surdur(durum, True, 60.0)

    gecisler, eklenen = surdur(durum, True, 30.0)

    assert (gecisler, eklenen, durum.birlikte_sn) == ([], 30.0, 90.0)


def test_on_bes_saniye_altta_kalinca_biter_cikis_suresi_de_sayilir():
    durum = CiftDurumu()
    surdur(durum, True, 60.0)

    kisa_gecisler, kisa_eklenen = surdur(durum, False, 14.5)
    hala_birlikte = durum.birlikte
    son_gecisler, son_eklenen = surdur(durum, False, 0.5)

    assert (kisa_gecisler, hala_birlikte) == ([], True)
    assert kisa_eklenen == 14.5  # çıkış gecikmesi boyunca hâlâ birlikte (mock ile aynı)
    assert son_gecisler == [Gecis.BITTI]
    assert son_eklenen == 0.5
    assert durum.birlikte is False


def test_kisa_dusus_gorusmeyi_bolmez():
    durum = CiftDurumu()
    surdur(durum, True, 60.0)
    surdur(durum, False, 14.5)

    gecisler, _ = surdur(durum, True, 10.0)

    assert gecisler == []
    assert durum.birlikte is True
    assert durum.altinda_sn == 0.0


def test_biten_gorusme_yeniden_baslamak_icin_yine_bir_dakika_bekler():
    durum = CiftDurumu()
    surdur(durum, True, 60.0)
    surdur(durum, False, 15.0)

    kisa, _ = surdur(durum, True, 59.5)
    tam, eklenen = surdur(durum, True, 0.5)

    assert kisa == []
    assert tam == [Gecis.BASLADI]
    assert eklenen == 60.0
