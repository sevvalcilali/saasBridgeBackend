"""Ayarlardan paket kaynağı kurar: benzetim ya da kayıt (seri B8'de); `--kaydet` verildiyse iz de yazılır."""
import asyncio
from collections.abc import Awaitable, Callable

from ..ayar import Ayar
from .benzetim import Benzetim, BenzetimKaynak
from .kayit import KaydedenKaynak, KayitKaynak
from .kaynak import PaketKaynagi


def kaynak_olustur(ayar: Ayar, bekle: Callable[[float], Awaitable[None]] = asyncio.sleep) -> PaketKaynagi:
    """Ayarlardaki kaynağı kurar. `bekle` testlerde gerçek beklemenin yerine geçer.

    Kurulamıyorsa (eksik ya da çelişen ayar, olmayan ya da silinecek dosya) ValueError: hata sunucu açılırken
    çıksın, ilk tikte (sunucu çoktan yayındayken) değil.
    """
    if ayar.iz is not None and ayar.kaynak != "kayit":
        raise ValueError("--iz yalnız --kaynak kayit ile kullanılır")
    kaynak: PaketKaynagi
    if ayar.kaynak == "benzetim":
        kaynak = BenzetimKaynak(Benzetim(kisi=ayar.kisi, kopma=ayar.kopma), hiz=ayar.hizlandir, bekle=bekle)
    elif ayar.kaynak == "kayit":
        if ayar.iz is None:
            raise ValueError("--kaynak kayit için oynatılacak iz dosyası gerekir: --iz dosya.jsonl")
        if not ayar.iz.is_file():
            raise ValueError(f"oynatılacak iz dosyası yok: {ayar.iz}")
        kaynak = KayitKaynak(ayar.iz, hiz=ayar.hizlandir, bekle=bekle)
    else:
        raise ValueError("seri kaynak henüz yok: seri paket biçimi belli olunca B8'de yazılacak")

    if ayar.kaydet is None:
        return kaynak
    if ayar.iz is not None and ayar.kaydet.resolve() == ayar.iz.resolve():
        raise ValueError(f"--kaydet ile --iz aynı dosya ({ayar.iz}): oynatılan iz silinirdi")
    if ayar.kaydet.exists():
        raise ValueError(f"kayıt dosyası zaten var: {ayar.kaydet} — başka bir ad verin ya da eskisini silin")
    if not ayar.kaydet.parent.is_dir():
        raise ValueError(f"kayıt dosyasının klasörü yok: {ayar.kaydet.parent}")
    return KaydedenKaynak(kaynak, ayar.kaydet)
