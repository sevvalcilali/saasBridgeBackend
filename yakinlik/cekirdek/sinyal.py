"""Çift başına sinyal ölçümleri: 10 sn ortancası, grafik serisi, son duyulma.

Saf: giriş/çıkış yok, zaman hep parametre olarak gelir (`simdi`, paketlerin `t`'siyle aynı ölçek).
Kurallar mock'un `tik()` / `durumUret()` işlevleriyle aynıdır (PLAN Bölüm 7).

Hız: her tikte bütün çiftler için pencere, grafik ve unutma hesaplanır (97 kart, ~850 çift, çift başına ~190
ölçüm). Ölçümler çift başına zamana göre sıralı tutulur; aralıklar ikili aramayla bulunur, her tikte bütün
ölçümler baştan taranmaz.
"""
from bisect import bisect_left, bisect_right
from collections.abc import Collection, Iterable
from dataclasses import dataclass, field

from ..giris.paket import Paket, kisi_karti_mi

PENCERE_SN = 10  # karşılaştırılan değer: son 10 sn ölçümlerinin ortancası
GRAFIK_SN = 90  # grafik (history): son 90 sn
KOVA_SN = 2  # grafik kovası
UNUTMA_SN = 30  # bu kadar süredir duyulmayan çift unutulur
_SAKLAMA_SN = GRAFIK_SN + 5  # ölçümler bundan uzun tutulmaz


def cift_anahtari(x: str, y: str) -> str:
    """Çift anahtarı "küçükNo-büyükNo" (sayı olarak karşılaştırılır)."""
    return f"{x}-{y}" if int(x) < int(y) else f"{y}-{x}"


@dataclass(frozen=True, slots=True)
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
    ab: float | None  # en yeni ölçümdeki yönler
    ba: float | None
    son: float  # en yeni ölçümün değeri
    value: float  # son PENCERE_SN içindeki ölçümlerin ortancası
    n: int  # penceredeki ölçüm sayısı


