"""`python -m yakinlik` (PLAN B0.5, B2.5): sunucu açılır, canlı akış yayınlar, Ctrl+C ile temiz kapanır."""
import json
import os
import signal
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
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
    (tmp_path / "iz.jsonl").write_text('{"t": 0.5, "paketler": []}\n', encoding="utf-8")
    surec = subprocess.Popen(
        [sys.executable, "-m", "yakinlik", "--port", str(port), "--kaynak", "kayit", "--iz", "iz.jsonl"],
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
    # Denetim bir gün bozulursa sunucu açılır; o durumda bile yalnız bu makineyi ve boş bir portu dinlesin.
    (tmp_path / "config.toml").write_text('host = "127.0.0.1"\nprot = 9000\n', encoding="utf-8")

    sonuc = subprocess.run(
        [sys.executable, "-m", "yakinlik", "--port", str(bos_port())],
        cwd=tmp_path, env=ORTAM, capture_output=True, text=True, timeout=20,
    )

    assert sonuc.returncode != 0
    assert "prot" in sonuc.stderr
    assert "Traceback" not in sonuc.stderr


# --- canlı akış (PLAN B2.5): gerçek sunucu süreciyle, yalnız bu makineyi dinleyerek ---

@contextmanager
def sunucu(tmp_path, *argumanlar):
    port = bos_port()
    (tmp_path / "config.toml").write_text('host = "127.0.0.1"\n', encoding="utf-8")
    surec = subprocess.Popen(
        [sys.executable, "-m", "yakinlik", "--port", str(port), *argumanlar],
        cwd=tmp_path, env=ORTAM, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        acilana_kadar_iste(f"http://127.0.0.1:{port}/api/health", surec)
        yield port, surec
    finally:
        if surec.poll() is None:
            surec.kill()
            surec.communicate()


def sse_oku(port, en_cok_mesaj, en_cok_sn):
    """/events'i okur: (başlıklar, [(bağlantıdan bu yana sn, durum)])."""
    mesajlar, tampon, bas = [], "", time.monotonic()
    with httpx.Client(timeout=5, trust_env=False) as istemci:
        with istemci.stream("GET", f"http://127.0.0.1:{port}/events") as yanit:
            basliklar = yanit.headers
            for parca in yanit.iter_text():
                tampon += parca.replace("\r\n", "\n")
                while "\n\n" in tampon:
                    blok, tampon = tampon.split("\n\n", 1)
                    veri = "".join(satir[5:].strip() for satir in blok.split("\n") if satir.startswith("data:"))
                    if veri:
                        mesajlar.append((time.monotonic() - bas, json.loads(veri)))
                if len(mesajlar) >= en_cok_mesaj or time.monotonic() - bas > en_cok_sn:
                    break
    return basliklar, mesajlar


def test_canli_akis_hemen_baslar_saniyede_iki_kez_gelir(tmp_path):
    with sunucu(tmp_path) as (port, _):
        basliklar, mesajlar = sse_oku(port, en_cok_mesaj=6, en_cok_sn=5)

    assert basliklar["content-type"].startswith("text/event-stream")
    assert (basliklar["cache-control"], basliklar["x-accel-buffering"]) == ("no-cache", "no")
    ilk = mesajlar[0][0]
    assert ilk < 0.7  # bağlanır bağlanmaz ilk durum
    assert sum(1 for sn, _ in mesajlar if ilk < sn <= ilk + 1.5) >= 2  # 2 Hz
    gecen = [durum["elapsed"] for _, durum in mesajlar]
    assert gecen == sorted(gecen) and gecen[-1] > gecen[1]
    assert len(mesajlar[-1][1]["people"]) == 25  # benzetim kadrosu


def test_alici_kopunca_yayin_surer_alici_yasi_buyur_sonra_duser(tmp_path):
    # 60 kat hız: benzetimde alıcı 120. benzetim saniyesinde (~2 sn sonra) kopar, 2 sn sonra geri gelir.
    with sunucu(tmp_path, "--hizlandir", "60") as (port, _):
        _, mesajlar = sse_oku(port, en_cok_mesaj=100, en_cok_sn=8)

    yaslar = [durum["receiverAge"] for _, durum in mesajlar]
    kopma = next(i for i, yas in enumerate(yaslar) if yas is not None and yas > 5)
    assert any(yas is not None and yas < 5 for yas in yaslar[kopma:])  # toparlandı
    araliklar = [b - a for (a, _), (b, _) in zip(mesajlar, mesajlar[1:])]
    assert max(araliklar) < 1.5  # kopukken de yayın kesilmez (arayüz 6 sn sessizlikte "bağlanılamıyor" der)


@pytest.mark.skipif(sys.platform == "win32", reason="alt sürece SIGINT yalnız POSIX'te gönderilebilir")
def test_acik_canli_akis_varken_ctrl_c_hemen_kapanir(tmp_path):
    with sunucu(tmp_path) as (port, surec):
        with httpx.Client(timeout=5, trust_env=False) as istemci:
            with istemci.stream("GET", f"http://127.0.0.1:{port}/events") as yanit:
                next(yanit.iter_bytes())  # akış açık
                bas = time.monotonic()
                surec.send_signal(signal.SIGINT)
                cikti, _ = surec.communicate(timeout=15)
                sure = time.monotonic() - bas

    assert surec.returncode == 0, cikti
    assert sure < 5, f"kapanış {sure:.1f} sn sürdü"
    assert "Traceback" not in cikti


def test_hatali_kaynak_ayari_sunucu_acilmadan_anlasilir_hatayla_durur(tmp_path):
    (tmp_path / "config.toml").write_text('host = "127.0.0.1"\n', encoding="utf-8")

    sonuc = subprocess.run(
        [sys.executable, "-m", "yakinlik", "--port", str(bos_port()), "--kaynak", "kayit"],  # --iz yok
        cwd=tmp_path, env=ORTAM, capture_output=True, text=True, timeout=20,
    )

    assert sonuc.returncode != 0
    assert "ayar hatası" in sonuc.stderr and "--iz" in sonuc.stderr
    assert "Traceback" not in sonuc.stderr


@pytest.mark.skipif(sys.platform == "win32", reason="SIGKILL yalnız POSIX'te")
def test_kill_9_ile_olen_sunucu_acilinca_kisiler_kayitlar_kenarlar_ve_esik_korunur(tmp_path):
    # B6 kabulü: süreç kill -9 ile ölür (kapanış kodu çalışmaz), yeniden açılır; diske yazılmış olan aynı kalır.
    def iste(adres, yol):
        return httpx.get(f"{adres}{yol}", timeout=5, trust_env=False).json()

    with sunucu(tmp_path, "--veri", "veri", "--hizlandir", "60", "--kopma", "0") as (port, surec):
        adres = f"http://127.0.0.1:{port}"
        httpx.post(f"{adres}/control", content=b'{"cmd":"threshold","value":-75}', trust_env=False)
        httpx.post(f"{adres}/api/people", json={"ad": "Deniz", "rol": "investor"}, trust_env=False)
        son = time.monotonic() + 20
        while len(iste(adres, "/state")["edges"]) < 3 and time.monotonic() < son:
            time.sleep(0.2)
        once = {yol: iste(adres, yol) for yol in ("/api/people", "/api/sessions", "/state")}
        surec.send_signal(signal.SIGKILL)
        surec.wait(timeout=5)

    with sunucu(tmp_path, "--veri", "veri", "--hizlandir", "60", "--kopma", "0") as (port, _):
        sonra = {yol: iste(f"http://127.0.0.1:{port}", yol) for yol in ("/api/people", "/api/sessions", "/state")}

    assert sonra["/api/people"] == once["/api/people"] and len(once["/api/people"]) == 26
    assert sonra["/state"]["threshold"] == -75
    kayitlar = {(o["a"], o["b"], o["start"]): o["end"] for o in sonra["/api/sessions"]}
    for o in once["/api/sessions"]:  # ölmeden önce okunan her kayıt duruyor; o an sürenler kapanmış
        assert (o["a"], o["b"], o["start"]) in kayitlar
        assert o["end"] is None or kayitlar[(o["a"], o["b"], o["start"])] == o["end"]
    kenarlar = {(k["a"], k["b"]): k["min"] for k in sonra["/state"]["edges"]}
    assert len(once["/state"]["edges"]) >= 3
    for k in once["/state"]["edges"]:  # ölene dek süre ancak artmış olabilir
        assert kenarlar[(k["a"], k["b"])] >= k["min"]
    assert sonra["/state"]["elapsed"] >= once["/state"]["elapsed"]
    assert list((tmp_path / "veri" / "yedek").glob("yakinlik-acilis-*.sqlite"))  # açılışta yedek alındı
