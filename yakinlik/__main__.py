"""`python -m yakinlik` — sunucuyu başlatır; Ctrl+C ile kapanır."""
import uvicorn

from .ayar import ayar_yukle
from .http.uygulama import uygulama_olustur

# Canlı akış (SSE) bağlantıları kendiliğinden kapanmaz; Ctrl+C'de en çok bu kadar beklenir, sonra kesilir.
KAPANIS_BEKLEME_SN = 1


def main() -> None:
    try:
        ayar = ayar_yukle()
        uygulama = uygulama_olustur(ayar)  # kaynak burada kurulur: hatalı kaynak ayarı da açılmadan yakalanır
    except ValueError as hata:
        raise SystemExit(f"ayar hatası: {hata}")
    uvicorn.run(uygulama, host=ayar.host, port=ayar.port, timeout_graceful_shutdown=KAPANIS_BEKLEME_SN)


if __name__ == "__main__":
    main()
