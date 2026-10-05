"""Kişi kayıt defteri. Kişi ≠ kart: süreler ve kenarlar kişiye (kisiId) yazılır; kişisiz kart "kart:N" kimliğiyle.

B2'de en küçük hali: benzetim kadrosundan kurulur, kartı soran kişiyi bulur. Ekleme, düzenleme ve kart verme /
iade B3'te.
"""
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

ROL_SIRASI = ("investor", "founder", "guest")  # /state.people bu sırayla (yatırımcı → girişimci → misafir)
# Brief §10 koyu paleti (mock ile aynı); açık tema uyarlaması arayüzde. Renk kişi doğarken atanır, değişmez.
PALET = ("#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#e66767")


@dataclass
class Kisi:
    kisi_id: str  # "k12"; kişisiz kart için "kart:14"
    ad: str
    rol: str  # investor | founder | guest
    kurum: str
    yildiz: int  # yatırımcıda 0–5, diğerlerinde 0
    renk: str
    atanan_kart: str | None = None

    @property
    def gorunen_ad(self) -> str:
        """Girişimcide kurum adı öne çıkar (mock'taki gorunenAd ile aynı)."""
        return self.kurum if self.rol == "founder" and self.kurum else self.ad


def kisisiz_kart(kart: str) -> Kisi:
    """Kimseye atanmamış kartın panodaki hali: "Kart N", misafir (arayüz bunu "Kişi ata" ile öne çıkarır)."""
    return Kisi(f"kart:{kart}", f"Kart {kart}", "guest", "", 0, PALET[int(kart) % len(PALET)], kart)


class KadroKisisi(Protocol):
    kart: str
    ad: str
    rol: str
    kurum: str
    yildiz: int


class KisiDefteri:
    def __init__(self) -> None:
        self._kisiler: dict[str, Kisi] = {}  # kisiId → kişi (eklenme sırasıyla)
        self._kartlar: dict[str, str] = {}  # kart → kisiId

    @classmethod
    def kadrodan(cls, kadro: Iterable[KadroKisisi]) -> "KisiDefteri":
        """Benzetim kadrosundan defter: her kişi kartına atanmış; kimlik ve renk mock'taki sırayla (k1, k2, …)."""
        defter = cls()
        for sira, sahte in enumerate(kadro):
            kisi = Kisi(f"k{sira + 1}", sahte.ad, sahte.rol, sahte.kurum, sahte.yildiz, PALET[sira % len(PALET)], sahte.kart)
            defter._kisiler[kisi.kisi_id] = kisi
            defter._kartlar[sahte.kart] = kisi.kisi_id
        return defter

    def kisiler(self) -> list[Kisi]:
        return list(self._kisiler.values())

    def kart_sahibi(self, kart: str) -> Kisi | None:
        kisi_id = self._kartlar.get(kart)
        return None if kisi_id is None else self._kisiler[kisi_id]

    def kimlik(self, kart: str) -> str:
        """Kartın şu anki kimliği: atanmış kişinin kisiId'si, yoksa "kart:N"."""
        return self._kartlar.get(kart, f"kart:{kart}")
