"""Günlük (PLAN Bölüm 11): konsola ve dönen dosyaya (5 × 5 MB). Açılış / kapanış, yazma istekleri, sıfırlama, bildirimler,
hatalar yazılır; ölçümler yazılmaz (hacim)."""
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

DOSYA_BOYUTU = 5 * 1024 * 1024
DOSYA_SAYISI = 5
_BICIM = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def gunlugu_kur(dosya: Path) -> None:
    """Kök günlüğe dosya ve konsol çıkışı ekler; yeniden çağrılırsa öncekileri değiştirir (iki kez yazmaz)."""
    kok = logging.getLogger()
    for eski in [isleyici for isleyici in kok.handlers if getattr(isleyici, "yakinlik", False)]:
        kok.removeHandler(eski)
        eski.close()
    bicim = logging.Formatter(_BICIM)
    for isleyici in (
        RotatingFileHandler(dosya, maxBytes=DOSYA_BOYUTU, backupCount=DOSYA_SAYISI, encoding="utf-8"),
        logging.StreamHandler(),
    ):
        isleyici.setFormatter(bicim)
        isleyici.yakinlik = True
        kok.addHandler(isleyici)
    kok.setLevel(logging.INFO)
