"""Ortak test araçları (PLAN B0.6): sahte saat, örnek dist/, uygulamaya bağlı httpx istemcisi."""
from contextlib import asynccontextmanager

import httpx
import pytest

from yakinlik.ayar import Ayar
from yakinlik.http.uygulama import uygulama_olustur
from yakinlik.saat import SahteSaat

_DIST_DOSYALARI = {
    "index.html": '<!doctype html><title>Yakınlık Panosu</title><div id="root"></div>',
    "assets/x.js": "console.log('x')\n",
    "assets/x.css": "body { margin: 0 }\n",
    "assets/yazi.woff2": "woff2-ikili-icerik",
    "logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "veri.json": '{"a": 1}',
}


@pytest.fixture
def sahte_saat():
    return SahteSaat()


@pytest.fixture
def dist(tmp_path):
    """Derlenmiş arayüzü taklit eden küçük bir dist/ klasörü."""
    kok = tmp_path / "dist"
    for yol, icerik in _DIST_DOSYALARI.items():
        dosya = kok / yol
        dosya.parent.mkdir(parents=True, exist_ok=True)
        dosya.write_text(icerik, encoding="utf-8")
    return kok


@pytest.fixture
def istemci_ac():
    """Verilen uygulamaya ağ olmadan (doğrudan ASGI) bağlanan httpx istemcisi açar."""

    @asynccontextmanager
    async def ac(uygulama):
        # raise_app_exceptions=False: işleyici istisnasında gerçek sunucu gibi 500 yanıtını görmek için.
        tasima = httpx.ASGITransport(app=uygulama, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=tasima, base_url="http://test") as istemci:
            yield istemci

    return ac


@pytest.fixture
async def istemci(istemci_ac, dist):
    async with istemci_ac(uygulama_olustur(Ayar(dist=dist))) as acik:
        yield acik
