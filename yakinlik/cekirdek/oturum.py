"""Görüşme kayıtları (SUNUCUDAN_ISTENENLER §6, brief §9-6). Saf.

Kayıt, çift "birlikte" olunca açılır (eşiğin aşıldığı ana geri tarihli: bekleme dakikası görüşmeye sayılır), birliktelik
bitince ya da kart iade edilince / değişince kapanır. Kimlikler kişi kimliğidir (kisiId; kişisiz kart "kart:N"); zaman
etkinlik saniyesidir (`/state.elapsed` ile aynı ölçek). Kayıtlar silinmez; yalnız sıfırlama temizler.
"""
from dataclasses import dataclass


@dataclass
class Oturum:
    a: str
    b: str
    start: float  # etkinlik saniyesi
    end: float | None = None  # sürüyorsa None


def rapor_kimligi(kimlik: str) -> str:
    """Dışarıya verilen kimlik. İade edilmiş kişisiz kartın arşiv kimliği ("arsiv:kart:14:2") yine "kart:14" görünür:
    rapor onu "Kart 14 (kayıtsız)" diye gösterir."""
    if kimlik.startswith("arsiv:"):
        return kimlik.removeprefix("arsiv:").rsplit(":", 1)[0]
    return kimlik
