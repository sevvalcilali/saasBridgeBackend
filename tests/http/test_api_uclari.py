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

KISI_ALANLARI = sorted(["ad", "atananKart", "ayrildi", "kisiId", "kurum", "not", "renk", "rol", "yildiz",
                        "sektor", "asama", "tanitim", "web", "eposta", "paylasim"])


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
                        "yildiz": 3, "not": "", "renk": "#3987e5", "atananKart": "2", "ayrildi": False,
                        "sektor": "", "asama": "", "tanitim": "", "web": "", "eposta": "", "paylasim": False}


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


# --- kartlar (B4) ---

async def test_kart_listesi_alicinin_duydugu_butun_kartlar(istemci, motor):
    motor.isle(tik_uret(1.0))
    yanit = await istemci.get("/api/cards")

    kartlar = {k["kart"]: k for k in yanit.json()}
    assert yanit.status_code == 200
    assert [sorted(k) for k in kartlar.values()] == [["atanan", "kart", "rssiAlici", "seenAgo"]] * 6  # pil yok
    assert list(kartlar) == ["2", "3", "4", "5", "14", "101"]  # numara sırasıyla; dinleyici de (arayüz eler)
    assert (kartlar["2"]["atanan"], kartlar["14"]["atanan"], kartlar["101"]["atanan"]) == ("k1", None, None)
    assert kartlar["2"]["seenAgo"] == 0.0


async def test_kart_listesi_atamayi_hemen_gosterir(istemci):
    kisi = (await gonder(istemci, "POST", "/api/people", {"ad": "Yeni", "rol": "guest"})).json()
    await gonder(istemci, "POST", "/api/assign", {"kisiId": kisi["kisiId"], "kart": "14"})
    await gonder(istemci, "POST", "/api/unassign", {"kart": "2"})

    kartlar = {k["kart"]: k for k in (await istemci.get("/api/cards")).json()}

    assert (kartlar["14"]["atanan"], kartlar["2"]["atanan"]) == (kisi["kisiId"], None)  # iade edilen kart boşta


async def test_bes_dakikadir_duyulmayan_bos_kart_listeden_duser_atanmis_kart_kalir(istemci, motor):
    motor.isle(tik_uret(301.0, sessiz={"3", "14"}))  # kart 3 (atanmış) ve 14 (boş) 5 dk'dır duyulmuyor

    kartlar = {k["kart"]: k for k in (await istemci.get("/api/cards")).json()}

    assert "14" not in kartlar  # kapanmış / kaybolmuş boş kart kart sağlığını kirletmesin
    assert kartlar["3"]["seenAgo"] == 300.5  # atanmış kart kalır: kayıp kart uyarısı bunu kullanır


# --- görüşme kayıtları, atama geçmişi (B5) ---

async def test_gorusme_kayitlari_alan_alan(istemci, motor):
    for i in range(140):
        motor.isle(tik_uret(1.0 + 0.5 * i, {("2", "3"): YAKIN}))

    kayitlar = (await istemci.get("/api/sessions")).json()

    assert kayitlar == [{"a": "k1", "b": "k2", "start": 0.5, "end": None}]


async def test_atama_gecmisi_zaman_damgali(istemci):
    kisi = (await gonder(istemci, "POST", "/api/people", {"ad": "Yeni", "rol": "guest"})).json()
    await gonder(istemci, "POST", "/api/assign", {"kisiId": kisi["kisiId"], "kart": "40"})
    await gonder(istemci, "POST", "/api/unassign", {"kart": "40", "ayrildi": False})

    gecmis = (await istemci.get("/api/assignments")).json()

    assert [(g["kisiId"], g["kart"], g["islem"]) for g in gecmis] == [("k5", "40", "ata"), ("k5", "40", "geri_al")]
    assert all(sorted(g) == ["islem", "kart", "kisiId", "t"] and g["t"] == 1e9 for g in gecmis)


