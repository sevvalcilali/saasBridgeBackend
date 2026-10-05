"""ASGI ara katmanları (PLAN Bölüm 8.4, 11): istek gövdesi sınırı ve yazma isteklerinin günlüğü."""
import json
import logging
import time

gunluk = logging.getLogger("yakinlik.http")

GOVDE_SINIRI = 1024 * 1024  # 1 MB: CSV için yeterli; üstü 413
_OKUMA = ("GET", "HEAD", "OPTIONS")


class GovdeSiniri:
    """1 MB'ı aşan gövde 413 `{ok:false, hata}` alır, uca hiç ulaşmaz. Content-Length yoksa (parça parça gönderim)
    gövde okunurken sayılır; sınır içindeki gövde uca olduğu gibi verilir."""

    def __init__(self, uygulama, sinir: int = GOVDE_SINIRI) -> None:
        self.uygulama = uygulama
        self.sinir = sinir

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope["method"] in _OKUMA:
            await self.uygulama(scope, receive, send)
            return
        uzunluk = dict(scope["headers"]).get(b"content-length", b"").decode("latin-1")
        if uzunluk.isdecimal() and int(uzunluk) > self.sinir:
            await self._buyuk(send)
            return
        govde, devam = bytearray(), True
        while devam:
            mesaj = await receive()
            if mesaj["type"] == "http.disconnect":
                return
            govde += mesaj.get("body", b"")
            devam = mesaj.get("more_body", False)
            if len(govde) > self.sinir:
                await self._buyuk(send)
                return
        verildi = False

        async def yeniden() -> dict:
            nonlocal verildi
            if verildi:
                return await receive()
            verildi = True
            return {"type": "http.request", "body": bytes(govde), "more_body": False}

        await self.uygulama(scope, yeniden, send)

    async def _buyuk(self, send) -> None:
        govde = json.dumps({"ok": False, "hata": f"istek gövdesi çok büyük (en çok {self.sinir // 2**20} MB)"},
                           ensure_ascii=False).encode("utf-8")
        await send({"type": "http.response.start", "status": 413, "headers": [
            (b"content-type", b"application/json"), (b"content-length", str(len(govde)).encode()),
        ]})
        await send({"type": "http.response.body", "body": govde})


class IstekGunlugu:
    """Yazma istekleri (POST, PATCH, DELETE …) günlüğe: yöntem, yol, durum kodu, süre. Okumalar yazılmaz (masa ve pano
    saniyede birkaç kez yoklar)."""

    def __init__(self, uygulama) -> None:
        self.uygulama = uygulama

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope["method"] in _OKUMA:
            await self.uygulama(scope, receive, send)
            return
        durum, bas = 500, time.perf_counter()

        async def gonder(mesaj: dict) -> None:
            nonlocal durum
            if mesaj["type"] == "http.response.start":
                durum = mesaj["status"]
            await send(mesaj)

        try:
            await self.uygulama(scope, receive, gonder)
        finally:
            gunluk.info("%s %s → %s (%.0f ms)", scope["method"], scope["path"], durum, (time.perf_counter() - bas) * 1000)
