"""/state nesnesi (PLAN B2.3, brief §5.1): alan alan mock'un durumUret() çıktısıyla aynı biçim."""
import json
import re

import pytest
from destek.salon import YAKIN, Salon

from yakinlik.cekirdek.durum import Etkinlik, durum_uret, js_yuvarla

ETKINLIK = Etkinlik(ad="Deneme Buluşması", alt_baslik="Yakınlık kartları", tarih="05.10.2026 · Salon")
AYSE_MEHMET = {("2", "3"): YAKIN}


def durum(salon):
    # JSON'dan geçir: arayüze giden biçim bu (tuple → liste, None → null).
    return json.loads(json.dumps(durum_uret(salon.alan, ETKINLIK, salon.duvar)))


def kisi(d, kart):
    return next(k for k in d["people"] if k["id"] == kart)


def test_alanlar_mock_ile_birebir_ve_yalniz_bosta_kalma_suresi_ek():
    d = durum(Salon().gecir(70.0, AYSE_MEHMET))

    assert sorted(d) == [
        "alerts", "chartSeconds", "clock", "edges", "elapsed", "event", "history",
        "live", "people", "receiverAge", "rules", "signals", "stats", "threshold",
    ]
    for k in d["people"]:
        assert sorted(k) == [
            "color", "id", "idleSinceS", "invMin", "invPeers", "live", "min", "name", "org",
            "role", "seenAgo", "stars", "status", "tier", "withName",
        ]
    assert [sorted(c) for c in d["live"]] == [["a", "b", "real", "rssi"]]
    assert [sorted(e) for e in d["edges"]] == [["a", "b", "min"]]
    assert sorted(d["stats"]) == ["deals", "done", "founders", "livePairs", "mixedMin", "reached"]
    assert sorted(d["event"]) == ["date", "name", "progress", "sub"]
    assert [sorted(s) for s in d["signals"]] == [["a", "ab", "above", "b", "ba", "n", "together", "value"]]
    assert d["rules"] == {"dealAfterS": None}
    assert d["chartSeconds"] == 90


def test_gorusmedeki_cift_kisilerde_canli_ciftlerde_ve_istatistikte_tutarli():
    d = durum(Salon().gecir(60.0, AYSE_MEHMET))

    ayse, mehmet, zeynep = kisi(d, "2"), kisi(d, "3"), kisi(d, "4")
    assert (ayse["status"], ayse["withName"], ayse["live"]) == ("talking", "Nova Robotik", 1.0)  # girişimcide kurum adı
    assert (mehmet["status"], mehmet["withName"]) == ("talking", "Ayşe Demir")
    assert (zeynep["status"], zeynep["withName"], zeynep["live"]) == ("idle", "", 0)
    assert (ayse["min"], ayse["invMin"], ayse["invPeers"]) == (1.0, 1.0, 1)
    assert d["live"] == [{"a": "2", "b": "3", "real": True, "rssi": -55.0}]
    assert d["edges"] == [{"a": "2", "b": "3", "min": 1.0}]
    assert d["stats"] == {"done": 0, "livePairs": 1, "mixedMin": 1.0, "deals": 0, "reached": 1, "founders": 1}
    assert d["signals"] == [
        {"a": "2", "b": "3", "ab": -55.0, "ba": -55.0, "value": -55.0, "n": 21, "above": True, "together": True},
    ]


def test_ayni_anda_birden_cok_gorusmede_sayilar_kisiye_gore():
    # Mehmet (girişimci) iki yatırımcıyla, Ayşe (yatırımcı) Mehmet'le ve bir misafirle birlikte.
    salon = Salon().gecir(30.0, AYSE_MEHMET)
    salon.gecir(60.0, {("2", "3"): YAKIN, ("3", "5"): YAKIN, ("2", "4"): YAKIN})
    d = durum(salon)

    ayse, mehmet, zeynep, emre = (kisi(d, k) for k in ("2", "3", "4", "5"))
    assert (mehmet["live"], mehmet["withName"]) == (1.5, "Ayşe Demir, Emre Yılmaz")  # en uzun görüşmesi
    assert ayse["withName"] == "Nova Robotik, Zeynep Şahin"
    assert [k["invPeers"] for k in (ayse, mehmet, zeynep, emre)] == [1, 2, 0, 1]  # yalnız karşı rol
    assert d["stats"] == {"done": 0, "livePairs": 3, "mixedMin": 2.5, "deals": 0, "reached": 1, "founders": 1}


def test_esik_ustu_ama_henuz_birlikte_degil_ayrimi_gorunur():
    # Kurulum ekranı "başlıyor…" durumunu above ∧ ¬together'dan çıkarır.
    d = durum(Salon().gecir(30.0, AYSE_MEHMET))

    (sinyal,) = d["signals"]
    assert (sinyal["above"], sinyal["together"]) == (True, False)
    assert d["live"] == []
    assert kisi(d, "2")["status"] == "idle"


def test_kisiler_rol_sirasiyla_yatirimci_girisimci_misafir():
    d = durum(Salon().gecir(60.0, {("3", "14"): YAKIN}))

    assert [k["id"] for k in d["people"]] == ["2", "5", "3", "4", "14"]


