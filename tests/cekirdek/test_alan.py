"""Alan (PLAN B2.1–B2.2): bir tikte sinyal → çift kararı → görüşme süreleri → bildirimler. Zaman elle verilir."""
import pytest
from destek.salon import UZAK, YAKIN, Salon, tik_uret

from yakinlik.cekirdek.alan import Alan
from yakinlik.cekirdek.kisi import KisiDefteri

AYSE_MEHMET = {("2", "3"): YAKIN}  # ★★★ yatırımcı + girişimci


def turler(alan):
    return [bildirim.kind for bildirim in alan.bildirimler]


# --- görüşme ---

def test_bir_dakikadan_kisa_yan_yana_gelis_gorusme_sayilmaz():
    salon = Salon().gecir(59.5, AYSE_MEHMET)

    assert salon.alan.birlikte_ciftler() == {}
    assert salon.alan.kenarlar.dakika == {}


def test_bir_dakika_yan_yana_kalinca_gorusme_baslar_bekleme_de_sayilir():
    # Ortanca ilk ölçümle eşiği aşar; 60 sn kesintisiz üstte kalınca görüşme başlar ve o dakika görüşmeye sayılır.
    salon = Salon().gecir(60.0, AYSE_MEHMET)

    assert list(salon.alan.birlikte_ciftler()) == ["2-3"]
    assert salon.alan.kenarlar.dakika == {("k1", "k2"): 1.0}
    assert salon.alan.kenarlar.sure == {"k1": 1.0, "k2": 1.0}
    assert salon.alan.kenarlar.karma == {"k1": 1.0, "k2": 1.0}  # yatırımcı ↔ girişimci


def test_ayrilan_cift_on_bes_saniye_sonra_biter_sure_ayrilmaya_kadar_isler():
    salon = Salon().gecir(120.0, AYSE_MEHMET)
    # Ayrıldılar: 10 sn ortancası 5 sn sonra eşiğin altına iner, 15 sn sonra görüşme biter.
    salon.gecir(19.5, {("2", "3"): UZAK})
    hala = dict(salon.alan.birlikte_ciftler())
    salon.gecir(0.5, {("2", "3"): UZAK})

    assert list(hala) == ["2-3"]
    assert salon.alan.birlikte_ciftler() == {}
    assert salon.alan.biten == 1
    assert salon.alan.kenarlar.dakika[("k1", "k2")] == pytest.approx(140.0 / 60)


def test_kart_susarsa_gorusmesi_yirmi_bes_saniye_sonra_biter():
    # Son ölçüm 10 sn daha pencerede kalır; sonra çift duyulmuyor = eşik altında sayılır, 15 sn sonra biter.
    salon = Salon().gecir(60.0, AYSE_MEHMET).gecir(24.5, sessiz={"3"})
    hala = list(salon.alan.birlikte_ciftler())
    salon.gecir(0.5, sessiz={"3"})

    assert hala == ["2-3"]
    assert salon.alan.birlikte_ciftler() == {}
    assert salon.alan.biten == 1


def test_misafirle_gorusme_karma_sayilmaz():
    salon = Salon().gecir(60.0, {("2", "4"): YAKIN})

    assert salon.alan.kenarlar.karma == {}
    assert salon.alan.kenarlar.sure == {"k1": 1.0, "k3": 1.0}


def test_esik_degisince_karar_yeni_esikle_verilir():
    salon = Salon()
    salon.alan.esik = -50.0  # −55 artık eşiğin altında

    salon.gecir(90.0, AYSE_MEHMET)

    assert salon.alan.birlikte_ciftler() == {}


def test_alici_kopukken_sayaclar_donar_gorusme_surer():
    salon = Salon().gecir(60.0, AYSE_MEHMET)

    salon.gecir(20.0, alici_kopuk=True)

    assert list(salon.alan.birlikte_ciftler()) == ["2-3"]
    assert salon.alan.kenarlar.dakika[("k1", "k2")] == 1.0  # kopukken süre birikmez
    assert salon.alan.gecen_sn == 80.0  # etkinlik saati işler
    assert salon.alan.sinyal.alici_yasi(salon.t) == 20.0


