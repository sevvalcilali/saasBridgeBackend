"""Karşılama masası uçları (PLAN B3, SUNUCUDAN_ISTENENLER §1–2, mock'un api/degisim/iade/iceaktar/saglamlik testleri)."""
import json

import pytest
from destek.salon import KADRO, YAKIN, tik_uret

from yakinlik.ayar import Ayar
from yakinlik.cekirdek.alan import Alan
from yakinlik.cekirdek.durum import Etkinlik
from yakinlik.cekirdek.kisi import KisiDefteri
from yakinlik.http.uygulama import uygulama_olustur
from yakinlik.motor import Motor
from yakinlik.saat import SahteSaat

KISI_ALANLARI = ["ad", "atananKart", "ayrildi", "kisiId", "kurum", "not", "renk", "rol", "yildiz"]


class BosKaynak:
    benzetim = None

    async def tikler(self):
        return
        yield


@pytest.fixture
def motor():
    alan = Alan(KisiDefteri.kadrodan(KADRO), baslangic=0.0)
    motor = Motor(BosKaynak(), alan, Etkinlik("Deneme", "alt", "tarih"), saat=SahteSaat(1e9))
    motor.isle(tik_uret(0.5))  # kart 2–5, 14 ve 101 alıcıya duyuldu
    return motor


@pytest.fixture
async def istemci(istemci_ac, dist, motor):
    async with istemci_ac(uygulama_olustur(Ayar(dist=dist), motor=motor)) as acik:
        yield acik


def gonder(istemci, yontem, yol, govde):
    # Mock testleri gövdeyi Content-Type başlığı olmadan yollar; sunucu yine JSON okumalı.
    icerik = govde if isinstance(govde, bytes) else json.dumps(govde).encode()
    return istemci.request(yontem, yol, content=icerik)


async def kisiler(istemci):
    return (await istemci.get("/api/people")).json()


async def pano(istemci):
    return {k["id"]: k for k in (await istemci.get("/state")).json()["people"]}


# --- kişi kayıt defteri ---

async def test_kisi_listesi_alan_alan_ve_kadro_kartli(istemci):
    liste = await kisiler(istemci)

    assert [sorted(k) for k in liste] == [KISI_ALANLARI] * 4
    assert liste[0] == {"kisiId": "k1", "ad": "Ayşe Demir", "rol": "investor", "kurum": "Atlas Ventures",
                        "yildiz": 3, "not": "", "renk": "#3987e5", "atananKart": "2", "ayrildi": False}


async def test_yeni_kisi_kartsiz_kayitta_var_panoda_yok(istemci):
    yanit = await gonder(istemci, "POST", "/api/people", {"ad": "Yeni Kişi", "rol": "founder", "kurum": "Test A.Ş."})

    kisi = yanit.json()
    assert yanit.status_code == 200
    assert (kisi["kisiId"], kisi["ad"], kisi["atananKart"], kisi["ayrildi"]) == ("k5", "Yeni Kişi", None, False)
    assert len(await kisiler(istemci)) == 5
    assert "Yeni Kişi" not in [k["name"] for k in (await pano(istemci)).values()]


@pytest.mark.parametrize("govde", [{"ad": 5}, {"ad": "   "}, {"rol": "guest"}, b"{bozuk", b"", [], {"ad": None}])
async def test_adsiz_ya_da_bozuk_kisi_400(istemci, govde):
    yanit = await gonder(istemci, "POST", "/api/people", govde)

    assert (yanit.status_code, yanit.json()["ok"]) == (400, False)
    assert len(await kisiler(istemci)) == 4


async def test_metin_olmayan_kurum_yok_sayilir_gecersiz_rol_misafir(istemci):
    kisi = (await gonder(istemci, "POST", "/api/people", {"ad": "Deneme", "kurum": 5, "not": {}, "rol": "uydurma"})).json()

    assert (kisi["kurum"], kisi["not"], kisi["rol"]) == ("", "", "guest")


async def test_duzenleme_hemen_panoya_yansir_renk_degismez(istemci):
    once = (await kisiler(istemci))[1]  # Mehmet, kart 3

    yanit = await gonder(istemci, "PATCH", "/api/people/k2", {"ad": "Yeni Ad", "rol": "investor", "yildiz": 9, "renk": "#000000"})

    kisi = yanit.json()
    assert yanit.status_code == 200
    assert (kisi["ad"], kisi["rol"], kisi["yildiz"], kisi["renk"]) == ("Yeni Ad", "investor", 5, once["renk"])
    panodaki = (await pano(istemci))["3"]
    assert (panodaki["name"], panodaki["role"], panodaki["stars"]) == ("Yeni Ad", "investor", "★★★★★")


async def test_olmayan_kisi_duzenlenemez_silinemez(istemci):
    assert (await gonder(istemci, "PATCH", "/api/people/yok", {"ad": "x"})).status_code == 404
    assert (await istemci.delete("/api/people/yok")).status_code == 404


async def test_silinen_kisinin_karti_bosa_cikar(istemci):
    yanit = await istemci.delete("/api/people/k2")

    assert (yanit.status_code, yanit.json()) == (200, {"ok": True})
    assert "k2" not in [k["kisiId"] for k in await kisiler(istemci)]
    assert "3" not in await pano(istemci)


