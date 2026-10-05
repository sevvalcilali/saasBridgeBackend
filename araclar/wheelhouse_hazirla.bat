@echo off
rem Etkinlikte internet yok: kurulum paketlerini onceden wheelhouse\ klasorune indirir. baslat.bat wheelhouse\ varsa
rem paketleri internetsiz oradan kurar. Etkinlik bilgisayarinda (ya da ayni Windows ve Python surumunde), internet
rem varken calistirin. (Bu dosyada Turkce harf yok: cmd kod sayfasinda bozuk gorunmesin.)
rem NOT: Windows'ta henuz denenmedi.
setlocal
cd /d "%~dp0\.."
set PYTHON=py -3
%PYTHON% -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
if errorlevel 1 set PYTHON=python
%PYTHON% -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
if errorlevel 1 (
  echo Python 3.11 ya da ustu bulunamadi.
  pause
  exit /b 1
)
if exist wheelhouse rmdir /s /q wheelhouse
%PYTHON% -m pip download --only-binary=:all: -r requirements.txt -d wheelhouse
if errorlevel 1 (
  echo Paketler indirilemedi. Internet baglantisini kontrol edin.
  pause
  exit /b 1
)
echo Hazir: wheelhouse\  Projeyle birlikte etkinlik bilgisayarina kopyalayin; baslat.bat internetsiz kurar.
