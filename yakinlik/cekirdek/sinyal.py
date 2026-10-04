"""Çift başına sinyal ölçümleri: 10 sn ortancası, grafik serisi, son duyulma.

Saf: giriş/çıkış yok, zaman hep parametre olarak gelir (`simdi`, paketlerin `t`'siyle aynı ölçek).
Kurallar mock'un `tik()` / `durumUret()` işlevleriyle aynıdır (PLAN Bölüm 7).
"""
from collections.abc import Collection, Iterable, Iterator
from dataclasses import dataclass

from ..giris.paket import Paket, kisi_karti_mi

PENCERE_SN = 10  # karşılaştırılan değer: son 10 sn ölçümlerinin ortancası
GRAFIK_SN = 90  # grafik (history): son 90 sn
KOVA_SN = 2  # grafik kovası
UNUTMA_SN = 30  # bu kadar süredir duyulmayan çift unutulur
_SAKLAMA_SN = GRAFIK_SN + 5  # ölçümler bundan uzun tutulmaz


def cift_anahtari(x: str, y: str) -> str:
    """Çift anahtarı "küçükNo-büyükNo" (sayı olarak karşılaştırılır)."""
    return f"{x}-{y}" if int(x) < int(y) else f"{y}-{x}"


@dataclass(frozen=True)
class Olcum:
    """Bir çiftin bir tikteki ölçümü. `ab`: a'nın b'yi duyduğu güç (dBm); o yön gelmediyse None."""

    t: float
    ab: float | None
    ba: float | None

    @property
    def value(self) -> float:
        if self.ab is not None and self.ba is not None:
            return (self.ab + self.ba) / 2
        return self.ab if self.ab is not None else self.ba


@dataclass(frozen=True)
class CiftSinyali:
    """Şu an duyulan bir çiftin sinyali (/state.signals'ın ham hali; yuvarlama yayın katmanında)."""

    a: str
    b: str
    ab: float | None  # son ölçümdeki yönler
    ba: float | None
    son: float  # son ölçümün değeri
    value: float  # son PENCERE_SN içindeki ölçümlerin ortancası
    n: int  # penceredeki ölçüm sayısı


def _ortanca(degerler: list[float]) -> float:
    """Mock ile aynı ortanca: çift sayıda değer varsa iki ortadakinin büyüğü."""
    return sorted(degerler)[len(degerler) // 2]


class SinyalDeposu:
    """Gelen paketlerden çift ölçümlerini biriktirir; verilen an için sinyalleri ve grafik serilerini hesaplar."""

    def __init__(self) -> None:
        self._olcumler: dict[str, list[Olcum]] = {}  # çift anahtarı → ölçümler (eskiden yeniye)
        self._kart_son: dict[str, float] = {}  # kart → kendi son paketinin anı
        self._alici_son: float | None = None  # alıcıdan gelen son paketin anı

    def ekle(self, paketler: Iterable[Paket]) -> None:
        """Bir tikin paketlerini işler. Aynı tikte iki yön de geldiyse çift için tek ölçüm oluşur."""
        yeni: dict[str, dict] = {}
        for paket in paketler:
            self._kart_son[paket.kart] = max(paket.t, self._kart_son.get(paket.kart, paket.t))
            self._alici_son = paket.t if self._alici_son is None else max(self._alici_son, paket.t)
            if paket.dinleyici:
                continue  # dinleyici cihaz izlenir ama kişi çifti oluşturmaz
            for diger, rssi in paket.duyulanlar:
                if diger == paket.kart or not kisi_karti_mi(diger):
                    continue
                anahtar = cift_anahtari(paket.kart, diger)
                olcum = yeni.setdefault(anahtar, {"t": paket.t, "ab": None, "ba": None})
                olcum["ab" if anahtar.split("-")[0] == paket.kart else "ba"] = rssi
                olcum["t"] = max(olcum["t"], paket.t)
        for anahtar, olcum in yeni.items():
            self._olcumler.setdefault(anahtar, []).append(Olcum(**olcum))

    def sinyaller(self, simdi: float) -> list[CiftSinyali]:
        """Son PENCERE_SN içinde duyulan çiftler, ilk duyuldukları sırayla."""
        sonuc = []
        for anahtar, pencere in self._duyulan_ciftler(simdi):
            a, b = anahtar.split("-")
            son = pencere[-1]
            sonuc.append(CiftSinyali(a, b, son.ab, son.ba, son.value, _ortanca([o.value for o in pencere]), len(pencere)))
        return sonuc

    def gecmis(self, simdi: float) -> dict[str, list[tuple[int, float]]]:
        """Duyulan her çift için grafik serisi: (kaç sn önce, dBm), en eski başta; KOVA_SN'lik kovaların ortancası."""
        sonuc = {}
        for anahtar, _ in self._duyulan_ciftler(simdi):
            kovalar: dict[int, list[float]] = {}
            for olcum in self._olcumler[anahtar]:
                yas = simdi - olcum.t
                if yas <= GRAFIK_SN:
                    kovalar.setdefault(int(yas // KOVA_SN), []).append(olcum.value)
            sonuc[anahtar] = [(kova * KOVA_SN, _ortanca(degerler)) for kova, degerler in sorted(kovalar.items(), reverse=True)]
        return sonuc

    def gorulme_yasi(self, kart: str, simdi: float) -> float | None:
        """Kartın kendi son paketinden beri geçen süre (seenAgo); hiç paketi gelmediyse None."""
        son = self._kart_son.get(kart)
        return None if son is None else simdi - son

    def alici_yasi(self, simdi: float) -> float | None:
        """Alıcıdan gelen son paketten beri geçen süre (receiverAge); hiç veri gelmediyse None."""
        return None if self._alici_son is None else simdi - self._alici_son

    def unut(self, simdi: float, korunan: Collection[str] = ()) -> None:
        """Eski ölçümleri atar; UNUTMA_SN'den uzun süredir duyulmayan çifti siler.

        `korunan`: duyulmasa da silinmeyecek çift anahtarları ("birlikte" sayılan çiftler).
        """
        for anahtar in list(self._olcumler):
            olcumler = [o for o in self._olcumler[anahtar] if simdi - o.t <= _SAKLAMA_SN]
            duyulmuyor = not olcumler or simdi - olcumler[-1].t > UNUTMA_SN
            if duyulmuyor and anahtar not in korunan:
                del self._olcumler[anahtar]
            else:
                self._olcumler[anahtar] = olcumler

    @property
    def olcum_sayisi(self) -> int:
        """Bellekte tutulan toplam ölçüm sayısı (yük ölçümü ve tanılama için)."""
        return sum(len(olcumler) for olcumler in self._olcumler.values())

    def _duyulan_ciftler(self, simdi: float) -> Iterator[tuple[str, list[Olcum]]]:
        for anahtar, olcumler in self._olcumler.items():
            pencere = [o for o in olcumler if simdi - o.t <= PENCERE_SN]
            if pencere:
                yield anahtar, pencere