def test_atanmamis_kart_kart_n_adiyla_misafir_olarak_gorunur():
    d = durum(Salon().gecir(60.0, {("3", "14"): YAKIN}))

    kart14 = kisi(d, "14")
    assert (kart14["name"], kart14["role"], kart14["org"], kart14["tier"], kart14["stars"]) == (
        "Kart 14", "guest", "", 0, "")
    assert re.fullmatch(r"#[0-9a-f]{6}", kart14["color"])
    assert kisi(d, "3")["withName"] == "Kart 14"


def test_kisi_bilgileri_kayit_defterinden():
    d = durum(Salon().gecir(1.0))

    ayse = kisi(d, "2")
    assert (ayse["name"], ayse["role"], ayse["org"], ayse["tier"], ayse["stars"]) == (
        "Ayşe Demir", "investor", "Atlas Ventures", 3, "★★★")
    assert [k["color"] for k in d["people"]] == ["#3987e5", "#c98500", "#d95926", "#199e70"]  # kadro sırasıyla palet


def test_duyulmayan_kart_gorunmuyor_hic_duyulmamis_kartta_sure_bos():
    d = durum(Salon().gecir(5.0).gecir(31.0, sessiz={"4"}).gecir(1.0, sessiz={"4", "5"}))

    assert (kisi(d, "4")["status"], kisi(d, "4")["seenAgo"]) == ("away", 32.0)
    salon = Salon().gecir(3.0, sessiz={"5"})
    d = durum(salon)
    assert (kisi(d, "5")["status"], kisi(d, "5")["seenAgo"]) == ("away", None)


def test_otuz_saniyeden_uzun_duyulmayan_kisi_gorunmuyor():
    salon = Salon().gecir(5.0).gecir(30.0, sessiz={"4"})
    tam_otuz = kisi(durum(salon), "4")["status"]
    salon.gecir(0.5, sessiz={"4"})

    assert tam_otuz == "idle"
    assert kisi(durum(salon), "4")["status"] == "away"


def test_dinleyici_cihaz_hicbir_listede_yok():
    d = durum(Salon().gecir(70.0, {("2", "101"): YAKIN, ("2", "3"): YAKIN}))

    metin = json.dumps({alan: d[alan] for alan in ("people", "edges", "live", "signals", "history")})
    assert "101" not in metin


def test_grafik_serisi_kac_saniye_once_ve_tek_ondalik():
    d = durum(Salon().gecir(10.0, AYSE_MEHMET))

    assert list(d["history"]) == ["2-3"]
    yaslar = [nokta[0] for nokta in d["history"]["2-3"]]
    assert yaslar == [8, 6, 4, 2, 0]  # en eski başta; 10 sn önceki ilk ölçüm yok (ilk ölçüm t=0,5)
    assert all(nokta[1] == -55.0 for nokta in d["history"]["2-3"])


def test_saat_gecen_sure_ve_alici_yasi():
    salon = Salon().gecir(90.0).gecir(7.0, alici_kopuk=True)
    d = durum(salon)

    assert d["elapsed"] == 97.0
    assert d["receiverAge"] == 7.0
    assert re.fullmatch(r"\d{2}:\d{2}:\d{2}", d["clock"])
    assert d["event"] == {"name": "Deneme Buluşması", "sub": "Yakınlık kartları", "date": "05.10.2026 · Salon",
                          "progress": pytest.approx(97.0 / (180 * 60))}
    assert d["threshold"] == -72


def test_ilk_tikten_once_de_gecerli_bos_durum():
    d = durum(Salon())

    assert (d["elapsed"], d["receiverAge"], d["signals"], d["live"], d["edges"]) == (0.0, None, [], [], [])
    assert [k["status"] for k in d["people"]] == ["away"] * 4


def test_bildirimler_en_eski_basta_alan_alan():
    d = durum(Salon().gecir(5.0).gecir(60.0, sessiz={"4"}))

    (bildirim,) = d["alerts"]
    assert sorted(bildirim) == ["clock", "detail", "kind", "kisiler", "kural", "people", "severity", "t", "title"]
    assert (bildirim["people"], bildirim["kisiler"]) == (["4"], ["k3"])  # kart değişse de doğru kişi (Soru 7)
    assert re.fullmatch(r"\d{2}:\d{2}", bildirim["clock"])


def test_kalan_bosta_suresi_saniye():
    d = durum(Salon().gecir(30.0))

    assert kisi(d, "2")["idleSinceS"] == 30.0


@pytest.mark.parametrize(
    ("deger", "basamak", "beklenen"),
    [(0.125, 2, 0.13), (2.5, 0, 3), (-52.25, 1, -52.2), (-0.5, 0, 0)],
)
def test_yuvarlama_mock_gibi_bucuk_yukari(deger, basamak, beklenen):
    # JavaScript Math.round: buçuk +∞ yönüne. Python round() buçuğu çifte yuvarlar (0,125 → 0,12).
    assert js_yuvarla(deger, basamak) == beklenen
