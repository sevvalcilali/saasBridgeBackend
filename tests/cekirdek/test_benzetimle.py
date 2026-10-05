"""Benzetim + alan + durum birlikte (PLAN B2 kabulü, donanımsız): sahte salon 25 dakika boyunca işlenir."""
import json

import pytest

from yakinlik.cekirdek.alan import Alan
from yakinlik.cekirdek.durum import Etkinlik, durum_uret
from yakinlik.cekirdek.kisi import KisiDefteri
from yakinlik.giris.benzetim import Benzetim

ETKINLIK = Etkinlik("Deneme", "alt", "tarih")


@pytest.fixture(scope="module")
def kosu():
    """25 kişi, 25 benzetim dakikası, alıcı kopması açık. Her 10 sn'de bir /state anlık görüntüsü."""
    benzetim = Benzetim(kisi=25, tohum=11)
    alan = Alan(KisiDefteri.kadrodan(benzetim.kadro), baslangic=0.0)
    goruntuler = []
    for sira in range(3000):
        tik = benzetim.tik(0.5)
        alan.tik(tik, 1e9 + tik.t)
        if sira % 20 == 19:
            goruntuler.append(json.loads(json.dumps(durum_uret(alan, ETKINLIK, 1e9 + tik.t))))
    return alan, goruntuler, set(benzetim.masadaki)


def test_gorusmeler_olur_biter_ve_anlasma_cikar(kosu):
    _, goruntuler, _ = kosu
    son = goruntuler[-1]

    assert max(len(g["live"]) for g in goruntuler) >= 3
    assert son["stats"]["done"] > 0
    assert son["stats"]["deals"] >= 1 and any(b["kind"] == "deal" for b in son["alerts"])
    assert son["stats"]["mixedMin"] > 0


def test_kayip_kart_bildirilir(kosu):
    _, goruntuler, _ = kosu

    kayiplar = [b for b in goruntuler[-1]["alerts"] if b["kind"] == "lost"]

    assert len(kayiplar) == 1  # 180. sn'de susan kart, 1 dk sonra


def test_alici_kopmasinda_alici_yasi_buyur(kosu):
    _, goruntuler, _ = kosu

    yaslar = [g["receiverAge"] for g in goruntuler]

    assert max(yaslar) > 5  # 120. sn'den itibaren 20 sn
    assert yaslar[-1] < 5


def test_atanmamis_kart_ilk_gorusmesinden_sonra_kisilerde(kosu):
    _, goruntuler, _ = kosu
    kart14_goruldu = [g["elapsed"] for g in goruntuler if any(k["id"] == "14" for k in g["people"])]

    assert kart14_goruldu, "Kart 14 hiç görüşmeye girmedi"
    ilk = kart14_goruldu[0]
    assert ilk > 45 + 60  # salona 45. sn'de girer; panoya en erken bir dakikalık görüşmeden sonra çıkar
    assert all(any(k["id"] == "14" for k in g["people"]) for g in goruntuler if g["elapsed"] >= ilk)


def test_her_anlik_goruntu_tutarli(kosu):
    _, goruntuler, masadaki = kosu

    for g in goruntuler:
        kisiler = {k["id"]: k for k in g["people"]}
        assert len(kisiler) == len(g["people"])
        assert g["stats"]["livePairs"] == len(g["live"])
        for cift in g["live"]:
            for kart in (cift["a"], cift["b"]):
                assert kisiler[kart]["status"] in ("talking", "away")
        for kenar in g["edges"]:
            assert kenar["a"] in kisiler and kenar["b"] in kisiler and kenar["min"] > 0
        for kart in kisiler:
            assert 1 <= int(kart) <= 99
        assert not set(kisiler) & masadaki  # masadaki yedek kartlar panoda görünmez


def test_kisi_suresi_kenar_dakikalarinin_toplami(kosu):
    alan, _, _ = kosu

    for kimlik, sure in alan.kenarlar.sure.items():
        kenar_toplami = sum(dk for cift, dk in alan.kenarlar.dakika.items() if kimlik in cift)
        assert sure == pytest.approx(kenar_toplami)
