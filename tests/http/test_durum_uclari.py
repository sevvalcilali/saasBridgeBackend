"""/state, /events ve /control (PLAN B2.5, Bölüm 8.1). Canlı akışın zamanlaması gerçek sunucuyla tests/test_main.py'de."""
import asyncio
import json

import pytest
from destek.salon import KADRO, YAKIN, tik_uret
from starlette.requests import Request

from yakinlik.ayar import Ayar
from yakinlik.cekirdek.alan import Alan
from yakinlik.cekirdek.durum import Etkinlik
from yakinlik.cekirdek.kisi import KisiDefteri
from yakinlik.http.uygulama import uygulama_olustur
from yakinlik.motor import Motor
from yakinlik.saat import SahteSaat


class BosKaynak:
    benzetim = None

    async def tikler(self):
        return
        yield


@pytest.fixture
def motor():
    alan = Alan(KisiDefteri.kadrodan(KADRO), baslangic=0.0)
    return Motor(BosKaynak(), alan, Etkinlik("Deneme", "alt", "tarih"), saat=SahteSaat(1e9))


@pytest.fixture
async def istemci(istemci_ac, dist, motor):
    async with istemci_ac(uygulama_olustur(Ayar(dist=dist), motor=motor)) as acik:
        yield acik


def kontrol(istemci, govde):
    # Mock testleri gövdeyi Content-Type başlığı olmadan yollar; sunucu yine JSON okumalı.
    return istemci.post("/control", content=govde if isinstance(govde, bytes) else json.dumps(govde).encode())


async def test_state_son_durumu_onbelleksiz_json_olarak_verir(istemci, motor):
    motor.isle(tik_uret(0.5))

    yanit = await istemci.get("/state")

    assert yanit.status_code == 200
    assert yanit.headers["content-type"] == "application/json; charset=utf-8"
    assert yanit.headers["cache-control"] == "no-store"
    assert yanit.content == motor.anlik
    assert yanit.json()["elapsed"] == 0.5


async def test_esik_degisir_ve_hemen_okunur(istemci):
    yanit = await kontrol(istemci, {"cmd": "threshold", "value": -70})

    assert (yanit.status_code, yanit.json()) == (200, {"ok": True})
    assert (await istemci.get("/state")).json()["threshold"] == -70


async def test_kesirli_esik_kabul_edilir(istemci):
    assert (await kontrol(istemci, {"cmd": "threshold", "value": -68.5})).status_code == 200
    assert (await istemci.get("/state")).json()["threshold"] == -68.5


@pytest.mark.parametrize(
    "govde",
    [
        {"cmd": "threshold", "value": -150},
        {"cmd": "threshold", "value": -19},
        {"cmd": "threshold", "value": "-70"},
        {"cmd": "threshold", "value": True},
        {"cmd": "threshold", "value": None},
        {"cmd": "threshold"},
        {"cmd": "uydurma"},
        {},
        [],
        b"",
        b"{bozuk",
        b'{"cmd": "threshold", "value": NaN}',
    ],
)
async def test_gecersiz_komut_400_ve_esik_degismez(istemci, govde):
    yanit = await kontrol(istemci, govde)

    assert yanit.status_code == 400
    assert yanit.json()["ok"] is False
    assert (await istemci.get("/state")).json()["threshold"] == -72


async def test_sinir_degerleri_kabul_edilir(istemci):
    assert (await kontrol(istemci, {"cmd": "threshold", "value": -100})).status_code == 200
    assert (await kontrol(istemci, {"cmd": "threshold", "value": -20})).status_code == 200


async def test_sifirlama_sureleri_hemen_siler(istemci, motor):
    for i in range(130):
        motor.isle(tik_uret(0.5 * (i + 1), {("2", "3"): YAKIN}))
    assert (await istemci.get("/state")).json()["edges"]

    yanit = await kontrol(istemci, {"cmd": "reset"})

    durum = (await istemci.get("/state")).json()
    assert (yanit.status_code, yanit.json()) == (200, {"ok": True})
    assert (durum["edges"], durum["alerts"], durum["stats"]["done"], durum["elapsed"]) == ([], [], 0, 0.0)
    assert all(kisi["min"] == 0 for kisi in durum["people"])


async def test_state_yolu_statik_dosyaya_dusmez(istemci, dist):
    (dist / "state").write_text("statik", encoding="utf-8")  # aynı adlı dosya olsa da uç kazanır

    yanit = await istemci.get("/state")

    assert yanit.headers["content-type"].startswith("application/json")


async def test_canli_akis_ilk_durumu_tik_beklemeden_verir_sonra_her_tiki(motor):
    from yakinlik.http.durum_uclari import durum_uclari

    (events,) = [rota for rota in durum_uclari(motor).routes if rota.path == "/events"]
    yanit = await events.endpoint(Request({"type": "http", "query_string": b"", "headers": []}))
    akis = yanit.body_iterator
    try:
        ilk = await asyncio.wait_for(anext(akis), timeout=0.2)  # motor hiç tiklemedi
        motor.isle(tik_uret(0.5))
        ikinci = await asyncio.wait_for(anext(akis), timeout=0.2)

        assert ilk.startswith(b"data: {") and ilk.endswith(b"\n\n")
        assert json.loads(ikinci[6:])["elapsed"] == 0.5
    finally:
        await akis.aclose()


async def test_grafik_0_ile_istenen_durumda_history_bos_digerleri_ayni(istemci, motor):
    for t in (0.5, 1.0, 1.5):
        motor.isle(tik_uret(t, {("2", "3"): YAKIN}))

    tam = (await istemci.get("/state")).json()
    grafiksiz = (await istemci.get("/state?grafik=0")).json()

    assert tam["history"]["2-3"]
    assert grafiksiz == {**tam, "history": {}}
