"""Sinyal işleme (PLAN B1.5): çift ölçümü, 10 sn ortancası, grafik serisi, son duyulma. Zaman elle verilir."""
import pytest

from yakinlik.cekirdek.sinyal import SinyalDeposu
from yakinlik.giris.paket import Paket


def paket(kart, t, *duyulanlar):
    return Paket(kart=kart, duyulanlar=tuple(duyulanlar), pil=None, t=t)


def tek_yonlu(depo, olcumler):
    """7, 12'yi duyuyor: (t, dBm) çiftlerini sırayla ekler."""
    for t, rssi in olcumler:
        depo.ekle([paket("7", t, ("12", rssi))])


# --- ölçüm ---

def test_cift_kucuk_numara_once_yazilir_yon_ona_gore_belirlenir():
    depo = SinyalDeposu()
    depo.ekle([paket("12", 1.0, ("7", -60.0))])  # 12, 7'yi duyuyor → çift "7-12", b'nin a'yı duyması

    (sinyal,) = depo.sinyaller(simdi=1.0)

    assert (sinyal.a, sinyal.b) == ("7", "12")  # sayıyla karşılaştırma: metin olarak "12" < "7" olurdu
    assert (sinyal.ab, sinyal.ba) == (None, -60.0)


def test_iki_yon_ayni_tikte_gelirse_tek_olcum_olur_deger_ortalamadir():
    depo = SinyalDeposu()
    depo.ekle([paket("7", 1.0, ("12", -50.0)), paket("12", 1.0, ("7", -60.0))])

    (sinyal,) = depo.sinyaller(simdi=1.0)

    assert (sinyal.ab, sinyal.ba) == (-50.0, -60.0)
    assert (sinyal.son, sinyal.value, sinyal.n) == (-55.0, -55.0, 1)


def test_tek_yonlu_olcumde_eksik_yon_bos_deger_gelen_yondur():
    depo = SinyalDeposu()
    depo.ekle([paket("7", 1.0, ("12", -50.0))])

    (sinyal,) = depo.sinyaller(simdi=1.0)

    assert (sinyal.ab, sinyal.ba, sinyal.value) == (-50.0, None, -50.0)


def test_kartin_kendini_duymasi_olcum_sayilmaz():
    depo = SinyalDeposu()
    depo.ekle([paket("7", 1.0, ("7", -30.0))])

    assert depo.sinyaller(simdi=1.0) == []


# --- 10 sn penceresi ve ortanca ---

def test_pencere_son_10_saniyedir_sinir_dahil():
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -80.0), (0.5, -70.0), (10.0, -60.0)])

    (tam_onda,) = depo.sinyaller(simdi=10.0)  # 0.0'daki ölçüm tam 10 sn önce: dahil
    (on_bucukta,) = depo.sinyaller(simdi=10.5)  # artık pencere dışında

    assert tam_onda.n == 3
    assert on_bucukta.n == 2


@pytest.mark.parametrize(
    ("degerler", "ortanca"),
    [
        ([-70.0, -50.0, -60.0], -60.0),
        ([-60.0, -50.0], -50.0),  # çift sayıda ölçüm: mock gibi iki ortadakinin büyüğü
        ([-80.0, -50.0, -60.0, -70.0], -60.0),
    ],
)
def test_deger_penceredeki_olcumlerin_ortancasidir(degerler, ortanca):
    depo = SinyalDeposu()
    tek_yonlu(depo, [(i * 0.5, deger) for i, deger in enumerate(degerler)])

    (sinyal,) = depo.sinyaller(simdi=len(degerler) * 0.5)

    assert sinyal.value == ortanca


def test_yonler_ve_son_deger_son_olcumden_ortanca_pencereden_gelir():
    depo = SinyalDeposu()
    depo.ekle([paket("7", 0.0, ("12", -80.0)), paket("12", 0.0, ("7", -82.0))])  # değer −81
    depo.ekle([paket("7", 0.5, ("12", -79.0))])  # değer −79
    depo.ekle([paket("7", 1.0, ("12", -50.0)), paket("12", 1.0, ("7", -54.0))])  # değer −52

    (sinyal,) = depo.sinyaller(simdi=1.0)

    assert (sinyal.ab, sinyal.ba, sinyal.son) == (-50.0, -54.0, -52.0)
    assert sinyal.value == -79.0


