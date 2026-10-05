"""Kart verme, iade, geri al ve kart değişimi (SUNUCUDAN_ISTENENLER §2). Saf: alan modeli üzerinde işler.

Kişi ≠ kart: kart değişse de süreler kişide birleşir; iade edilen kart başkasına verilirse eski sahibin süreleri ona
geçmez; kimseye verilmemiş kartın ("kart:N") süreleri, karta kişi atanınca o kişiye geçer. Kart el değiştirince ya da
masaya dönünce açık görüşmeleri kapanır, eşleri serbest kalır.
"""
from dataclasses import dataclass

from .alan import Alan

ATA, IADE, GERI_AL, DEGISIM = "ata", "iade", "geri_al", "degisim"


@dataclass(frozen=True)
class AtamaKaydi:
    """Zaman damgalı atama geçmişi satırı (brief §9-2; GET /api/assignments B5'te)."""

    t: float  # duvar saati
    kisi_id: str
    kart: str
    islem: str  # ata | iade | geri_al | degisim


@dataclass(frozen=True)
class KartHareketi:
    """Benzetim için: salona giren kartlar (kart, rol) ve salondan çıkanlar (kart, masaya döner mi)."""

    giren: tuple[tuple[str, str], ...]
    cikan: tuple[tuple[str, bool], ...]


def ata(alan: Alan, kisi_id: str, kart: str, duvar: float) -> KartHareketi:
    """Kartı kişiye verir. Kişi kayıtlı olmalı (çağıran denetler).

    Kart başkasındaysa o kişiden alınır (o "ayrıldı" sayılmaz); kişinin başka kartı varsa bırakılır (kart değişimi).
    """
    defter = alan.defter
    kisi = defter.kisi(kisi_id)
    if kisi.atanan_kart == kart:
        kisi.ayrildi = False
        return KartHareketi(giren=(), cikan=())
    cikan: list[tuple[str, bool]] = []
    eski_sahip = defter.birak(kart)
    if eski_sahip is not None:
        alan.kart_ayril(kart)
        cikan.append((kart, False))  # benzetimde kart salondan çıkıp yeni sahibiyle girer: eşleşmeleri sıfırlanır
        alan.atama_gecmisi.append(AtamaKaydi(duvar, eski_sahip.kisi_id, kart, IADE))
    islem = ATA
    if kisi.atanan_kart is not None:
        eski_kart = kisi.atanan_kart
        defter.birak(eski_kart)
        alan.kart_ayril(eski_kart)
        cikan.append((eski_kart, False))  # değişimde bırakılan kart kapanır (pil bitti, bozuldu)
        islem = DEGISIM
    onceki_kimlik = defter.kimlik(kart)  # kart artık sahipsiz: "kart:N"
    defter.ata(kisi_id, kart)
    alan.kimligi_tasi(onceki_kimlik, kisi_id)  # kişisiz kartla geçen süre artık bu kişinin
    alan.atama_gecmisi.append(AtamaKaydi(duvar, kisi_id, kart, islem))
    return KartHareketi(giren=((kart, kisi.rol),), cikan=tuple(cikan))


def iade(alan: Alan, kart: str, ayrildi: bool, duvar: float) -> KartHareketi:
    """Kart masaya döner. `ayrildi=True` kart iadesi (kişi "ayrıldı"); False yanlış atamayı geri alma (kişi kart bekler)."""
    kisi = alan.defter.birak(kart)
    if kisi is not None:
        kisi.ayrildi = ayrildi
        alan.atama_gecmisi.append(AtamaKaydi(duvar, kisi.kisi_id, kart, IADE if ayrildi else GERI_AL))
    alan.kart_ayril(kart)
    return KartHareketi(giren=(), cikan=((kart, True),))
