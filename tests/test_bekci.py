"""Bekçi (PLAN R5): sunucu çökerse yeniden başlatılır; Ctrl+C, ayar hatası ve hemen tekrarlayan çöküşte durur;
--yeni-etkinlik yalnız ilk açılışta uygulanır (yoksa her çöküşte veri yedeğe taşınırdı)."""
import os
import queue
import re
import signal
import socket
import subprocess
import sys
import threading
import time

import httpx
import pytest
from test_main import ORTAM, bos_port

from yakinlik import bekci as bekci_modulu

pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="süreç grubuna sinyal yalnız POSIX'te")


class Bekci:
    def __init__(self, cwd, *argumanlar):
        (cwd / "config.toml").write_text('host = "127.0.0.1"\n', encoding="utf-8")
        self.port = bos_port()
        self.surec = subprocess.Popen(
            [sys.executable, "-m", "yakinlik.bekci", "--port", str(self.port), *argumanlar],
            cwd=cwd, env=ORTAM, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True,
        )
        self.satirlar: queue.Queue[str] = queue.Queue()
        self.cikti: list[str] = []
        threading.Thread(target=self._oku, daemon=True).start()

    def _oku(self):
        for satir in self.surec.stdout:
            self.cikti.append(satir)
            self.satirlar.put(satir)

    def sunucu_pid(self, sure_sn=15.0):
        """Bekçinin sıradaki "sunucu başlatıldı (pid N)" satırını bekler; sunucu yanıt verene dek bekler."""
        son = time.monotonic() + sure_sn
        while time.monotonic() < son:
            try:
                satir = self.satirlar.get(timeout=0.2)
            except queue.Empty:
                continue
            if eslesme := re.search(r"sunucu başlatıldı \(pid (\d+)\)", satir):
                pid = int(eslesme.group(1))
                while time.monotonic() < son:
                    try:
                        httpx.get(f"http://127.0.0.1:{self.port}/api/health", timeout=1, trust_env=False)
                        return pid
                    except httpx.TransportError:
                        time.sleep(0.1)
        raise AssertionError("sunucu başlamadı:\n" + "".join(self.cikti))

    def iste(self, yontem, yol, **secenek):
        return httpx.request(yontem, f"http://127.0.0.1:{self.port}{yol}", timeout=5, trust_env=False, **secenek)

    def ctrl_c(self):
        os.killpg(self.surec.pid, signal.SIGINT)  # terminaldeki gibi: bekçi ve sunucu birlikte alır
        return self.surec.wait(timeout=15)

    def kapat(self):
        # Bekçi çıkmış olsa da süreç grubunda kalan sunucu (bozuk bekçinin bıraktığı) temizlensin.
        try:
            os.killpg(self.surec.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        self.surec.wait()


@pytest.fixture
def bekci_ac(tmp_path):
    acilan = []

    def ac(*argumanlar):
        acilan.append(Bekci(tmp_path, *argumanlar))
        return acilan[-1]

    yield ac
    for bekci in acilan:
        bekci.kapat()


def test_coken_sunucu_yeniden_baslar_yeni_etkinlik_tekrarlanmaz_ctrl_c_ile_durur(bekci_ac, tmp_path):
    bekci = bekci_ac("--veri", "veri", "--yeni-etkinlik")
    ilk = bekci.sunucu_pid()
    bekci.iste("POST", "/api/people", json={"ad": "Kalmalı"})

    os.kill(ilk, signal.SIGKILL)  # çöküş
    ikinci = bekci.sunucu_pid()
    kisiler = [k["ad"] for k in bekci.iste("GET", "/api/people").json()]
    kod = bekci.ctrl_c()

    assert ikinci != ilk
    assert "Kalmalı" in kisiler  # ikinci açılış veriyi yeni etkinlik diye yedeğe taşımadı
    assert not list((tmp_path / "veri" / "yedek").glob("yakinlik-yeni-etkinlik-*"))
    assert kod == 0, "".join(bekci.cikti)
    assert "Traceback" not in "".join(bekci.cikti)


def test_bekci_kapatilinca_sunucuyu_da_kapatir(bekci_ac):
    # Yoksa sahipsiz kalan sunucu portu ve veri dosyasını tutar, yeni açılış "başka bir sunucu" der.
    bekci = bekci_ac("--veri", "veri")
    sunucu = bekci.sunucu_pid()

    bekci.surec.send_signal(signal.SIGTERM)
    kod = bekci.surec.wait(timeout=15)
    time.sleep(0.5)

    assert kod == 0
    with pytest.raises(ProcessLookupError):
        os.kill(sunucu, 0)


def test_ayar_hatasinda_yeniden_baslatmaz(bekci_ac):
    bekci = bekci_ac("--kaynak", "kayit")  # --iz yok

    kod = bekci.surec.wait(timeout=20)

    assert kod != 0
    assert "ayar hatası" in "".join(bekci.cikti)
    assert "".join(bekci.cikti).count("sunucu başlatıldı") == 1


def test_port_doluysa_bir_kez_dener_durur(bekci_ac):
    with socket_tutulu() as port:
        bekci = bekci_ac("--port", str(port))
        kod = bekci.surec.wait(timeout=30)

    cikti = "".join(bekci.cikti)
    assert kod == 3 and cikti.count("sunucu başlatıldı") == 1
    assert "address already in use" in cikti and "yeniden başlatılmıyor" in cikti


def test_acilir_acilmaz_ust_uste_coken_sunucuda_vazgecer(monkeypatch, capsys):
    monkeypatch.setattr(bekci_modulu, "YENIDEN_BASLATMA_SN", 0)
    coken = (sys.executable, "-c", "raise SystemExit(1)")

    kod = bekci_modulu.main(["--yeni-etkinlik"], sunucu=coken)

    cikti = capsys.readouterr().out
    assert kod == 1
    assert cikti.count("sunucu başlatıldı") == bekci_modulu.ARDISIK_HIZLI_COKUS
    assert "vazgeçildi" in cikti


def test_uzun_sure_calisip_coken_sunucu_hep_yeniden_baslatilir(monkeypatch, capsys, tmp_path):
    # Saatler süren çalışmadan sonraki çöküş "üst üste" sayılmaz: kaç kez olursa olsun yeniden başlatılır.
    monkeypatch.setattr(bekci_modulu, "YENIDEN_BASLATMA_SN", 0)
    monkeypatch.setattr(bekci_modulu, "HIZLI_COKUS_SN", 0)  # her çalışma "uzun" sayılsın
    sayac = tmp_path / "sayac"
    betik = (f"import pathlib, sys; p = pathlib.Path({str(sayac)!r}); n = int(p.read_text()) if p.exists() else 0; "
             "p.write_text(str(n + 1)); sys.exit(1 if n < 4 else 0)")  # 4 kez çöker, sonra temiz kapanır

    kod = bekci_modulu.main([], sunucu=(sys.executable, "-c", betik))

    assert kod == 0
    assert capsys.readouterr().out.count("sunucu başlatıldı") == 5


class socket_tutulu:
    """127.0.0.1'de bir portu dinleyerek tutar."""

    def __enter__(self):
        self.soket = socket.socket()
        self.soket.bind(("127.0.0.1", 0))
        self.soket.listen()
        return self.soket.getsockname()[1]

    def __exit__(self, *_):
        self.soket.close()
