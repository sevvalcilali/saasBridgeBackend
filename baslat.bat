@echo off
rem Tek komutla baslatma (Windows): sanal ortam hazir degilse kurar, sunucuyu bekciyle calistirir (cokerse yeniden
rem baslatir). Argumanlar sunucuya gecer:  baslat.bat --port 8010
rem (Bu dosyada Turkce harf yok: cmd kod sayfasinda bozuk gorunmesin.)
rem NOT: Windows'ta henuz denenmedi (docs\DAGITIM.md).
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
  rem Python 3.11+: once "py" baslaticisi, yoksa PATH'teki "python".
  set PYTHON=py -3
  py -3 -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
  if errorlevel 1 set PYTHON=python
  call :surum_denetle
  if errorlevel 1 (
    echo Python 3.11 ya da ustu bulunamadi. python.org'dan kurun ^(kurarken "Add to PATH" isaretli olsun^).
    goto :hata
  )
  call %%PYTHON%% -m venv .venv
  rem Etkinlikte internet yok: wheelhouse\ varsa paketler oradan kurulur (araclar\wheelhouse_hazirla.bat).
  if exist wheelhouse (
    .venv\Scripts\python.exe -m pip install --no-index --find-links wheelhouse -r requirements.txt
  ) else (
    .venv\Scripts\python.exe -m pip install -r requirements.txt
  )
  if errorlevel 1 (
    rem Yarim kurulum kalmasin.
    rmdir /s /q .venv
    echo Kurulum basarisiz. wheelhouse\ klasoru bu bilgisayarin Windows ve Python surumuyle mi hazirlandi?
    goto :hata
  )
)

.venv\Scripts\python.exe -m yakinlik.bekci %*
if errorlevel 1 goto :hata
exit /b 0

:surum_denetle
%PYTHON% -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
exit /b %errorlevel%

:hata
rem Cift tiklanan pencere hemen kapanmasin: hata okunabilsin.
pause
exit /b 1
