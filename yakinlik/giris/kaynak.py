"""Paket kaynağı arayüzü: benzetim, kayıt ve (B8'de) seri aynı biçimde tik üretir."""
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from .paket import Paket

if TYPE_CHECKING:
    from .benzetim import Benzetim

TIK_SN = 0.5  # gerçek zamanda tik aralığı; arayüze yayın kadansı da budur (2 Hz)


@dataclass(frozen=True)
class Tik:
    """Bir tikte alıcıdan gelen paketler ve tikin anı.

    `t` kaynağın ölçüm saatidir (saniye; paketlerin `t`'siyle aynı ölçek). Ölçüm yaşları (10 sn penceresi,
    grafik, son duyulma) "şimdi"yi buradan okur, işleyenin kendi saatinden değil: böylece hızlandırılmış
    benzetim ve kayıttan oynatma, canlı koşuyla birebir aynı sonucu verir. Paket gelmese de (alıcı kopuk)
    tik üretilir: zaman ilerler, yayın sürer.

    Kaynağın saati her açılışta sıfırdan başlar; etkinlik saati (`elapsed`, görüşme kayıtları) ise yeniden
    başlatmada sürmelidir (PLAN Bölüm 6, 9.2). İkisinin ilişkisi B2'de motor kurulurken kararlaştırılacak.
    """

    t: float
    paketler: tuple[Paket, ...]


class PaketKaynagi(Protocol):
    def tikler(self) -> AsyncGenerator[Tik, None]:
        """Tik akışı: gerçek zamanda TIK_SN aralıkla; kayıt kaynağında iz bitince biter."""

    @property
    def benzetim(self) -> "Benzetim | None":
        """Benzetim kaynağında sahte dünya (sunucu kayıt defterini kadrosundan kurar); diğer kaynaklarda None."""
