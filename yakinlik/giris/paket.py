"""Alıcıdan gelen tek kart paketi. Bütün kaynaklar (benzetim, kayıt, B8'de seri) aynı nesneyi üretir."""
from dataclasses import dataclass

EN_BUYUK_KISI_KARTI = 99  # brief §2: 1–99 kişi kartı; 100 ve üstü dinleyici cihaz


def _rakamlardan_mi(kart: str) -> bool:
    # isdigit() yetmez: "²" de rakam sayılır ama sayıya çevrilemez; "١٢" (Arapça 12) kart numarası değildir.
    return kart.isascii() and kart.isdecimal()


def kart_no(kart: str) -> str:
    """Kart numarasının tek biçimi: baştaki sıfırlar atılır ("007" → "7"; arayüzdeki kartNoCoz ile aynı).

    Rakamlardan oluşmayan değer olduğu gibi kalır; kişi kartı sayılmaz.
    """
    return str(int(kart)) if _rakamlardan_mi(kart) else kart


def kart_no_coz(deger: object) -> str | None:
    """Elle yazılan kart numarası → tek biçim ("007" → "7"); 1–99 arası kişi kartı değilse None.

    Arayüzdeki kartNoCoz ve mock'taki kartNo ile aynı kural (en çok üç rakam, boşluklar atılır).
    """
    if not isinstance(deger, (str, int)):
        return None
    metin = str(deger).strip()  # True → "True": rakam değil, reddedilir
    if not (1 <= len(metin) <= 3 and _rakamlardan_mi(metin)):
        return None
    return str(int(metin)) if 1 <= int(metin) <= EN_BUYUK_KISI_KARTI else None


def kisi_karti_mi(kart: str) -> bool:
    """Kart no 1–99 kişi kartıdır; 100 ve üstü dinleyici cihazdır, kişi sayılmaz. Hiçbir girdide hata vermez."""
    return _rakamlardan_mi(kart) and 1 <= int(kart) <= EN_BUYUK_KISI_KARTI


@dataclass(frozen=True)
class Paket:
    kart: str  # paketi gönderen kart ("14")
    duyulanlar: tuple[tuple[str, float], ...]  # bu kartın duyduğu kartlar: (kart, dBm)
    pil: int | None  # yüzde; bilinmiyorsa None
    t: float  # paketin geldiği an (kaynak saniyesi; `Tik.t` ile aynı ölçek)

    def __post_init__(self) -> None:
        # Numaralar tek biçime çevrilir: "007" ile "7" aynı karttır, iki ayrı kart sayılmamalı.
        object.__setattr__(self, "kart", kart_no(self.kart))
        object.__setattr__(self, "duyulanlar", tuple((kart_no(kart), rssi) for kart, rssi in self.duyulanlar))

    @property
    def dinleyici(self) -> bool:
        """100+ numaralı dinleyici cihazdan mı geldi? Paket atılmaz (/api/cards gösterebilir), kişi sayılmaz."""
        return not kisi_karti_mi(self.kart)
