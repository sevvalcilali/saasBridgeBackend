@echo off
rem Tek komutla baslatma (Windows): sanal ortam hazir degilse kurar, sunucuyu calistirir.
rem Argumanlar sunucuya gecer:  baslat.bat --port 8010
rem (Bu dosyada Turkce harf yok: cmd kod sayfasinda bozuk gorunmesin.)
rem NOT: Windows'ta henuz denenmedi (PLAN B7 dagitim provasi).
setlocal
cd /d "%~dp0"

rem "Hazir" = bu makinede calisan bir .venv var ve sunucunun paketleri ice aktarilabiliyor. Klasorun var
rem olmasi yetmez: yarida kesilmis kurulum ya da baska isletim sisteminden kopyalanmis .venv calismaz.
set HAZIR=
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python.exe -c "import fastapi, uvicorn, serial" >nul 2>&1
  if not errorlevel 1 set HAZIR=1
)

if not defined HAZIR (
  if exist .venv rmdir /s /q .venv
  py -3 -c "import sys; sys.exit(sys.version_info < (3, 11))"
  if errorlevel 1 (
    echo Python 3.11 ya da ustu bulunamadi.
    exit /b 1
  )
  py -3 -m venv .venv
  rem Etkinlikte internet yok: wheelhouse\ varsa paketler oradan kurulur.
  if exist wheelhouse (
    .venv\Scripts\python.exe -m pip install --no-index --find-links wheelhouse -r requirements.txt
  ) else (
    .venv\Scripts\python.exe -m pip install -r requirements.txt
  )
  if errorlevel 1 (
    rem Yarim kurulum kalmasin.
    rmdir /s /q .venv
    exit /b 1
  )
)

.venv\Scripts\python.exe -m yakinlik %*
