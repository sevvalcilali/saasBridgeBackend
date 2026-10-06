"""Paket izini dosyaya kaydetme ve geri oynatma (JSONL: satır başına bir tik).

Sayılar olduğu gibi yazılır ve okunur: oynatılan tikler kaydedilenlerle birebir aynıdır, bu yüzden aynı iz
her zaman aynı sinyalleri üretir (altın dosya testleri bunun üstüne kurulur).
"""
import asyncio
import json
import math
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import aclosing
from pathlib import Path
from typing import TYPE_CHECKING

from .kaynak import PaketKaynagi, Tik
from .paket import Paket

if TYPE_CHECKING:
    from .benzetim import Benzetim


def _satir(tik: Tik) -> str:
    paketler = [
        {"kart": paket.kart, "duyulanlar": [list(duyulan) for duyulan in paket.duyulanlar], "t": paket.t,
         "alici_rssi": paket.alici_rssi}
        for paket in tik.paketler
    ]
    # allow_nan=False: sonlu olmayan sayı (NaN) yazılırken yakalansın; JSON'da geçerli değildir.
    return json.dumps({"t": tik.t, "paketler": paketler}, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _sayi(deger: object) -> bool:
    return isinstance(deger, (int, float)) and not isinstance(deger, bool) and math.isfinite(deger)


def _denetle(gecerli: bool, alan: str, beklenen: str, deger: object) -> None:
    if not gecerli:
        raise ValueError(f"{alan} {beklenen} olmalı, gelen: {deger!r}")


def _tik(satir: str) -> Tik:
    """Bir iz satırını tike çevirir. Alan türleri burada denetlenir: bozuk iz çekirdekte değil okurken yakalansın."""
    veri = json.loads(satir)
    _denetle(_sayi(veri["t"]), "t", "sonlu sayı", veri["t"])
    paketler = []
    for paket in veri["paketler"]:
        kart, t = paket["kart"], paket["t"]  # eski izlerdeki "pil" yok sayılır (pil tutulmuyor, 07.10.2026)
        alici_rssi = paket.get("alici_rssi")  # B4'ten önceki izlerde yok
        _denetle(alici_rssi is None or _sayi(alici_rssi), "alici_rssi", "sonlu sayı ya da null", alici_rssi)
        _denetle(isinstance(kart, str), "kart", "metin", kart)
        _denetle(_sayi(t), "t", "sonlu sayı", t)
        duyulanlar = []
        for diger, rssi in paket["duyulanlar"]:
            _denetle(isinstance(diger, str), "duyulan kart", "metin", diger)
            _denetle(_sayi(rssi), "dBm", "sonlu sayı", rssi)
            duyulanlar.append((diger, rssi))
        paketler.append(Paket(kart, tuple(duyulanlar), t, alici_rssi))
    return Tik(veri["t"], tuple(paketler))


class KaydedenKaynak:
    """Başka bir kaynağı sarar: her tiki `dosya`ya yazar, sonra aynen iletir (`--kaydet`).

    Var olan dosyanın üstüne yazmaz (FileExistsError): eski bir kayıt sessizce silinmesin.
    """

    def __init__(self, kaynak: PaketKaynagi, dosya: Path) -> None:
        self._kaynak = kaynak
        self._dosya = dosya

    @property
    def benzetim(self) -> "Benzetim | None":
        return self._kaynak.benzetim

    async def tikler(self) -> AsyncGenerator[Tik, None]:
        with self._dosya.open("x", encoding="utf-8") as dosya:
            async with aclosing(self._kaynak.tikler()) as akis:
                async for tik in akis:
                    dosya.write(_satir(tik) + "\n")
                    dosya.flush()  # süreç aniden kapansa da yazılan tikler dosyada kalsın
                    yield tik


class KayitKaynak:
    """Kaydedilmiş izi kayıttaki aralıklarla geri oynatır (`--kaynak kayit --iz dosya`). İz bitince akış biter."""

    benzetim = None

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