def test_dinleyici_cihaz_hicbir_gorusmeye_girmez():
    salon = Salon().gecir(90.0, {("2", "101"): YAKIN})

    assert salon.alan.birlikte_ciftler() == {}
    assert "101" not in salon.alan.sahnedeki_kartlar()


# --- sahnedeki kartlar ---

def test_atanmamis_kart_ilk_gorusmesinden_sonra_sahneye_cikar():
    salon = Salon().gecir(59.5, {("3", "14"): YAKIN})
    once = salon.alan.sahnedeki_kartlar()
    salon.gecir(0.5, {("3", "14"): YAKIN})

    assert once == ["2", "3", "4", "5"]
    assert salon.alan.sahnedeki_kartlar() == ["2", "3", "4", "5", "14"]
    assert salon.alan.kenarlar.dakika == {("k2", "kart:14"): 1.0}


# --- bildirimler ---

def test_anlasma_yildiza_gore_sureden_sonra_bir_kez_duser():
    # ★★★ yatırımcı ile girişimci: 8 dk (mock tablosu; bekleme dakikası dahil).
    salon = Salon().gecir(479.5, AYSE_MEHMET)
    once = turler(salon.alan)
    salon.gecir(120.0, AYSE_MEHMET)

    assert once == []
    assert turler(salon.alan) == ["deal"]
    (anlasma,) = salon.alan.bildirimler
    assert (anlasma.severity, anlasma.title, anlasma.people) == ("deal", "Potansiyel anlaşma", ("2", "3"))
    assert anlasma.detail == "Ayşe Demir (★★★) ile Nova Robotik 8 dakikadır birlikte."
    assert salon.alan.anlasmalar == {("k1", "k2")}


def test_iki_yildizli_yatirimcida_anlasma_on_bir_dakika_surer():
    salon = Salon().gecir(659.5, {("3", "5"): YAKIN})
    once = turler(salon.alan).count("deal")
    salon.gecir(0.5, {("3", "5"): YAKIN})

    assert (once, turler(salon.alan).count("deal")) == (0, 1)


def test_misafirle_anlasma_olmaz():
    salon = Salon().gecir(900.0, {("2", "4"): YAKIN})

    assert "deal" not in turler(salon.alan)


def test_anlasma_suresi_zorlanabilir():
    salon = Salon(anlasma_sn=90).gecir(90.0, {("2", "4"): YAKIN})  # zorlanınca rol de aranmaz (mock)

    assert turler(salon.alan) == ["deal"]


def test_anlasma_sonrasi_yeniden_bir_araya_gelince_bildirim_duser():
    salon = Salon().gecir(480.0, AYSE_MEHMET).gecir(30.0, {("2", "3"): UZAK})

    # Ortanca 5,5 sn sonra eşiği yeniden aşar, sonra bir dakika beklenir.
    salon.gecir(70.0, AYSE_MEHMET)

    assert turler(salon.alan) == ["deal", "repeat"]
    tekrar = salon.alan.bildirimler[-1]
    assert (tekrar.severity, tekrar.title) == ("deal", "Yeniden bir arada")
    assert tekrar.detail == "Ayşe Demir ile Nova Robotik anlaşma sonrası tekrar bir araya geldi."
    assert len(salon.alan.anlasmalar) == 1  # aynı çiftle ikinci "deal" yok


def test_bir_dakika_duyulmayan_kart_icin_ciddi_bildirim_bir_kez_duser():
    salon = Salon().gecir(5.0).gecir(59.5, sessiz={"4"})
    once = turler(salon.alan)
    salon.gecir(30.0, sessiz={"4"})

    assert once == []
    assert turler(salon.alan) == ["lost"]
    (kayip,) = salon.alan.bildirimler
    assert (kayip.severity, kayip.title, kayip.people) == ("serious", "Kart sinyali kesildi", ("4",))
    assert kayip.detail == "Zeynep Şahin (kart 4) 1 dk'dır duyulmuyor."


