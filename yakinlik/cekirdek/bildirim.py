"""Bildirim kuralları ve metinleri (brief §5.2). Metinler ve süreler mock ile aynı. Saf."""
import math
import time
from dataclasses import dataclass

from .kisi import Kisi

KAYIP_SN = 60  # kart bu kadar duyulmazsa "Kart sinyali kesildi"
GORUNUR_SN = 30  # bundan uzun duyulmayan kişi "görünmüyor" sayılır (boşta sayılmaz)
YALNIZ_SN = 360  # önemli yatırımcı bu kadar kimseyle görüşmezse uyarı
YALNIZ_EN_AZ_YILDIZ = 3
# Anlaşma süresi (dk), çiftteki en yüksek yıldıza göre (mock tablosu; PLAN Soru 10: Muhittin'le teyit edilecek).
ANLASMA_DK = {2: 11, 3: 8, 4: 11, 5: 8}


@dataclass(frozen=True)
class Bildirim:
    t: float  # duvar saati (epoch sn)
    clock: str  # "SS:DD"
    kind: str  # deal | repeat | idle_investor | lost | no_investor
    severity: str  # deal | warn | serious
    title: str
    detail: str
    people: tuple[str, ...]  # kart numaraları (/state sözleşmesi)

    def sozluk(self) -> dict:
        return {"t": self.t, "clock": self.clock, "kind": self.kind, "severity": self.severity,
                "title": self.title, "detail": self.detail, "people": list(self.people)}


def karsi_rol(a: Kisi, b: Kisi) -> bool:
    return {a.rol, b.rol} == {"investor", "founder"}


def anlasma_suresi_sn(a: Kisi, b: Kisi, zorla: float | None) -> float | None:
    """Kesintisiz birlikte geçmesi gereken süre; anlaşma olamıyorsa None. `zorla` verilirse rol aranmaz (mock)."""
    if zorla:
        return zorla
    if not karsi_rol(a, b):
        return None
    dakika = ANLASMA_DK.get(max(a.yildiz, b.yildiz))
    return None if dakika is None else dakika * 60


def _yildiz(kisi: Kisi) -> str:
    return "★" * kisi.yildiz


def _bildirim(duvar: float, kind: str, severity: str, title: str, detail: str, *kartlar: str) -> Bildirim:
    return Bildirim(duvar, time.strftime("%H:%M", time.localtime(duvar)), kind, severity, title, detail, kartlar)


def anlasma(duvar: float, a: Kisi, b: Kisi, kart_a: str, kart_b: str, birlikte_sn: float) -> Bildirim:
    yatirimci, diger = (a, b) if a.rol == "investor" else (b, a)
    dakika = math.floor(birlikte_sn / 60 + 0.5)  # JavaScript Math.round
    return _bildirim(duvar, "deal", "deal", "Potansiyel anlaşma",
                     f"{yatirimci.ad} ({_yildiz(yatirimci)}) ile {diger.gorunen_ad} {dakika} dakikadır birlikte.",
                     kart_a, kart_b)


def tekrar(duvar: float, a: Kisi, b: Kisi, kart_a: str, kart_b: str) -> Bildirim:
    return _bildirim(duvar, "repeat", "deal", "Yeniden bir arada",
                     f"{a.gorunen_ad} ile {b.gorunen_ad} anlaşma sonrası tekrar bir araya geldi.", kart_a, kart_b)


def kayip(duvar: float, kisi: Kisi, kart: str) -> Bildirim:
    return _bildirim(duvar, "lost", "serious", "Kart sinyali kesildi",
                     f"{kisi.gorunen_ad} (kart {kart}) 1 dk'dır duyulmuyor.", kart)


def yalniz(duvar: float, kisi: Kisi, kart: str) -> Bildirim:
    return _bildirim(duvar, "idle_investor", "warn", "Önemli yatırımcı yalnız",
                     f"{kisi.ad} ({_yildiz(kisi)}) 6 dk'dır kimseyle görüşmüyor.", kart)
