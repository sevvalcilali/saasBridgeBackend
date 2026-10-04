"""`python -m yakinlik` (PLAN B0.5): sunucu açılır, Ctrl+C ile temiz kapanır."""
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

DEPO = Path(__file__).parent.parent
ORTAM = {**os.environ, "PYTHONPATH": str(DEPO)}


def bos_port():
    with socket.socket() as soket:
        soket.bind(("127.0.0.1", 0))
        return soket.getsockname()[1]


def acilana_kadar_iste(adres, surec, sure_sn=10.0):
    son = time.monotonic() + sure_sn
    while time.monotonic() < son:
        if surec.poll() is not None:
            raise AssertionError(f"sunucu açılmadan kapandı (kod {surec.returncode}):\n{surec.stdout.read()}")
        try:
            return httpx.get(adres, timeout=1.0, trust_env=False)
        except httpx.TransportError:
            time.sleep(0.05)
    raise AssertionError("sunucu süresinde açılmadı")


@pytest.mark.skipif(sys.platform == "win32", reason="alt sürece SIGINT yalnız POSIX'te gönderilebilir")
def test_sunucu_acilir_ve_ctrl_c_ile_temiz_kapanir(tmp_path):
    port = bos_port()
    # host config.toml'dan (çalışma klasörü), port ve kaynak komut satırından gelir.
    (tmp_path / "config.toml").write_text('host = "127.0.0.1"\n', encoding="utf-8")
    surec = subprocess.Popen(
        [sys.executable, "-m", "yakinlik", "--port", str(port), "--kaynak", "kayit"],
        cwd=tmp_path, env=ORTAM, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        yanit = acilana_kadar_iste(f"http://127.0.0.1:{port}/api/health", surec)
        surec.send_signal(signal.SIGINT)
        cikti, _ = surec.communicate(timeout=10)
    finally:
        if surec.poll() is None:
            surec.kill()
            surec.communicate()

    assert yanit.json()["kaynak"] == "kayit"
    assert surec.returncode == 0, cikti
    assert "Traceback" not in cikti


def test_bozuk_config_toml_anlasilir_hatayla_kapanir(tmp_path):
    (tmp_path / "config.toml").write_text("prot = 9000\n", encoding="utf-8")

    sonuc = subprocess.run(
        [sys.executable, "-m", "yakinlik"], cwd=tmp_path, env=ORTAM, capture_output=True, text=True, timeout=20,
    )

    assert sonuc.returncode != 0
    assert "prot" in sonuc.stderr
    assert "Traceback" not in sonuc.stderr
