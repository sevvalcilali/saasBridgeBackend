"""Ayarlardan paket kaynağı kurar: benzetim ya da kayıt (seri B8'de); `--kaydet` verildiyse iz de yazılır."""
import asyncio
from collections.abc import Awaitable, Callable

from ..ayar import Ayar
from .benzetim import Benzetim, BenzetimKaynak
from .kayit import KaydedenKaynak, KayitKaynak
from .kaynak import PaketKaynagi


def kaynak_olustur(ayar: Ayar, bekle: Callable[[float], Awaitable[None]] = asyncio.sleep) -> PaketKaynagi:
    """Ayarlardaki kaynağı kurar; kurulamıyorsa ValueError. `bekle` testlerde gerçek beklemenin yerine geçer."""
    kaynak: PaketKaynagi
    if ayar.kaynak == "benzetim":
        kaynak = BenzetimKaynak(Benzetim(kisi=ayar.kisi, kopma=ayar.kopma), hiz=ayar.hizlandir, bekle=bekle)
    elif ayar.kaynak == "kayit":
        if ayar.iz is None:
            raise ValueError("--kaynak kayit için oynatılacak iz dosyası gerekir: --iz dosya.jsonl")
        kaynak = KayitKaynak(ayar.iz, hiz=ayar.hizlandir, bekle=bekle)
    else:
        raise ValueError("seri kaynak henüz yok: seri paket biçimi belli olunca B8'de yazılacak")
    return KaydedenKaynak(kaynak, ayar.kaydet) if ayar.kaydet is not None else kaynak