def test_10_saniyedir_duyulmayan_cift_sinyallerde_ve_grafikte_yoktur():
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -50.0)])

    assert depo.sinyaller(simdi=10.5) == []
    assert depo.gecmis(simdi=10.5) == {}


# --- grafik serisi (history) ---

def test_grafik_2_saniyelik_kovalarin_ortancasidir_en_eski_basta():
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -80.0), (1.0, -70.0), (3.0, -60.0), (9.0, -52.0), (9.5, -50.0), (10.0, -54.0)])

    # (kaç sn önce, dBm): 10 sn önceki kova, 8, 6 ve şimdiki kova (−54, −52, −50 → ortanca −52)
    assert depo.gecmis(simdi=10.0) == {"7-12": [(10, -80.0), (8, -70.0), (6, -60.0), (0, -52.0)]}


def test_grafik_son_90_saniyeyi_kapsar_sinir_dahil():
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -80.0), (0.5, -70.0), (90.0, -50.0)])

    assert depo.gecmis(simdi=90.0)["7-12"] == [(90, -80.0), (88, -70.0), (0, -50.0)]
    assert depo.gecmis(simdi=90.5)["7-12"] == [(90, -70.0), (0, -50.0)]


# --- dinleyici cihazlar (100+) ---

def test_dinleyici_cihazlar_cift_olusturmaz():
    depo = SinyalDeposu()
    depo.ekle([
        paket("100", 1.0, ("7", -50.0)),  # dinleyici bir kişi kartını duyuyor
        paket("7", 1.0, ("100", -50.0)),  # kişi kartı dinleyiciyi duyuyor
    ])

    assert depo.sinyaller(simdi=1.0) == []
    assert depo.gecmis(simdi=1.0) == {}


# --- son duyulma ---

def test_gorulme_yasi_kartin_kendi_son_paketinden_beri_gecen_suredir():
    depo = SinyalDeposu()
    depo.ekle([paket("7", 2.0, ("12", -50.0))])  # 12 yalnız duyuldu, kendi paketi gelmedi
    depo.ekle([paket("100", 3.0)])

    assert depo.gorulme_yasi("7", simdi=5.0) == 3.0
    assert depo.gorulme_yasi("12", simdi=5.0) is None  # başkasının duyması "görüldü" sayılmaz
    assert depo.gorulme_yasi("100", simdi=5.0) == 2.0  # dinleyici de izlenir (/api/cards için)


def test_alici_yasi_herhangi_bir_karttan_gelen_son_paketten_beridir():
    depo = SinyalDeposu()

    assert depo.alici_yasi(simdi=4.0) is None  # alıcıdan hiç veri gelmedi

    depo.ekle([paket("7", 2.0), paket("9", 3.0)])

    assert depo.alici_yasi(simdi=4.0) == 1.0


# --- unutma ---

def test_30_saniyeden_uzun_duyulmayan_cift_unutulur():
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -80.0)])
    depo.unut(simdi=30.5)
    tek_yonlu(depo, [(40.0, -50.0)])

    assert depo.gecmis(simdi=40.0)["7-12"] == [(0, -50.0)]  # eski ölçüm grafiğe geri gelmez


def test_tam_30_saniyedir_duyulmayan_cift_henuz_unutulmaz():
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -80.0)])
    depo.unut(simdi=30.0)
    tek_yonlu(depo, [(40.0, -50.0)])

    assert depo.gecmis(simdi=40.0)["7-12"] == [(40, -80.0), (0, -50.0)]


def test_korunan_cift_duyulmasa_da_unutulmaz():
    # "Birlikte" sayılan çift (B2) ölçüm gelmese de silinmemeli; çağıran onu korunan olarak verir.
    depo = SinyalDeposu()
    tek_yonlu(depo, [(0.0, -80.0)])
    depo.unut(simdi=60.0, korunan={"7-12"})
    tek_yonlu(depo, [(70.0, -50.0)])

    assert depo.gecmis(simdi=70.0)["7-12"] == [(70, -80.0), (0, -50.0)]


def test_eski_olcumler_bellekte_birikmez():
    depo = SinyalDeposu()
    for i in range(1200):  # 10 dakika boyunca tik başına bir ölçüm
        t = i * 0.5
        tek_yonlu(depo, [(t, -50.0)])
        depo.unut(simdi=t)

    assert depo.olcum_sayisi <= 200  # yalnız grafiğin gerektirdiği son ~95 sn tutulur
