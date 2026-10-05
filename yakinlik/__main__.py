"""`python -m yakinlik` — sunucuyu başlatır; Ctrl+C ile kapanır. Etkinlikte bekçiyle çalıştırılır (`baslat.sh`)."""
import logging
import sys
from pathlib import Path

import uvicorn

from . import __surum__
from .ayar import AYAR_HATASI_KODU, Ayar, ayar_yukle, veri_klasoru
from .gunluk import gunlugu_kur
from .http.uygulama import uygulama_olustur

# Canlı akış (SSE) bağlantıları kendiliğinden kapanmaz; Ctrl+C'de en çok bu kadar beklenir, sonra kesilir.
KAPANIS_BEKLEME_SN = 1
CONFIG = Path("config.toml")
GUNLUK = Path("yakinlik.log")

gunluk = logging.getLogger("yakinlik")


def acilis_satiri(ayar: Ayar) -> str:
    """Hangi ayar dosyası, hangi arayüz, hangi veri: yanlış klasörden açılınca sessizce varsayılanlar kullanılmasın."""
    config = f"{CONFIG.resolve()} ({'var' if CONFIG.is_file() else 'yok, varsayılanlar'})"
    arayuz = f"{ayar.dist.resolve()} ({'var' if (ayar.dist / 'index.html').is_file() else 'derlenmemiş'})"
    veri = veri_klasoru(ayar)
    return (f"açılış: Yakınlık {__surum__} · kaynak {ayar.kaynak} · config {config} · arayüz {arayuz} · "
            f"veri {veri.resolve() if veri else 'kalıcı değil'} · http://{ayar.host}:{ayar.port}")


def main() -> None:
    gunlugu_kur(GUNLUK)
    try:
        ayar = ayar_yukle()
        uygulama = uygulama_olustur(ayar)  # kaynak ve veri burada kurulur: hatalı ayar da açılmadan yakalanır
    except ValueError as hata:
        gunluk.error("ayar hatası: %s", hata)
        sys.exit(AYAR_HATASI_KODU)
    gunluk.info(acilis_satiri(ayar))
    uvicorn.run(uygulama, host=ayar.host, port=ayar.port, timeout_graceful_shutdown=KAPANIS_BEKLEME_SN)
    gunluk.info("kapandı")


if __name__ == "__main__":
    main()
