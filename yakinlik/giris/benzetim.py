"""Donanımsız benzetim: mock sunucunun (SaasBridge/mock-server/mock.js) `tik()` dinamiğinin paket üreten hali.

Senaryo zamanlaması mock ile aynıdır (benzetim saniyesi): atanmamış Kart 14 → 45. sn; kayıp kart →
180–300. sn arası susar; alıcı kopması → 120. sn'de 20 sn, sonra 480. sn'den başlayarak her 360 sn'de.
Rastgelelik tohumludur ama mock'un üretecinin aynısı değildir: aynı tohum hep aynı paketleri verir,
mock'la birebir aynı sayıları vermez.

`Benzetim` saf dünyadır (zaman dışarıdan verilir, giriş/çıkış yok); `BenzetimKaynak` onu gerçek zamanda
tikletir. `Benzetim.kadro` sahte kişileri taşır: sunucu benzetim modunda kayıt defterini bununla kurar.
"""
import asyncio
import logging
import math
import random
from collections.abc import AsyncGenerator, Awaitable, Callable
from dataclasses import dataclass, field

from .kaynak import TIK_SN, Tik
from .paket import Paket

gunluk = logging.getLogger(__name__)

# Ad ve kurum listeleri mock'tan aynen.
ADLAR = (
    "Ayşe", "Mehmet", "Zeynep", "Emre", "Elif", "Burak", "Selin", "Kaan", "Merve", "Deniz", "Cem", "İrem", "Onur",
    "Gizem", "Barış", "Ece", "Tolga", "Naz", "Serkan", "Pelin", "Uğur", "Aslı", "Kerem", "Duygu", "Volkan", "Buse",
    "Halil", "Melis", "Ozan", "Ceren",
)
SOYADLAR = (
    "Demir", "Kaya", "Şahin", "Yılmaz", "Çelik", "Arslan", "Doğan", "Kılıç", "Aydın", "Öztürk", "Erdem", "Polat",
    "Koç", "Güneş", "Tekin", "Aksoy", "Bulut", "Korkmaz", "Yavuz", "Özkan",
)
FONLAR = (
    "Atlas Ventures", "Boğaz Capital", "Anadolu Fonu", "Ege Girişim", "Meridyen VC", "Kule Yatırım",
    "Fener Partners", "Doruk Capital", "Liman Ventures", "Kuzey Fonu", "Safir Yatırım", "Çınar Capital",
)
SIRKETLER = (
    "Nova Robotik", "Peak Enerji", "Bitki Teknoloji", "Akıllı Tarım", "Veri Köprüsü", "Sağlık Cebi", "Hızlı Kargo",
    "Temiz Deniz", "Oyun Evreni", "Fin Radar", "Eğitim Yıldızı", "Şehir Sensör", "Mutfak Robotu", "Gök Harita",
    "Ses Analiz",
)

ATANMAMIS_KART = "14"  # kimseye atanmamış kart senaryosuna ayrılmıştır
ATANMAMIS_SN = 45
KAYIP_ARALIK = (180, 300)  # bu aralıkta bir kart susar
EN_COK_KISI = 97  # kart havuzu 2–99, 14 hariç
YEDEK_ADET = 6  # masada açık duran yedek kartlar
YAN_YANA_DBM, AYRI_DBM = -52, -84  # yan yana duran ve ayrılmış çiftin sinyal merkezi
# Gruplar (Şevval isteği 2026-10; mock'tan fark): boştaki kart bazen yan yana duran bir gruba katılır ve gruptaki
# herkesle yan yana durur → panoda 3–5 kişilik gruplar. Mock yalnız ikili eşleştirir.
GRUBA_KATILMA = 0.35  # boştaki kart eşleşeceği tikte bu olasılıkla var olan bir gruba katılır
EN_BUYUK_GRUP = 5


@dataclass(frozen=True)
class SahteKisi:
    kart: str
    ad: str
    rol: str  # investor | founder | guest
    kurum: str
    yildiz: int  # yatırımcıda 2–5, diğerlerinde 0


