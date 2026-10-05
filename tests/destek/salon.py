"""Çekirdek testleri için küçük salon: elle tanımlanan çiftlerle tik üretir."""
from dataclasses import dataclass

from yakinlik.cekirdek.alan import Alan
from yakinlik.cekirdek.kisi import KisiDefteri
from yakinlik.giris.kaynak import Tik
from yakinlik.giris.paket import Paket

DT = 0.5
DUVAR = 1_800_000_000.0  # bildirim zamanları için sabit duvar saati başlangıcı
YAKIN, UZAK = -55.0, -85.0  # eşik (−72) üstü / altı


@dataclass(frozen=True)
class OrnekKisi:
    kart: str
    ad: str
    rol: str
    kurum: str
    yildiz: int


# k1–k4: kart 2–5. Kart 14 kimseye atanmamış; kart 101 dinleyici cihaz.
KADRO = (
    OrnekKisi("2", "Ayşe Demir", "investor", "Atlas Ventures", 3),
    OrnekKisi("3", "Mehmet Kılıç", "founder", "Nova Robotik", 0),
    OrnekKisi("4", "Zeynep Şahin", "guest", "", 0),
    OrnekKisi("5", "Emre Yılmaz", "investor", "Boğaz Capital", 2),
)
KARTLAR = ("2", "3", "4", "5", "14", "101")


def tik_uret(t, ciftler=None, sessiz=(), kartlar=KARTLAR):
    """t anında her kart bir paket yollar (sessizler hariç). `ciftler`: {(a, b): dBm}, iki yönde de duyulur."""
    duyulan = {kart: [] for kart in kartlar if kart not in sessiz}
    for (a, b), rssi in (ciftler or {}).items():
        if a in duyulan and b in duyulan:
            duyulan[a].append((b, rssi))
            duyulan[b].append((a, rssi))
    return Tik(t, tuple(Paket(kart, tuple(liste), 80, t) for kart, liste in duyulan.items()))


class Salon:
    def __init__(self, alan=None, **ayar):
        self.alan = alan or Alan(KisiDefteri.kadrodan(KADRO), baslangic=0.0, **ayar)
        self.t = 0.0

    @property
    def duvar(self):
        return DUVAR + self.t

    def gecir(self, saniye, ciftler=None, sessiz=(), alici_kopuk=False, kartlar=KARTLAR):
        for _ in range(round(saniye / DT)):
            self.t += DT
            tik = Tik(self.t, ()) if alici_kopuk else tik_uret(self.t, ciftler, sessiz, kartlar)
            self.alan.tik(tik, self.duvar)
        return self