async def test_profil_alanlari_eklenir_duzenlenir_listede_doner(istemci):
    yanit = await gonder(istemci, "POST", "/api/people", {
        "ad": "Can", "rol": "founder", "sektor": "Sağlık", "asama": "mvp", "tanitim": "Evde tahlil",
        "web": "nova.com", "eposta": "can@nova.com", "paylasim": True,
    })
    kisi_id = yanit.json()["kisiId"]
    await gonder(istemci, "PATCH", f"/api/people/{kisi_id}", {"asama": "gelir", "paylasim": False})
    (kisi,) = [k for k in (await istemci.get("/api/people")).json() if k["kisiId"] == kisi_id]

    assert {k: kisi[k] for k in ("sektor", "asama", "tanitim", "web", "eposta", "paylasim")} == {
        "sektor": "Sağlık", "asama": "gelir", "tanitim": "Evde tahlil", "web": "nova.com", "eposta": "can@nova.com",
        "paylasim": False}


# --- uyarı kuralları (Şevval isteği 2026-10-06) ---

KURAL = {"ad": "Ayşe & Mehmet", "kim": {"kisiler": ["k1"]}, "kiminle": {"kisiler": ["k2"]}, "dakika": 0}


async def test_kural_eklenir_listelenir_kapatilir_silinir(istemci):
    eklenen = await gonder(istemci, "POST", "/api/rules", KURAL)
    grup = await gonder(istemci, "POST", "/api/rules", {"kim": {"rol": "investor", "enAzYildiz": 4}, "kiminle": {"rol": "founder"}, "dakika": 5})
    kapali = await gonder(istemci, "PATCH", "/api/rules/r1", {"acik": False})
    liste = (await istemci.get("/api/rules")).json()
    silindi = await gonder(istemci, "DELETE", "/api/rules/r1", {})
    sonra = (await istemci.get("/api/rules")).json()

    assert eklenen.json() == {**KURAL, "kuralId": "r1", "acik": True}
    assert grup.json()["ad"] == "★4+ yatırımcılar ile girişimciler · 5 dk"
    assert kapali.json()["acik"] is False and [k["kuralId"] for k in liste] == ["r1", "r2"]
    assert silindi.json() == {"ok": True} and [k["kuralId"] for k in sonra] == ["r2"]
    assert (await gonder(istemci, "POST", "/api/rules", KURAL)).json()["kuralId"] == "r3"  # kimlik yeniden kullanılmaz


async def test_kural_ad_verilmezse_kisi_adlariyla_adlandirilir(istemci):
    yanit = await gonder(istemci, "POST", "/api/rules", {**KURAL, "ad": ""})

    assert yanit.json()["ad"] == "Ayşe Demir ile Nova Robotik · yan yana"


@pytest.mark.parametrize(("yontem", "yol", "govde", "kod"), [
    ("POST", "/api/rules", {**KURAL, "kim": {"kisiler": ["k99"]}}, 400),
    ("POST", "/api/rules", b"bozuk", 400),
    ("PATCH", "/api/rules/r9", {"acik": False}, 404),
    ("DELETE", "/api/rules/r9", {}, 404),
])
async def test_kural_hatalari_sozlesme_govdesiyle(istemci, yontem, yol, govde, kod):
    yanit = await gonder(istemci, yontem, yol, govde)

    assert yanit.status_code == kod and yanit.json()["ok"] is False and yanit.json()["hata"]


async def test_kural_tetiklenince_uyari_durumda_kural_kimligiyle(istemci, motor):
    await gonder(istemci, "POST", "/api/rules", KURAL)
    for i in range(2, 200):
        motor.isle(tik_uret(i * 0.5, {("2", "3"): YAKIN}))

    uyarilar = [b for b in (await istemci.get("/state")).json()["alerts"] if b["kind"] == "kural"]

    assert [(b["title"], b["kural"], b["severity"], b["people"]) for b in uyarilar] == [("Ayşe & Mehmet", "r1", "kural", ["2", "3"])]
