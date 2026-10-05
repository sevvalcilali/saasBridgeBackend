"""Kişi kayıt defteri. Kişi ≠ kart: süreler ve kenarlar kişiye (kisiId) yazılır; kişisiz kart "kart:N" kimliğiyle.

Alan kuralları SUNUCUDAN_ISTENENLER §1 ve mock ile aynı: geçersiz rol misafir sayılır, metin olmayan alan yok sayılır,
yıldız yalnız yatırımcıda (0–5), renk kişi doğarken atanır ve değişmez, kimlikler yeniden kullanılmaz.
"""
import math
from collections.abc import Iterable, Mapping
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
    notu: str = ""
    ayrildi: bool = False  # kartını iade etti mi ("kart bekliyor" ile "ayrıldı" ayrımı)

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


def _metin(deger: object) -> str:
    return deger if isinstance(deger, str) else ""


def _tam_sayi(deger: object) -> int:
    """JavaScript `deger | 0` gibi: sayıya çevrilemeyen 0, kesir kesilir ("3" → 3, 4,7 → 4, "çok" → 0)."""
    if isinstance(deger, bool):
        return int(deger)
    if isinstance(deger, str):
        try:
            deger = float(deger.strip() or 0)
        except ValueError:
            return 0
    try:
        if isinstance(deger, (int, float)) and math.isfinite(deger):
            return int(deger)
    except OverflowError:  # çok büyük tam sayı (float'a sığmaz)
        pass
    return 0


def _yildiz(rol: str, deger: object) -> int:
    return max(0, min(5, _tam_sayi(deger))) if rol == "investor" else 0


class KisiDefteri:
    def __init__(self) -> None:
        self._kisiler: dict[str, Kisi] = {}  # kisiId → kişi (eklenme sırasıyla)
        self._kartlar: dict[str, str] = {}  # kart → kisiId
        self._sayac = 0  # doğan kişi sayısı: kimlik ve renk sırası (silinenler dahil)

    @classmethod
    def kadrodan(cls, kadro: Iterable[KadroKisisi]) -> "KisiDefteri":
        """Benzetim kadrosundan defter: her kişi kartına atanmış; kimlik ve renk mock'taki sırayla (k1, k2, …)."""
        defter = cls()
        for sahte in kadro:
            kisi = defter.ekle(ad=sahte.ad, rol=sahte.rol, kurum=sahte.kurum, yildiz=sahte.yildiz)
            defter.ata(kisi.kisi_id, sahte.kart)
        return defter

    def kisiler(self) -> list[Kisi]:
        return list(self._kisiler.values())

    def kisi(self, kisi_id: str) -> Kisi | None:
        return self._kisiler.get(kisi_id)

    def kart_sahibi(self, kart: str) -> Kisi | None:
        kisi_id = self._kartlar.get(kart)
        return None if kisi_id is None else self._kisiler[kisi_id]

    def kimlik(self, kart: str) -> str:
        """Kartın şu anki kimliği: atanmış kişinin kisiId'si, yoksa "kart:N"."""
        return self._kartlar.get(kart, f"kart:{kart}")

    def ekle(self, ad: object, rol: object = "guest", kurum: object = "", yildiz: object = 0, notu: object = "") -> Kisi:
        """Kartsız yeni kişi. Boş adı reddetmek çağıranın işi; buraya gelirse "İsimsiz" olur (mock ile aynı)."""
        self._sayac += 1
        rol = rol if rol in ROL_SIRASI else "guest"
        kisi = Kisi(
            f"k{self._sayac}", _metin(ad).strip() or "İsimsiz", rol, _metin(kurum), _yildiz(rol, yildiz),
            PALET[(self._sayac - 1) % len(PALET)], notu=_metin(notu),
        )
        self._kisiler[kisi.kisi_id] = kisi
        return kisi

    def guncelle(self, kisi_id: str, alanlar: Mapping[str, object]) -> Kisi | None:
        """Yalnız verilen alanlar değişir (ad, rol, kurum, yildiz, not). Kimlik, renk ve kart değişmez; geçersiz rol ve
        boş ad yok sayılır. Kişi yoksa None."""
        kisi = self._kisiler.get(kisi_id)
        if kisi is None:
            return None
        ad = alanlar.get("ad")
        if isinstance(ad, str) and ad.strip():
            kisi.ad = ad.strip()
        if alanlar.get("rol") in ROL_SIRASI:
            kisi.rol = alanlar["rol"]
        if isinstance(alanlar.get("kurum"), str):
            kisi.kurum = alanlar["kurum"]
        if isinstance(alanlar.get("not"), str):
            kisi.notu = alanlar["not"]
        kisi.yildiz = _yildiz(kisi.rol, alanlar["yildiz"] if "yildiz" in alanlar else kisi.yildiz)
        return kisi

    def sil(self, kisi_id: str) -> None:
        kisi = self._kisiler.pop(kisi_id)
        if kisi.atanan_kart is not None:
            self._kartlar.pop(kisi.atanan_kart, None)

    def ata(self, kisi_id: str, kart: str) -> None:
        """Kartı kişiye bağlar (kişinin önceki kartı ve kartın önceki sahibi bırakılır); kişi artık "ayrıldı" değil."""
        kisi = self._kisiler[kisi_id]
        if kisi.atanan_kart is not None:
            self.birak(kisi.atanan_kart)
        self.birak(kart)
        kisi.atanan_kart, kisi.ayrildi = kart, False
        self._kartlar[kart] = kisi_id

    def birak(self, kart: str) -> Kisi | None:
        """Kartı sahibinden ayırır; sahibini döndürür (yoksa None). `ayrildi` işaretine dokunmaz."""
        kisi_id = self._kartlar.pop(kart, None)
        if kisi_id is None:
            return None
        kisi = self._kisiler[kisi_id]
        kisi.atanan_kart = None
        return kisi
