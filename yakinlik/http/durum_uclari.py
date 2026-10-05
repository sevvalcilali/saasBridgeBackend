"""GET /state, GET /events (SSE, 2 Hz), POST /control — brief §5 sözleşmesi (PLAN Bölüm 8.1). İnce katman."""
import json
import math
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from ..cekirdek.cift import ESIK_ARALIGI
from ..motor import Motor, SifirlamaHatasi


def _gecerli_esik(deger: object) -> bool:
    return (
        isinstance(deger, (int, float)) and not isinstance(deger, bool) and math.isfinite(deger)
        and ESIK_ARALIGI[0] <= deger <= ESIK_ARALIGI[1]
    )


def durum_uclari(motor: Motor) -> APIRouter:
    yonlendirici = APIRouter()

    @yonlendirici.get("/state")
    async def state() -> Response:
        return Response(motor.anlik, media_type="application/json; charset=utf-8", headers={"Cache-Control": "no-store"})

    @yonlendirici.get("/events")
    async def events() -> StreamingResponse:
        abone = motor.abone_ol()  # akış açılmadan abone ol: ilk mesajla ilk tik arasında boşluk kalmasın

        async def akis() -> AsyncIterator[bytes]:
            try:
                yield b"data: " + motor.anlik + b"\n\n"  # bağlanır bağlanmaz son durum
                while (veri := await abone.al()) is not None:
                    yield b"data: " + veri + b"\n\n"
            finally:
                motor.ayril(abone)  # kopan ya da yetişemeyen izleyici sessizce düşer

        return StreamingResponse(
            akis(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )

    @yonlendirici.post("/control")
    async def control(istek: Request) -> JSONResponse:
        # Gövde elle okunur: mock testleri Content-Type göndermez, hata gövdesi sözleşmedeki {ok, hata} olmalı.
        try:
            komut = json.loads(await istek.body())
        except ValueError:
            komut = None
        if isinstance(komut, dict) and komut.get("cmd") == "reset":
            try:
                motor.sifirla()
            except SifirlamaHatasi as hata:
                return JSONResponse({"ok": False, "hata": str(hata)}, status_code=500)
            return JSONResponse({"ok": True})
        if isinstance(komut, dict) and komut.get("cmd") == "threshold" and _gecerli_esik(komut.get("value")):
            motor.esik_ayarla(komut["value"])
            return JSONResponse({"ok": True})
        return JSONResponse({"ok": False, "hata": "gecersiz komut"}, status_code=400)

    return yonlendirici