def test_kayip_kart_yeniden_duyulursa_sonra_yine_bildirilebilir():
    salon = Salon().gecir(5.0).gecir(60.0, sessiz={"4"}).gecir(5.0).gecir(60.0, sessiz={"4"})

    assert turler(salon.alan) == ["lost", "lost"]


def test_onemli_yatirimci_alti_dakika_yalniz_kalinca_uyari_bir_kez_duser():
    salon = Salon().gecir(359.5)
    once = turler(salon.alan)
    salon.gecir(0.5)
    tam_altinci_dakika = turler(salon.alan)
    salon.gecir(60.0)

    assert (once, tam_altinci_dakika) == ([], ["idle_investor"])
    assert turler(salon.alan) == ["idle_investor"]  # bir kez; yalnız ★★★ Ayşe, ★★ Emre değil
    (uyari,) = salon.alan.bildirimler
    assert (uyari.severity, uyari.title, uyari.people) == ("warn", "Önemli yatırımcı yalnız", ("2",))
    assert uyari.detail == "Ayşe Demir (★★★) 6 dk'dır kimseyle görüşmüyor."


def test_gorunmeyen_yatirimci_yalniz_sayilmaz():
    salon = Salon().gecir(420.0, sessiz={"2"})

    assert "idle_investor" not in turler(salon.alan)


def test_bosta_kalma_suresi_gorusmede_sifirlanir():
    salon = Salon().gecir(30.0)
    bosta = salon.alan.bosta_sn("3")
    salon.gecir(60.0, AYSE_MEHMET)

    assert bosta == 30.0
    assert salon.alan.bosta_sn("3") == 0.0
    assert salon.alan.bosta_sn("4") == 90.0


def test_otuz_saniyedir_duyulmayan_kisi_bosta_sayilmaz():
    salon = Salon().gecir(5.0).gecir(29.5, sessiz={"4"})
    gorunurken = salon.alan.bosta_sn("4")
    salon.gecir(0.5, sessiz={"4"})

    assert gorunurken == 34.5
    assert salon.alan.bosta_sn("4") == 0.0  # 30 sn duyulmadı: "görünmüyor", boşta sayılmaz


def test_bildirimin_zamani_ve_saati_duvar_saatinden():
    salon = Salon().gecir(5.0).gecir(60.0, sessiz={"4"})

    (kayip,) = salon.alan.bildirimler

    assert kayip.t == salon.duvar  # duyulmama 60 sn'ye ulaştığı tikte
    assert len(kayip.clock) == 5 and kayip.clock[2] == ":"


# --- sıfırlama ---

def test_sifirlama_sureleri_bildirimleri_ve_saati_siler_kisileri_ve_esigi_tutar():
    salon = Salon().gecir(600.0, AYSE_MEHMET)
    salon.alan.esik = -70.0

    salon.alan.sifirla()

    alan = salon.alan
    assert (alan.kenarlar.dakika, alan.bildirimler, alan.anlasmalar, alan.biten) == ({}, [], set(), 0)
    assert alan.birlikte_ciftler() == {}
    assert alan.gecen_sn == 0.0
    assert alan.esik == -70.0
    assert alan.sahnedeki_kartlar() == ["2", "3", "4", "5"]
    assert alan.bosta_sn("2") == 0.0


def test_sifirlamadan_sonra_gorusme_yeniden_bir_dakika_bekler():
    salon = Salon().gecir(120.0, AYSE_MEHMET)
    salon.alan.sifirla()

    salon.gecir(59.5, AYSE_MEHMET)
    once = dict(salon.alan.birlikte_ciftler())
    salon.gecir(0.5, AYSE_MEHMET)

    assert once == {}
    assert list(salon.alan.birlikte_ciftler()) == ["2-3"]
    assert salon.alan.gecen_sn == 60.0


def test_ilk_tikte_etkinlik_saati_baslangictan_sayilir():
    alan = Alan(KisiDefteri(), baslangic=None)  # kayıt kaynağı: başlangıç bilinmiyor → ilk tik 0

    alan.tik(tik_uret(37.0), 0.0)
    alan.tik(tik_uret(37.5), 0.0)

    assert alan.gecen_sn == 0.5
