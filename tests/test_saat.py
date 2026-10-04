"""Saat arayüzü: gerçek ve sahte uygulama (PLAN B0.3)."""
import time

from yakinlik.saat import GercekSaat, SahteSaat


def test_sahte_saat_yalniz_ilerletilince_ilerler():
    saat = SahteSaat(simdi=1_000.0, monotonic=5.0)

    saat.ilerlet(2.5)

    assert saat.simdi() == 1_002.5
    assert saat.monotonic() == 7.5


def test_gercek_saat_simdi_duvar_saatidir():
    once = time.time()
    deger = GercekSaat().simdi()
    sonra = time.time()

    assert once <= deger <= sonra


def test_gercek_saat_monotonic_monotonik_saattir():
    once = time.monotonic()
    deger = GercekSaat().monotonic()
    sonra = time.monotonic()

    assert once <= deger <= sonra
