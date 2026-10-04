#!/bin/sh
# Tek komutla başlatma: .venv yoksa kurar, sunucuyu çalıştırır. Argümanlar sunucuya geçer:
#   ./baslat.sh --port 8010
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  # Python 3.11+ gerekir; sistemdeki "python3" daha eski olabilir.
  PYTHON=""
  for aday in python3.11 python3.12 python3.13 python3; do
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
  if ! .venv/bin/pip install $KAYNAK -r requirements.txt; then
    rm -rf .venv  # yarım kurulum kalmasın; sonraki çalıştırma yeniden denesin
    exit 1
  fi
fi

exec .venv/bin/python -m yakinlik "$@"