# --- CSV ---

async def test_csv_ile_toplu_yukleme(istemci):
    csv = "Ad;Soyad;Rol;Kurum;Yıldız\r\nDeniz;Aksoy;Yatırımcı;Ege Girişim;4\r\nOya;Er;Bilinmez;X;1\r\n"

    yanit = await istemci.post("/api/people/import", content=csv.encode(), headers={"Content-Type": "text/csv; charset=utf-8"})

    assert yanit.status_code == 200
    assert yanit.json() == {"eklenen": 1, "atlanan": [{"satir": 3, "sebep": 'rol anlaşılamadı: "Bilinmez"'}]}
    assert (await kisiler(istemci))[-1]["ad"] == "Deniz Aksoy"


@pytest.mark.parametrize("govde", [b"", b"\xef\xbb\xbf  \n", b"\xff\xfe bozuk"])
async def test_bos_ya_da_utf8_olmayan_csv_400(istemci, govde):
    yanit = await istemci.post("/api/people/import", content=govde)

    assert (yanit.status_code, yanit.json()["ok"]) == (400, False)


# --- kart verme / iade ---

async def test_kart_verilince_kisi_hemen_panoda(istemci):
    kisi = (await gonder(istemci, "POST", "/api/people", {"ad": "Yeni Kişi", "rol": "founder"})).json()

    yanit = await gonder(istemci, "POST", "/api/assign", {"kisiId": kisi["kisiId"], "kart": "77"})

    assert (yanit.status_code, yanit.json()) == (200, {"ok": True})
    assert (await kisiler(istemci))[-1]["atananKart"] == "77"
    assert ((await pano(istemci))["77"]["name"], (await pano(istemci))["77"]["role"]) == ("Yeni Kişi", "founder")


async def test_dolu_karta_atama_eski_sahibi_kartsiz_birakir(istemci):
    kisi = (await gonder(istemci, "POST", "/api/people", {"ad": "Yeni Kişi", "rol": "guest"})).json()

    await gonder(istemci, "POST", "/api/assign", {"kisiId": kisi["kisiId"], "kart": "3"})

    mehmet = next(k for k in await kisiler(istemci) if k["kisiId"] == "k2")
    assert (mehmet["atananKart"], mehmet["ayrildi"]) == (None, False)
    assert (await pano(istemci))["3"]["name"] == "Yeni Kişi"


async def test_olmayan_kisiye_kart_verilemez(istemci):
    yanit = await gonder(istemci, "POST", "/api/assign", {"kisiId": "yok", "kart": "50"})

    assert (yanit.status_code, yanit.json()["ok"]) == (404, False)


@pytest.mark.parametrize("kart", ["105", "0", "abc", "", "1000", "0007", None, "7.0", True])
async def test_gecersiz_kart_numarasi_400(istemci, kart):
    yanit = await gonder(istemci, "POST", "/api/assign", {"kisiId": "k1", "kart": kart})

    assert (yanit.status_code, yanit.json()["ok"]) == (400, False)


@pytest.mark.parametrize(("kart", "beklenen"), [("007", "7"), (" 8 ", "8"), (9, "9")])
async def test_bastaki_sifir_ve_bosluk_atilir(istemci, kart, beklenen):
    await gonder(istemci, "POST", "/api/assign", {"kisiId": "k1", "kart": kart})

    assert (await kisiler(istemci))[0]["atananKart"] == beklenen


async def test_iade_kisiyi_ayrildi_yapar_panodan_dusurur(istemci):
    yanit = await gonder(istemci, "POST", "/api/unassign", {"kart": "3"})

    mehmet = (await kisiler(istemci))[1]
    assert (yanit.status_code, yanit.json()) == (200, {"ok": True})
    assert (mehmet["atananKart"], mehmet["ayrildi"]) == (None, True)
    assert "3" not in await pano(istemci)


async def test_geri_al_kisiyi_ayrilmis_saymaz(istemci):
    await gonder(istemci, "POST", "/api/unassign", {"kart": "3", "ayrildi": False})

    assert (await kisiler(istemci))[1]["ayrildi"] is False


async def test_kimsenin_olmayan_ama_duyulan_kart_iade_edilebilir(istemci):
    assert (await gonder(istemci, "POST", "/api/unassign", {"kart": "14"})).status_code == 200


async def test_hic_bilinmeyen_kart_iade_edilemez_gecersiz_numara_400(istemci):
    assert (await gonder(istemci, "POST", "/api/unassign", {"kart": "98"})).status_code == 404
    assert (await gonder(istemci, "POST", "/api/unassign", {"kart": "150"})).status_code == 400


async def test_gorusmedeki_kart_iade_edilince_gorusme_kapanir(istemci, motor):
    for i in range(130):
        motor.isle(tik_uret(1.0 + 0.5 * i, {("2", "3"): YAKIN}))
    assert (await istemci.get("/state")).json()["live"]

    await gonder(istemci, "POST", "/api/unassign", {"kart": "3"})

    durum = (await istemci.get("/state")).json()
    assert (durum["live"], durum["stats"]["done"]) == ([], 1)
    assert durum["people"][0]["status"] != "talking"


async def test_bilinmeyen_api_ucu_hala_404(istemci):
    assert (await istemci.post("/api/people/k1", content=b"{}")).status_code == 404
