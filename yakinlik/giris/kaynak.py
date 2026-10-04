"""Paket kaynağı arayüzü: benzetim, kayıt ve (B8'de) seri aynı biçimde tik üretir."""
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Protocol

from .paket import Paket

TIK_SN = 0.5  # gerçek zamanda tik aralığı; arayüze yayın kadansı da budur (2 Hz)


@dataclass(frozen=True)
class Tik:
    """Bir tikte alıcıdan gelen paketler ve tikin anı.

    `t` kaynak saniyesidir (paketlerin `t`'siyle aynı ölçek): işleme katmanı "şimdi"yi buradan okur, kendi
    saatinden değil. Böylece hızlandırılmış benzetim ve kayıttan oynatma, canlı koşuyla birebir aynı zamanı
    taşır. Paket gelmese de (alıcı kopuk) tik üretilir: zaman ilerler, yayın sürer.
    """

    t: float
    paketler: tuple[Paket, ...]


class PaketKaynagi(Protocol):
    def tikler(self) -> AsyncGenerator[Tik, None]:
        """Tik akışı: gerçek zamanda TIK_SN aralıkla; kayıt kaynağında iz bitince biter."""
