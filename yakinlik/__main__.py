"""`python -m yakinlik` — sunucuyu başlatır; Ctrl+C ile kapanır."""
import uvicorn

from .ayar import ayar_yukle
from .http.uygulama import uygulama_olustur


def main() -> None:
    try:
        ayar = ayar_yukle()
    except ValueError as hata:
        raise SystemExit(f"ayar hatası: {hata}")
    uvicorn.run(uygulama_olustur(ayar), host=ayar.host, port=ayar.port)


if __name__ == "__main__":
    main()
