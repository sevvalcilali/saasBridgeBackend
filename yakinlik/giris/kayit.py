"""Paket izini dosyaya kaydetme ve geri oynatma (JSONL: satır başına bir tik).

Sayılar olduğu gibi yazılır ve okunur: oynatılan tikler kaydedilenlerle birebir aynıdır, bu yüzden aynı iz
her zaman aynı sinyalleri üretir (altın dosya testleri bunun üstüne kurulur).
"""
import asyncio
import json
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import aclosing
from pathlib import Path

from .kaynak import PaketKaynagi, Tik
from .paket import Paket


def _satir(tik: Tik) -> str:
    paketler = [
        {"kart": paket.kart, "duyulanlar": [list(duyulan) for duyulan in paket.duyulanlar], "pil": paket.pil, "t": paket.t}
        for paket in tik.paketler
    ]
    return json.dumps({"t": tik.t, "paketler": paketler}, ensure_ascii=False, separators=(",", ":"))


def _tik(satir: str) -> Tik:
    veri = json.loads(satir)
    return Tik(
        veri["t"],
        tuple(
            Paket(paket["kart"], tuple((kart, rssi) for kart, rssi in paket["duyulanlar"]), paket["pil"], paket["t"])
            for paket in veri["paketler"]
        ),
    )


class KaydedenKaynak:
    """Başka bir kaynağı sarar: her tiki `dosya`ya yazar, sonra aynen iletir (`--kaydet`)."""

    def __init__(self, kaynak: PaketKaynagi, dosya: Path) -> None:
        self._kaynak = kaynak
        self._dosya = dosya

    async def tikler(self) -> AsyncGenerator[Tik, None]:
        with self._dosya.open("w", encoding="utf-8") as dosya:
            async with aclosing(self._kaynak.tikler()) as akis:
                async for tik in akis:
                    dosya.write(_satir(tik) + "\n")
                    dosya.flush()  # süreç aniden kapansa da yazılan tikler dosyada kalsın
                    yield tik


class KayitKaynak:
    """Kaydedilmiş izi kayıttaki aralıklarla geri oynatır (`--kaynak kayit --iz dosya`). İz bitince akış biter."""

    def __init__(
        self, dosya: Path, hiz: float = 1.0, bekle: Callable[[float], Awaitable[None]] = asyncio.sleep
    ) -> None:
        self._dosya = dosya
        self._hiz = hiz
        self._bekle = bekle

    async def tikler(self) -> AsyncGenerator[Tik, None]:
        onceki_t = None
        with self._dosya.open(encoding="utf-8") as dosya:
            for no, satir in enumerate(dosya, start=1):
                if not satir.strip():
                    continue
                try:
                    tik = _tik(satir)
                except (ValueError, KeyError, TypeError) as hata:
                    raise ValueError(f"{self._dosya}: satır {no} okunamadı ({hata})") from hata
                if onceki_t is not None:
                    await self._bekle((tik.t - onceki_t) / self._hiz)
                onceki_t = tik.t
                yield tik