@dataclass
class _Kart:
    """Salondaki fiziksel kart."""

    no: str
    rol: str | None  # eşleşme eğilimi için; kişisiz kartta None
    esler: set[str] = field(default_factory=set)  # şu an yan yana durduğu kartlar


@dataclass
class _Cift:
    """En az bir kez yan yana gelmiş iki kart; ayrıldıktan sonra da birbirini zayıf duyar."""

    a: str
    b: str
    hedef_sn: float  # yan yana kalacakları süre
    bias: float  # çifte özgü sinyal kayması
    fiziksel: bool = True
    fiziksel_sn: float = 0.0


def _yuvarla(x: float) -> int:
    """JavaScript `Math.round` gibi: buçuk yukarı (Python `round` buçuğu çifte yuvarlar)."""
    return math.floor(x + 0.5)


def _karsi_rol(x: _Kart, y: _Kart) -> bool:
    return {x.rol, y.rol} == {"investor", "founder"}


def _kopma_penceresi(t: float, dt: float) -> bool:
    sure = max(20, dt * 4)  # hızlandırılmış zamanda pencere en az 4 tik sürsün, yoksa tek tikte atlanır
    return 120 <= t < 120 + sure or (t >= 480 and (t - 480) % 360 < sure)


def _alici_rssi(kart: str, t: float) -> float:
    """Mock ile aynı: alıcı kartları masadan zayıf duyar (−72 − no mod 15, ±3 sn'ye bağlı titreşim).
    Kartı alıcıya yaklaştırma ("yaklaştır ve tanı" demosu) yalnız mock'ta; gerçek kart elle yaklaştırılır."""
    no = int(kart)
    titresim = (no * 13 + math.floor(t)) % 7 - 3
    return _yuvarla((-72 - no % 15 + titresim) * 10) / 10


