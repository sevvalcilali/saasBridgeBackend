"""FastAPI uygulaması: derlenmiş arayüzü (dist/), canlı durumu ve /api uçlarını aynı adresten sunar.

İnce katman: iş kuralı burada yazılmaz (PLAN Bölüm 0.3).
"""
import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response

from .. import __surum__
from ..ayar import Ayar
from ..motor import Motor
from .api_uclari import api_uclari
from .durum_uclari import durum_uclari

# Tür tablosu elle: Windows'ta Python `mimetypes` kayıt defterinden .js için text/plain
# okuyabilir ve sayfa açılmaz (PLAN Bölüm 8.1, R6).
_TURLER = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
}
_BILINMEYEN_TUR = "application/octet-stream"
_HER_YONTEM = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


def uygulama_olustur(ayar: Ayar, motor: Motor | None = None) -> FastAPI:
    """Uygulamayı kurar. `motor` verilmezse ayarlardan kurulur (kaynak kurulamıyorsa ValueError, sunucu açılmadan);
    motor sunucu açılınca çalışmaya başlar, kapanınca durur."""
    motor = motor or Motor.ayardan(ayar)

    @asynccontextmanager
    async def omur(_: FastAPI) -> AsyncIterator[None]:
        gorev = asyncio.create_task(motor.calis())
        try:
            yield
        finally:
            gorev.cancel()
            with suppress(asyncio.CancelledError):
                await gorev
            motor.kapat()  # son hal diske; veri dosyası bırakılır

    # /docs ve /openapi.json kapalı: sayfaları CDN ister, etkinlikte internet yok.
    uygulama = FastAPI(
        title="Yakınlık", version=__surum__, docs_url=None, redoc_url=None, openapi_url=None, lifespan=omur
    )
    uygulama.state.motor = motor

    @uygulama.exception_handler(Exception)
    async def beklenmeyen_hata(istek, hata) -> JSONResponse:
        # Tek bir hatalı istek süreci (ve bütün SSE istemcilerini) düşürmesin.
        return JSONResponse({"ok": False, "hata": "sunucu hatası"}, status_code=500)

    @uygulama.get("/api/health")
    async def saglik() -> dict:
        return {"ok": True, "surum": __surum__, "kaynak": ayar.kaynak}

    uygulama.include_router(durum_uclari(motor))
    uygulama.include_router(api_uclari(motor))

    # İki yakalayıcı uç en sonda kalmalı: sonra eklenen uçları gölgede bırakırlar.
    # Tanımlı olmayan her /api ucu (mock'a özgü /api/demo, /api/yaklastir, /api/demo/tut dahil).
    @uygulama.api_route("/api/{yol:path}", methods=_HER_YONTEM)
    async def bilinmeyen_uc(yol: str) -> JSONResponse:
        return JSONResponse({"ok": False, "hata": "bilinmeyen uç"}, status_code=404)

    @uygulama.get("/{yol:path}")
    async def statik(yol: str) -> Response:
        return _statik_yanit(ayar.dist, yol)

    return uygulama


def _statik_yanit(dist: Path, yol: str) -> Response:
    if not yol:
        index = dist / "index.html"
        if index.is_file():
            # no-cache: arayüz yeniden derlenince tarayıcı eski index.html'i (silinmiş .js adlarıyla) kullanmasın.
            return FileResponse(index, media_type=_TURLER[".html"], headers={"Cache-Control": "no-cache"})
        return PlainTextResponse(f"Arayüz derlenmedi: {index} yok. SaasBridge'de `npm run build` çalıştırın.\n")
    # Önce yolun kendisine bak, dosya sistemine sorma: Windows'ta \\sunucu\paylasim ya da C:\… yolunu
    # çözmek bile o sunucuya oturum açar ve olay döngüsünü kilitler. dist/ içindeki dosyalarda bunlar olmaz.
    if yol.startswith("/") or "\\" in yol or ":" in yol or "\x00" in yol or ".." in yol.split("/"):
        return _bulunamadi()
    try:
        kok = dist.resolve()
        dosya = (kok / yol).resolve()  # dist/ içinden dışarıyı gösteren kısayol (symlink) da dışarıda sayılır
        if not dosya.is_relative_to(kok) or not dosya.is_file():
            return _bulunamadi()
    except (OSError, ValueError):  # ör. dosya adı sınırını aşan yol
        return _bulunamadi()
    return FileResponse(dosya, media_type=_TURLER.get(dosya.suffix.lower(), _BILINMEYEN_TUR))


def _bulunamadi() -> Response:
    return PlainTextResponse("bulunamadı\n", status_code=404)
