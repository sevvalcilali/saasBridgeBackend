"""baslat.sh (PLAN B0.7): sanal ortam hazır değilse kurar, hazırsa dokunmaz, kurulum bozulursa temizler.

Gerçek kurulum ağ ister. Burada PATH'e sahte bir `python3.11` konur: `-m venv` sahte bir sanal ortam
yaratır; o ortamın python'u da `-c` (paket denetimi), `-m pip` ve `-m yakinlik` çağrılarını taklit eder.
"""
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="baslat.sh POSIX kabuğu ister")

DEPO = Path(__file__).parent.parent

SAHTE_PYTHON = """#!/bin/sh
# Sahte python3.11: sürüm denetimi (-c) başarılı; `-m venv KLASOR` sahte bir sanal ortam kurar.
if [ "$1" = "-c" ]; then exit 0; fi
if [ "$1 $2" = "-m venv" ]; then
  mkdir -p "$3/bin"
  cp "$(dirname "$0")/sahte-venv-python" "$3/bin/python"
  exit 0
fi
exit 1
"""

SAHTE_VENV_PYTHON = """#!/bin/sh
# Sahte sanal ortam python'u. Paketler "kurulu" ise (işaret dosyası) içe aktarma ve sunucu çalışır.
ortam="$(dirname "$0")/.."
case "$1 $2" in
  "-c "*) [ -f "$ortam/paketler-kurulu" ] ;;
  "-m pip") [ -z "$SAHTE_PIP_HATASI" ] && touch "$ortam/paketler-kurulu" ;;
  *) [ -f "$ortam/paketler-kurulu" ] || { echo "ModuleNotFoundError" >&2; exit 1; }
     echo "SUNUCU $*" ;;
esac
"""


def calistirilabilir_yaz(yol, icerik):
    yol.parent.mkdir(parents=True, exist_ok=True)
    yol.write_text(icerik, encoding="utf-8")
    yol.chmod(0o755)


@pytest.fixture
def proje(tmp_path):
    kok = tmp_path / "proje klasoru"  # yolunda boşluk var: betik tırnaklamayı doğru yapmalı
    kok.mkdir()
    for ad in ("baslat.sh", "requirements.txt"):
        shutil.copy(DEPO / ad, kok / ad)
    return kok


@pytest.fixture
def calistir(tmp_path, proje):
    sahte = tmp_path / "sahte"
    calistirilabilir_yaz(sahte / "python3.11", SAHTE_PYTHON)
    calistirilabilir_yaz(sahte / "sahte-venv-python", SAHTE_VENV_PYTHON)

    def _calistir(*argumanlar, **ortam):
        return subprocess.run(
            [str(proje / "baslat.sh"), *argumanlar],
            cwd=tmp_path, env={"PATH": f"{sahte}:/usr/bin:/bin", **ortam},
            capture_output=True, text=True, timeout=30,
        )

    return _calistir


def test_sanal_ortam_yokken_kurulur_ve_argumanlar_sunucuya_gecer(calistir):
    sonuc = calistir("--port", "8010")

    assert sonuc.returncode == 0, sonuc.stderr
    assert sonuc.stdout.strip() == "SUNUCU -m yakinlik.bekci --port 8010"  # çökerse yeniden başlatan bekçi


@pytest.mark.parametrize("python_var", [False, True], ids=["bos-klasor", "paketler-eksik"])
def test_yarim_kalmis_sanal_ortam_yeniden_kurulur(proje, calistir, python_var):
    # Kurulum yarıda kesilirse ya da klasör başka işletim sisteminden kopyalanırsa .venv vardır ama
    # çalışmaz. "Klasör var" diye kurulum atlanırsa sunucu anlaşılmaz bir hatayla açılmaz.
    (proje / ".venv").mkdir()
    (proje / ".venv" / "eski").write_text("")
    if python_var:
        calistirilabilir_yaz(proje / ".venv" / "bin" / "python", SAHTE_VENV_PYTHON)

    sonuc = calistir()

    assert sonuc.returncode == 0, sonuc.stderr
    assert sonuc.stdout.strip() == "SUNUCU -m yakinlik.bekci"
    assert not (proje / ".venv" / "eski").exists()


def test_hazir_sanal_ortama_dokunulmaz(proje, calistir):
    # Elle kurulmuş (geliştirme paketleri de olan) sanal ortam silinip yeniden kurulmamalı.
    calistirilabilir_yaz(proje / ".venv" / "bin" / "python", SAHTE_VENV_PYTHON)
    (proje / ".venv" / "paketler-kurulu").write_text("")
    (proje / ".venv" / "dokunma").write_text("")

    sonuc = calistir()

    assert sonuc.returncode == 0, sonuc.stderr
    assert (proje / ".venv" / "dokunma").exists()


def test_kurulum_basarisiz_olursa_yarim_sanal_ortam_kalmaz(proje, calistir):
    sonuc = calistir(SAHTE_PIP_HATASI="1")

    assert sonuc.returncode != 0
    assert not (proje / ".venv").exists()