class Benzetim:
    def __init__(self, kisi: int = 25, tohum: int = 42, kopma: bool = True, gruplar: bool = True) -> None:
        """`gruplar=False`: mock'un birebir davranışı (yalnız ikili; aynı tohumla eski paketlerin aynısı)."""
        self._rng = random.Random(tohum)
        self._kopma = kopma
        self._gruplar = gruplar
        self.kadro = self._kadro_uret(kisi)
        kullanilan = {sahte.kart for sahte in self.kadro} | {ATANMAMIS_KART}
        self.masadaki = tuple(str(no) for no in range(2, 100) if str(no) not in kullanilan)[:YEDEK_ADET]
        self._kartlar = [_Kart(sahte.kart, sahte.rol) for sahte in self.kadro]
        self._ciftler: dict[tuple[str, str], _Cift] = {}
        self.sim_sn = 0.0
        self._atanmamis_geldi = False
        self._kayip: _Kart | None = None

    def tik(self, dt: float) -> Tik:
        """Dünyayı `dt` benzetim saniyesi ilerletir; o tikte alıcıya ulaşan paketleri döndürür."""
        kopuk = self._kopma and _kopma_penceresi(self.sim_sn, dt)
        self.sim_sn += dt
        t = self.sim_sn
        if not self._atanmamis_geldi and t >= ATANMAMIS_SN:
            self._atanmamis_geldi = True
            # Masa kartı daha önce birine verdiyse ya da kart masadaysa ikinci kopyası eklenmez (mock ile aynı).
            if not self._salondaki(ATANMAMIS_KART) and ATANMAMIS_KART not in self.masadaki:
                self._kartlar.append(_Kart(ATANMAMIS_KART, None))
        if self._kayip is None and t >= KAYIP_ARALIK[0] and self._kartlar:
            self._kayip = self._kartlar[len(self._kartlar) // 3]
            for es in list(self._kayip.esler):
                self._ayir(self._kayip.no, es)
        susan = self._kayip if self._kayip is not None and KAYIP_ARALIK[0] <= t < KAYIP_ARALIK[1] else None
        if kopuk:
            return Tik(t, ())  # alıcı yok: hiç paket gelmez, dünya da donar (mock ile aynı)
        self._eslestir(dt, susan)
        duyulan = self._olc(dt, susan)
        paketler = [Paket(no, tuple(liste), t, _alici_rssi(no, t)) for no, liste in duyulan.items()]
        # Masadaki yedekler açıktır (alıcı duyar) ama kimseyle ölçülmez; mock'ta da çiftleri yoktur.
        paketler += [Paket(no, (), t, _alici_rssi(no, t)) for no in self.masadaki]
        return Tik(t, tuple(paketler))

    def kart_ver(self, kart: str, rol: str) -> None:
        """Masa kartı birine verdi: kart salona girer (zaten salondaysa yalnız rolü güncellenir), masadan çıkar."""
        self.masadaki = tuple(no for no in self.masadaki if no != kart)
        salondaki = self._salondaki(kart)
        if salondaki is None:
            self._kartlar.append(_Kart(kart, rol))
        else:
            salondaki.rol = rol

    def kart_al(self, kart: str, masaya: bool) -> None:
        """Kart salondan çıkar: iadede masaya döner ve açık durur; değişimde bırakılan kart kapanır."""
        salondaki = self._salondaki(kart)
        if salondaki is not None:
            for es in list(salondaki.esler):
                self._ayir(kart, es)
            self._kartlar.remove(salondaki)
        if masaya and kart not in self.masadaki:
            self.masadaki = (*self.masadaki, kart)

    def _salondaki(self, kart: str) -> "_Kart | None":
        return next((salondaki for salondaki in self._kartlar if salondaki.no == kart), None)

    def _kadro_uret(self, istenen: int) -> tuple[SahteKisi, ...]:
        adet = min(istenen, EN_COK_KISI)
        if adet < istenen:
            gunluk.warning("--kisi=%d kart havuzunu aşıyor (kart no 2–99, 14 hariç); %d kişiyle başlıyor", istenen, adet)
        yatirimci = max(2, _yuvarla(adet * 0.4))
        misafir = max(1, _yuvarla(adet * 0.12))
        girisimci = max(0, adet - yatirimci - misafir)
        havuz = [str(no) for no in range(2, 100) if str(no) != ATANMAMIS_KART]
        self._rng.shuffle(havuz)

        kadro: list[SahteKisi] = []

        def ekle(rol: str, kurum: str, yildiz: int) -> None:
            sira = len(kadro)
            ad = f"{ADLAR[sira % len(ADLAR)]} {SOYADLAR[(sira * 7) % len(SOYADLAR)]}"
            kadro.append(SahteKisi(havuz.pop(), ad, rol, kurum, yildiz))

        for i in range(yatirimci):
            ekle("investor", FONLAR[i % len(FONLAR)], self._rng.choice((2, 3, 3, 3, 4, 4, 5)))
        for i in range(girisimci):
            ekle("founder", SIRKETLER[i % len(SIRKETLER)], 0)
        for _ in range(misafir):
            ekle("guest", "", 0)
        return tuple(kadro)

    def _eslestir(self, dt: float, susan: _Kart | None) -> None:
        """Boştaki kartlar rastgele yan yana gelir; yatırımcı ile girişimci birbirini daha çok bulur. Bazen boştaki kart
        var olan bir gruba katılır (gruptaki herkesle yan yana); grup en çok EN_BUYUK_GRUP kişi."""
        bosta = [kart for kart in self._kartlar if not kart.esler and kart is not susan]
        olasilik = 0.010 * dt  # kart başına tik olasılığı
        for kart in bosta:
            if kart.esler or self._rng.random() > olasilik:
                continue
            gruplar = self._katilinabilir_gruplar(susan) if self._gruplar else []
            if gruplar and self._rng.random() < GRUBA_KATILMA:
                # Eşleşmedeki eğilim burada da: karşı rolden birinin olduğu gruba daha çok katılır.
                karsi = [grup for grup in gruplar if any(_karsi_rol(kart, uye) for uye in grup)]
                grup = self._rng.choice(karsi if karsi and self._rng.random() < 0.7 else gruplar)
                hedef = self._rng.uniform(2, 10) * 60  # katılan, gruptaki herkesten aynı anda ayrılır
                for uye in grup:
                    self._yan_yana(kart, uye, hedef)
                continue
            adaylar = [x for x in bosta if x is not kart and not x.esler]
            if not adaylar:
                continue
            karsi = [x for x in adaylar if _karsi_rol(kart, x)]
            es = self._rng.choice(karsi if karsi and self._rng.random() < 0.7 else adaylar)
            self._yan_yana(kart, es, self._rng.uniform(2, 14) * 60)

    def _yan_yana(self, x: _Kart, y: _Kart, hedef_sn: float) -> None:
        x.esler.add(y.no)
        y.esler.add(x.no)
        a, b = sorted((x.no, y.no), key=int)
        self._ciftler[(a, b)] = _Cift(a, b, hedef_sn=hedef_sn, bias=self._rng.uniform(-3, 3))

    def _katilinabilir_gruplar(self, susan: _Kart | None) -> list[list[_Kart]]:
        """Yan yana duran gruplar: yan yanalık zincirinin bütünü (A–B ve B–C → A, B, C), kart sırasıyla. Dolu ya da susan
        kartlı gruplar hariç."""
        kartlar = {kart.no: kart for kart in self._kartlar}
        gruplar, gorulen = [], set()
        for kart in self._kartlar:
            if not kart.esler or kart.no in gorulen:
                continue
            grup, yigin = set(), [kart.no]
            while yigin:
                no = yigin.pop()
                if no in grup or no not in kartlar:
                    continue
                grup.add(no)
                yigin.extend(kartlar[no].esler - grup)
            gorulen |= grup
            uyeler = [kartlar[no] for no in sorted(grup, key=int)]
            if len(uyeler) < EN_BUYUK_GRUP and susan not in uyeler:
                gruplar.append(uyeler)
        return gruplar

    def _olc(self, dt: float, susan: _Kart | None) -> dict[str, list[tuple[str, float]]]:
        """Her çift için o tikin ölçümü: kart → [(duyduğu kart, dBm)]. Susan kart ne duyar ne duyulur."""
        duyulan: dict[str, list[tuple[str, float]]] = {kart.no: [] for kart in self._kartlar if kart is not susan}
        for cift in self._ciftler.values():
            if cift.fiziksel:
                cift.fiziksel_sn += dt
                if cift.fiziksel_sn >= cift.hedef_sn or (susan is not None and susan.no in (cift.a, cift.b)):
                    self._ayir(cift.a, cift.b)
            merkez = (YAN_YANA_DBM if cift.fiziksel else AYRI_DBM) + cift.bias
            # Her yön %5 olasılıkla o tikte gelmez.
            ab = None if self._rng.random() < 0.05 else self._rng.gauss(merkez, 3)
            ba = None if self._rng.random() < 0.05 else self._rng.gauss(merkez + self._rng.uniform(-2, 2), 3)
            if cift.a in duyulan and cift.b in duyulan:
                if ab is not None:
                    duyulan[cift.a].append((cift.b, ab))
                if ba is not None:
                    duyulan[cift.b].append((cift.a, ba))
        return duyulan

    def _ayir(self, x: str, y: str) -> None:
        a, b = sorted((x, y), key=int)
        cift = self._ciftler.get((a, b))
        if cift is not None:
            cift.fiziksel = False
        for kart in self._kartlar:
            if kart.no == x:
                kart.esler.discard(y)
            elif kart.no == y:
                kart.esler.discard(x)


class BenzetimKaynak:
    """`Benzetim`i gerçek zamanda tikletir: her TIK_SN'de bir tik; `hiz` benzetim zamanını çarpar."""

    def __init__(
        self, benzetim: Benzetim, hiz: float = 1.0, bekle: Callable[[float], Awaitable[None]] = asyncio.sleep
    ) -> None:
        self.benzetim = benzetim
        self._hiz = hiz
        self._bekle = bekle

    async def tikler(self) -> AsyncGenerator[Tik, None]:
        while True:
            await self._bekle(TIK_SN)
            yield self.benzetim.tik(TIK_SN * self._hiz)
