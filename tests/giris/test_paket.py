"""Paket (PLAN B1.1): kart paketi ve kişi kartı / dinleyici cihaz ayrımı."""
import pytest

from yakinlik.giris.paket import Paket, kisi_karti_mi


@pytest.mark.parametrize(
    ("kart", "beklenen"),
    [("1", True), ("14", True), ("99", True), ("0", False), ("100", False), ("250", False), ("", False), ("kart", False)],
)
def test_kisi_karti_1_ile_99_arasidir(kart, beklenen):
    assert kisi_karti_mi(kart) is beklenen


def test_dinleyici_cihaz_paketi_isaretlenir_ama_icerigi_durur():
    # 100+ numaralı cihaz kişi değildir ama paketi atılmaz: /api/cards gösterebilir.
    paket = Paket(kart="101", duyulanlar=(("14", -60.0),), pil=None, t=3.0)

    assert paket.dinleyici is True
    assert paket.duyulanlar == (("14", -60.0),)


def test_kisi_karti_paketi_dinleyici_degildir():
    assert Paket(kart="14", duyulanlar=(), pil=80, t=3.0).dinleyici is False
