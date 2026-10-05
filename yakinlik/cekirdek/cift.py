"""Bir kart çiftinin "birlikte mi?" kararı: eşik üstü / altı sayaçları, giriş ve çıkış gecikmesi. Saf.

Karar (Şevval, 05.10.2026): 10 sn ortancası eşiğin üstünde kesintisiz GIRIS_SN kalınca çift "birlikte" olur;
1 dakikadan kısa yan yana gelişler sayılmaz. Bekleme süresi görüşmeye sayılır: görüşme eşiğin aşıldığı andan
başlamış kabul edilir. Çıkış kuralı brief §2 ile aynı: CIKIS_SN altta kalınca biter; o süre de görüşmeye sayılır.
"""
from dataclasses import dataclass
from enum import Enum

GIRIS_SN = 60
CIKIS_SN = 15
ESIK_ARALIGI = (-100, -20)  # dBm; Kurulum ekranı ve /control bu aralığı kabul eder


class Gecis(Enum):
    YOK = "yok"
    BASLADI = "basladi"
    BITTI = "bitti"


@dataclass(slots=True)
class CiftDurumu:
    ustunde_sn: float = 0.0  # kesintisiz eşik üstü süre
    altinda_sn: float = 0.0  # kesintisiz eşik altı süre
    birlikte: bool = False
    birlikte_sn: float = 0.0  # bu görüşmenin süresi (bekleme dahil)


def ilerlet(durum: CiftDurumu, ustunde: bool, dt: float) -> tuple[Gecis, float]:
    """Bir tik ilerletir. Döndürür: (geçiş, bu tikte görüşme süresine eklenen saniye).

    Görüşme başladığı tikte eklenen süre beklemenin tamamıdır; sonraki her tik `dt` ekler (bittiği tik dahil).
    """
    if ustunde:
        durum.ustunde_sn += dt
        durum.altinda_sn = 0.0
    else:
        durum.altinda_sn += dt
        durum.ustunde_sn = 0.0
    if not durum.birlikte:
        if ustunde and durum.ustunde_sn >= GIRIS_SN:
            durum.birlikte = True
            durum.birlikte_sn = durum.ustunde_sn
            return Gecis.BASLADI, durum.ustunde_sn
        return Gecis.YOK, 0.0
    durum.birlikte_sn += dt
    if durum.altinda_sn >= CIKIS_SN:
        durum.birlikte = False
        return Gecis.BITTI, dt
    return Gecis.YOK, dt
