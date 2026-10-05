"""Karşılama masası uçları (SUNUCUDAN_ISTENENLER §1–2): kişi kayıt defteri, CSV, kart verme / iade. İnce katman.

Gövdeler elle ayrıştırılır: mock testleri Content-Type göndermez, sözleşmedeki hata gövdesi `{ok: false, hata}` ve
mock'un hoşgörüsü (metin olmayan kurum yok sayılır, geçersiz rol misafir) korunur. Kural denetimi çekirdekte.
"""
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..cekirdek.kisi import Kisi
from ..giris.paket import kart_no_coz
from ..motor import Motor


def kisi_sozlugu(kisi: Kisi) -> dict:
    return {"kisiId": kisi.kisi_id, "ad": kisi.ad, "rol": kisi.rol, "kurum": kisi.kurum, "yildiz": kisi.yildiz,
            "not": kisi.notu, "renk": kisi.renk, "atananKart": kisi.atanan_kart, "ayrildi": kisi.ayrildi}


def _hata(kod: int, metin: str) -> JSONResponse:
    return JSONResponse({"ok": False, "hata": metin}, status_code=kod)


async def _json(istek: Request) -> object:
    try:
        return json.loads(await istek.body())
    except ValueError:
        return None


def api_uclari(motor: Motor) -> APIRouter:
    yonlendirici = APIRouter(prefix="/api")

    @yonlendirici.get("/people")
    async def kisiler() -> list[dict]:
        return [kisi_sozlugu(kisi) for kisi in motor.defter.kisiler()]

    @yonlendirici.post("/people")
    async def kisi_ekle(istek: Request) -> JSONResponse:
        govde = await _json(istek)
        if not isinstance(govde, dict) or not isinstance(govde.get("ad"), str) or not govde["ad"].strip():
            return _hata(400, "ad gerekli")
        return JSONResponse(kisi_sozlugu(motor.kisi_ekle(govde)))

    @yonlendirici.post("/people/import")
    async def iceri_aktar(istek: Request) -> JSONResponse:
        try:
            metin = (await istek.body()).decode("utf-8")
        except UnicodeDecodeError:
            return _hata(400, "dosya UTF-8 olmalı")
        if not metin.removeprefix("\ufeff").strip():
            return _hata(400, "boş dosya")
        sonuc = motor.iceri_aktar(metin)
        return JSONResponse({"eklenen": sonuc.eklenen,
                             "atlanan": [{"satir": a.satir, "sebep": a.sebep} for a in sonuc.atlanan]})

    @yonlendirici.patch("/people/{kisi_id}")
    async def kisi_guncelle(kisi_id: str, istek: Request) -> JSONResponse:
        govde = await _json(istek)
        kisi = motor.kisi_guncelle(kisi_id, govde if isinstance(govde, dict) else {})
        return _hata(404, "kişi yok") if kisi is None else JSONResponse(kisi_sozlugu(kisi))

    @yonlendirici.delete("/people/{kisi_id}")
    async def kisi_sil(kisi_id: str) -> JSONResponse:
        return JSONResponse({"ok": True}) if motor.kisi_sil(kisi_id) else _hata(404, "kişi yok")

    @yonlendirici.post("/assign")
    async def ata(istek: Request) -> JSONResponse:
        govde = await _json(istek)
        govde = govde if isinstance(govde, dict) else {}
        kisi_id, kart = govde.get("kisiId"), kart_no_coz(govde.get("kart"))
        if not isinstance(kisi_id, str) or not kisi_id or kart is None:
            return _hata(400, "kart no 1–99 olmalı")
        return JSONResponse({"ok": True}) if motor.ata(kisi_id, kart) else _hata(404, "kişi yok")

    @yonlendirici.post("/unassign")
    async def iade(istek: Request) -> JSONResponse:
        govde = await _json(istek)
        govde = govde if isinstance(govde, dict) else {}
        kart = kart_no_coz(govde.get("kart"))
        if kart is None:
            return _hata(400, "kart no 1–99 olmalı")
        if not motor.kart_biliniyor(kart):
            return _hata(404, "kart bilinmiyor")  # masaya hayalet kart eklenmesin
        motor.iade(kart, ayrildi=govde.get("ayrildi") is not False)  # varsayılan: kart iadesi (kişi ayrıldı)
        return JSONResponse({"ok": True})

    return yonlendirici
