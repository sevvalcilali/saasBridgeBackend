"""Günlük (PLAN Bölüm 11): yakinlik.log, döner (5 × 5 MB); konsola da yazılır."""
import logging
from logging.handlers import RotatingFileHandler

from yakinlik.gunluk import gunlugu_kur


def test_gunluk_dosyaya_doner_bicimde_yazilir_ikinci_kurulum_cift_yazmaz(tmp_path):
    kok = logging.getLogger()
    once, seviye = list(kok.handlers), kok.level
    try:
        gunlugu_kur(tmp_path / "yakinlik.log")
        gunlugu_kur(tmp_path / "yakinlik.log")
        logging.getLogger("yakinlik.deneme").info("açılış denemesi")
        dosyalar = [h for h in kok.handlers if isinstance(h, RotatingFileHandler)]
        for h in dosyalar:
            h.flush()

        assert len(dosyalar) == 1
        assert (dosyalar[0].maxBytes, dosyalar[0].backupCount) == (5 * 1024 * 1024, 5)
        assert (tmp_path / "yakinlik.log").read_text(encoding="utf-8").count("açılış denemesi") == 1
    finally:
        kok.setLevel(seviye)
        for h in kok.handlers[:]:
            if h not in once:
                kok.removeHandler(h)
                h.close()
