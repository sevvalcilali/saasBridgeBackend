"""Bekçi (PLAN R5): `python -m yakinlik.bekci [argümanlar]` sunucuyu alt süreçte çalıştırır; çökerse yeniden başlatır.

Durur: temiz kapanışta (Ctrl+C), argüman ya da ayar hatasında, sunucu açılır açılmaz üst üste kapanıyorsa (ör. port
başka programda: sonsuza dek denemek yerine söyler). `--yeni-etkinlik` yalnız ilk açılışta geçer: yoksa her çöküşte
veri yedeğe taşınır, etkinlik boş başlardı. Kendisi SIGTERM alırsa sunucuyu da kapatır.
"""
import signal
import subprocess
import sys
import time
from collections.abc import Sequence

from .ayar import AYAR_HATASI_KODU

YENIDEN_BASLATMA_SN = 2
HIZLI_COKUS_SN = 10  # sunucu bundan kısa yaşadıysa "açılır açılmaz kapandı"
ARDISIK_HIZLI_COKUS = 3  # bu kadar üst üste hızlı kapanışta vazgeçilir
_DURDURAN = {0, 2, AYAR_HATASI_KODU}  # temiz kapanış, argüman hatası (argparse), açılamadı (ayar hatası, port dolu)
SUNUCU = (sys.executable, "-m", "yakinlik")


class _Sonlandir(Exception):
    pass


def _yaz(metin: str) -> None:
    print(f"bekçi: {metin}", flush=True)


def _bekle(surec: subprocess.Popen) -> int | None:
    """Sunucunun çıkış kodu; Ctrl+C geldiyse (sunucuya da gider) temiz kapanmasını bekler ve None döner."""
    kesildi = False
    while True:
        try:
            kod = surec.wait()
            return None if kesildi else kod
        except KeyboardInterrupt:
            kesildi = True


def _sonlandir(*_) -> None:
    raise _Sonlandir


def main(argumanlar: Sequence[str] | None = None, sunucu: Sequence[str] = SUNUCU) -> int:
    argumanlar = list(sys.argv[1:] if argumanlar is None else argumanlar)
    onceki_isleyici = signal.signal(signal.SIGTERM, _sonlandir)
    hizli = 0
    surec = None
    try:
        while True:
            bas = time.monotonic()
            surec = subprocess.Popen([*sunucu, *argumanlar])
            _yaz(f"sunucu başlatıldı (pid {surec.pid})")
            kod = _bekle(surec)
            if kod is None or kod == 0:
                return 0
            if kod in _DURDURAN:
                _yaz(f"sunucu açılamadı (kod {kod}); yeniden başlatılmıyor. Yukarıdaki hatayı düzeltin.")
                return kod
            hizli = hizli + 1 if time.monotonic() - bas < HIZLI_COKUS_SN else 0
            if hizli >= ARDISIK_HIZLI_COKUS:
                _yaz(f"sunucu açılır açılmaz {hizli} kez üst üste kapandı (son kod {kod}); vazgeçildi. "
                     "Yukarıdaki hatayı düzeltip yeniden başlatın.")
                return 1
            _yaz(f"sunucu beklenmedik biçimde kapandı (kod {kod}); {YENIDEN_BASLATMA_SN} sn sonra yeniden başlatılıyor")
            argumanlar = [arguman for arguman in argumanlar if arguman != "--yeni-etkinlik"]
            time.sleep(YENIDEN_BASLATMA_SN)
    except KeyboardInterrupt:  # yeniden başlatma beklenirken Ctrl+C
        return 0
    except _Sonlandir:
        if surec is not None and surec.poll() is None:
            surec.terminate()
            surec.wait()
        return 0
    finally:
        signal.signal(signal.SIGTERM, onceki_isleyici)


if __name__ == "__main__":
    sys.exit(main())
