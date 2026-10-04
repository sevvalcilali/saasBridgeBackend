"""Alıcıdan gelen tek kart paketi. Bütün kaynaklar (benzetim, kayıt, B8'de seri) aynı nesneyi üretir."""
from dataclasses import dataclass

EN_BUYUK_KISI_KARTI = 99  # brief §2: 1–99 kişi kartı; 100 ve üstü dinleyici cihaz


def kisi_karti_mi(kart: str) -> bool:
    """Kart no 1–99 kişi kartıdır; 100 ve üstü dinleyici cihazdır, kişi sayılmaz."""
    return kart.isdigit() and 1 <= int(kart) <= EN_BUYUK_KISI_KARTI


@dataclass(frozen=True)
class Paket:
    kart: str  # paketi gönderen kart ("14")
    duyulanlar: tuple[tuple[str, float], ...]  # bu kartın duyduğu kartlar: (kart, dBm)
    pil: int | None  # yüzde; bilinmiyorsa None
    t: float  # paketin geldiği an (kaynak saniyesi; `Tik.t` ile aynı ölçek)

    @property
    def dinleyici(self) -> bool:
        """100+ numaralı dinleyici cihazdan mı geldi? Paket atılmaz (/api/cards gösterebilir), kişi sayılmaz."""
        return not kisi_karti_mi(self.kart)
