@echo off
rem Tek komutla baslatma (Windows): .venv yoksa kurar, sunucuyu calistirir.
rem Argumanlar sunucuya gecer:  baslat.bat --port 8010
rem (Bu dosyada Turkce harf yok: cmd kod sayfasinda bozuk gorunmesin.)
setlocal
cd /d "%~dp0"

if not exist .venv (
  py -3 -c "import sys; sys.exit(sys.version_info < (3, 11))"
  if errorlevel 1 (
    echo Python 3.11 ya da ustu bulunamadi.
    exit /b 1
  )
  py -3 -m venv .venv
  rem Etkinlikte internet yok: wheelhouse\ varsa paketler oradan kurulur.
  if exist wheelhouse (
    .venv\Scripts\pip install --no-index --find-links wheelhouse -r requirements.txt
  ) else (
    .venv\Scripts\pip install -r requirements.txt
  )
  if errorlevel 1 (
    rem Yarim kurulum kalmasin; sonraki calistirma yeniden denesin.
    rmdir /s /q .venv
    exit /b 1
  )
)

.venv\Scripts\python -m yakinlik %*
