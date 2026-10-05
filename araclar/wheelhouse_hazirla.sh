#!/bin/sh
# Etkinlikte internet yok (PLAN İ7, R9): kurulum paketlerini önceden wheelhouse/ klasörüne indirir. baslat.sh ve
# baslat.bat wheelhouse/ varsa paketleri internetsiz oradan kurar.
#
# Etkinlik bilgisayarıyla AYNI işletim sisteminde ve Python sürümünde, internet varken çalıştırın: paketlerin bir kısmı
# derlenmiştir (pydantic-core, uvloop, httptools …) ve işletim sistemine özeldir. Windows için: araclar\wheelhouse_hazirla.bat
set -e
cd "$(dirname "$0")/.."

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

rm -rf wheelhouse
"$PYTHON" -m pip download --only-binary=:all: -r requirements.txt -d wheelhouse
echo "Hazır: wheelhouse/ ($(ls wheelhouse | wc -l | tr -d ' ') paket, $("$PYTHON" -c 'import platform, sys; print(platform.system(), platform.machine(), "Python", sys.version.split()[0])'))."
echo "Projeyle birlikte etkinlik bilgisayarına kopyalayın; ./baslat.sh internetsiz kurar."
