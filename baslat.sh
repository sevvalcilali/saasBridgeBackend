#!/bin/sh
# Tek komutla başlatma: sanal ortam hazır değilse kurar, sunucuyu çalıştırır. Argümanlar sunucuya geçer:
#   ./baslat.sh --port 8010
set -e
cd "$(dirname "$0")"

# "Hazır" = bu makinede çalışan bir .venv var ve sunucunun paketleri içe aktarılabiliyor. Klasörün var
# olması yetmez: yarıda kesilmiş kurulum ya da başka işletim sisteminden kopyalanmış .venv çalışmaz.
hazir() {
  [ -x .venv/bin/python ] && .venv/bin/python -c 'import fastapi, uvicorn, serial' >/dev/null 2>&1
}

if ! hazir; then
  rm -rf .venv
  # Python 3.11+ gerekir; sistemdeki "python3" daha eski olabilir.
  PYTHON=""
  for aday in python3.11 python3.12 python3.13 python3.14 python3; do
    if command -v "$aday" >/dev/null 2>&1 && "$aday" -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
      PYTHON=$aday
      break
    fi
  done
  if [ -z "$PYTHON" ]; then
    echo "Python 3.11 ya da üstü bulunamadı." >&2
    exit 1
  fi
  "$PYTHON" -m venv .venv
  # Etkinlikte internet yok: wheelhouse/ varsa paketler oradan kurulur.
  if [ -d wheelhouse ]; then
    KAYNAK="--no-index --find-links wheelhouse"
  else
    KAYNAK=""
  fi
  if ! .venv/bin/python -m pip install $KAYNAK -r requirements.txt; then
    rm -rf .venv  # yarım kurulum kalmasın
    exit 1
  fi
fi

# Bekçi: sunucu çökerse yeniden başlatır (Ctrl+C ve ayar hatasında durur).
exec .venv/bin/python -m yakinlik.bekci "$@"