def _ortanca(degerler: list[float]) -> float:
    """Mock ile aynı ortanca: çift sayıda değer varsa iki ortadakinin büyüğü."""
    return sorted(degerler)[len(degerler) // 2]


@dataclass(slots=True)
class _CiftKaydi:
    """Bir çiftin ölçümleri, zamana göre sıralı: zamanlar ve değerler paralel listelerdir."""

    zamanlar: list[float] = field(default_factory=list)
    degerler: list[float] = field(default_factory=list)
    son: Olcum | None = None  # zamanı en büyük ölçüm

    def ekle(self, olcum: Olcum) -> None:
        if not self.zamanlar or olcum.t >= self.zamanlar[-1]:
            self.zamanlar.append(olcum.t)
            self.degerler.append(olcum.value)
        else:  # geç gelen, daha eski ölçüm: sıra bozulmasın
            sira = bisect_right(self.zamanlar, olcum.t)
            self.zamanlar.insert(sira, olcum.t)
            self.degerler.insert(sira, olcum.value)
        if self.son is None or olcum.t >= self.son.t:
            self.son = olcum

    def ilk_sira(self, simdi: float, sure: float) -> int:
        """Yaşı `sure` saniyeyi aşmayan ilk ölçümün sırası (sınır dahil); sonrakilerin hepsi de aşmaz."""
        return bisect_left(self.zamanlar, True, key=lambda t: simdi - t <= sure)

    def duyuluyor(self, simdi: float) -> bool:
        """Son PENCERE_SN içinde en az bir ölçüm var mı?"""
        return bool(self.zamanlar) and simdi - self.zamanlar[-1] <= PENCERE_SN


class SinyalDeposu:
    """Gelen paketlerden çift ölçümlerini biriktirir; verilen an için sinyalleri ve grafik serilerini hesaplar."""

    def __init__(self) -> None:
        self._ciftler: dict[str, _CiftKaydi] = {}  # çift anahtarı → ölçümler (ilk duyulma sırasıyla)
        self._kart_son: dict[str, float] = {}  # kart → kendi son paketinin anı
        self._alici_son: float | None = None  # alıcıdan gelen son paketin anı

    def ekle(self, paketler: Iterable[Paket]) -> None:
        """Bir tikin paketlerini işler. Aynı tikte iki yön de geldiyse çift için tek ölçüm oluşur; aynı yön
        bir tikte iki kez geldiyse sonuncusu geçerlidir (mock'ta da çift başına tik başına tek ölçüm var)."""
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
            kayit = self._ciftler.get(anahtar)
            if kayit is None:
                kayit = self._ciftler[anahtar] = _CiftKaydi()
            kayit.ekle(Olcum(**olcum))

    def sinyaller(self, simdi: float) -> list[CiftSinyali]:
        """Son PENCERE_SN içinde duyulan çiftler, ilk duyuldukları sırayla."""
        sonuc = []
        for anahtar, kayit in self._ciftler.items():
            if not kayit.duyuluyor(simdi):
                continue
            pencere = kayit.degerler[kayit.ilk_sira(simdi, PENCERE_SN):]
            a, b = anahtar.split("-")
            son = kayit.son
            sonuc.append(CiftSinyali(a, b, son.ab, son.ba, son.value, _ortanca(pencere), len(pencere)))
        return sonuc

    def gecmis(self, simdi: float) -> dict[str, list[tuple[int, float]]]:
        """Duyulan her çift için grafik serisi: (kaç sn önce, dBm), en eski başta; KOVA_SN'lik kovaların ortancası.

        Kovalar "şimdi"ye göredir (mock gibi): zaman ilerledikçe ölçümler kova değiştirir, seri her tikte
        yeniden hesaplanır.
        """
        sonuc = {}
        for anahtar, kayit in self._ciftler.items():
            if not kayit.duyuluyor(simdi):
                continue
            bas = kayit.ilk_sira(simdi, GRAFIK_SN)
            # Zaman sıralı olduğu için kova numarası eskiden yeniye artmaz; eksilisi azalmaz → ikili aramayla bölünür.
            kovalar = [-((simdi - t) // KOVA_SN) for t in kayit.zamanlar[bas:]]
            seri, i = [], 0
            while i < len(kovalar):
                j = bisect_right(kovalar, kovalar[i], i)
                seri.append((int(-kovalar[i]) * KOVA_SN, _ortanca(kayit.degerler[bas + i:bas + j])))
                i = j
            sonuc[anahtar] = seri
        return sonuc

    def gorulme_yasi(self, kart: str, simdi: float) -> float | None:
        """Kartın kendi son paketinden beri geçen süre (seenAgo); hiç paketi gelmediyse None."""
        son = self._kart_son.get(kart)
        return None if son is None else simdi - son

    def duyuldu_mu(self, kart: str) -> bool:
        """Kartın en az bir paketi alıcıya ulaştı mı?"""
        return kart in self._kart_son

    def alici_yasi(self, simdi: float) -> float | None:
        """Alıcıdan gelen son paketten beri geçen süre (receiverAge); hiç veri gelmediyse None."""
        return None if self._alici_son is None else simdi - self._alici_son

    def unut(self, simdi: float, korunan: Collection[str] = ()) -> None:
        """Eski ölçümleri atar; UNUTMA_SN'den uzun süredir duyulmayan çifti siler.

        `korunan`: duyulmasa da silinmeyecek çift anahtarları ("birlikte" sayılan çiftler; küme verilmeli).
        """
        for anahtar in list(self._ciftler):
            kayit = self._ciftler[anahtar]
            bas = kayit.ilk_sira(simdi, _SAKLAMA_SN)
            if bas:
                del kayit.zamanlar[:bas]
                del kayit.degerler[:bas]
            duyulmuyor = not kayit.zamanlar or simdi - kayit.zamanlar[-1] > UNUTMA_SN
            if duyulmuyor and anahtar not in korunan:
                del self._ciftler[anahtar]

    @property
    def olcum_sayisi(self) -> int:
        """Bellekte tutulan toplam ölçüm sayısı (yük ölçümü ve tanılama için)."""
        return sum(len(kayit.zamanlar) for kayit in self._ciftler.values())
