"""Zaman kaynağı. Çekirdek zamanı parametre olarak alır; saat yalnız kenarlarda (motor, HTTP) okunur."""
import time
from typing import Protocol


class Saat(Protocol):
    def simdi(self) -> float:
        """Duvar saati (epoch saniyesi): bildirim zamanı, `clock`, kalıcılık damgaları."""

    def monotonic(self) -> float:
        """Geri gitmeyen saat (saniye): `elapsed`, süre birikimi."""


class GercekSaat:
    def simdi(self) -> float:
        return time.time()

    def monotonic(self) -> float:
        return time.monotonic()


class SahteSaat:
    """Testler için: yalnız `ilerlet` çağrılınca ilerler."""

    def __init__(self, simdi: float = 0.0, monotonic: float = 0.0) -> None:
        self._simdi = simdi
        self._monotonic = monotonic

    def simdi(self) -> float:
        return self._simdi

    def monotonic(self) -> float:
        return self._monotonic

    def ilerlet(self, saniye: float) -> None:
        self._simdi += saniye
        self._monotonic += saniye
