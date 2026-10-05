"""Yük ölçümü (PLAN B7): benzetimde N kişi, beklemeden tik tik ilerletilir; her tik gerçek sunucudaki işin tamamıdır
(alan + diske yazım + /state üretimi). Belirli anlarda tik süresi, /state boyutu ve bellek yazdırılır.

    .venv/bin/python araclar/yuk_olc.py --kisi 97 --dakika 180
"""
import argparse
import gc
import json
import resource
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yakinlik.motor as motor_modulu  # noqa: E402
from yakinlik.ayar import Ayar  # noqa: E402
from yakinlik.motor import Motor  # noqa: E402
from yakinlik.saat import SahteSaat  # noqa: E402


def main() -> None:
    ayristirici = argparse.ArgumentParser()
    ayristirici.add_argument("--kisi", type=int, default=97)
    ayristirici.add_argument("--dakika", type=float, default=30)
    ayristirici.add_argument("--rapor-dk", type=float, default=10, help="kaç benzetim dakikasında bir satır")
    ayristirici.add_argument("--abone", type=int, default=5, help="canlı akış izleyicisi (her tik okunur)")
    ayristirici.add_argument("--grafikli", type=int, default=0, help="bunlardan kaçı grafik istiyor (Kurulum açık)")
    secenek = ayristirici.parse_args()

    with tempfile.TemporaryDirectory() as klasor:
        saat = SahteSaat(1_800_000_000.0)
        motor = Motor.ayardan(Ayar(kisi=secenek.kisi, kopma=False, veri=Path(klasor)), saat=saat)
        benzetim = motor._kaynak.benzetim
        aboneler = [motor.abone_ol(grafik=i < secenek.grafikli) for i in range(secenek.abone)]
        sureler: list[float] = []
        parcalar = {"alan": 0.0, "disk": 0.0, "durum": 0.0}

        def olc(ad, islev):
            def sarili(*argumanlar, **secenek):
                bas = time.perf_counter()
                try:
                    return islev(*argumanlar, **secenek)
                finally:
                    parcalar[ad] += (time.perf_counter() - bas) * 1000
            return sarili

        motor._alan.tik = olc("alan", motor._alan.tik)
        motor._depo.yaz = olc("disk", motor._depo.yaz)
        motor_modulu.durum_uret = olc("durum", motor_modulu.durum_uret)
        print("dk   | çift | tik ort / p95 / en çok (ms) | alan / disk / durum ort (ms) | /state KB | RSS en çok MB")
        for i in range(1, int(secenek.dakika * 120) + 1):
            saat.ilerlet(0.5)
            bas = time.perf_counter()
            motor.isle(benzetim.tik(0.5))
            sureler.append((time.perf_counter() - bas) * 1000)
            for abone in aboneler:
                abone.bekleyen()
            if i % int(secenek.rapor_dk * 120) == 0:
                gc.collect()
                sirali = sorted(sureler)
                cift = len(motor._alan.sinyal.sinyaller(motor._alan.t))
                rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (2**20 if sys.platform == "darwin" else 2**10)
                adet = len(sirali)
                print(f"{i / 120:4.0f} | {cift:4d} | {sum(sirali) / adet:6.1f} / {sirali[int(adet * 0.95)]:5.1f}"
                      f" / {sirali[-1]:6.1f} | {parcalar['alan'] / adet:5.1f} / {parcalar['disk'] / adet:4.1f}"
                      f" / {parcalar['durum'] / adet:5.1f} | {len(motor.durum_baytlari(secenek.grafikli > 0)) / 1024:8.0f} | {rss:6.1f}", flush=True)
                sureler.clear()
                parcalar.update(alan=0.0, disk=0.0, durum=0.0)
        durum = json.loads(motor.durum_baytlari(grafik=True))
        boyutlar = {anahtar: len(json.dumps(deger, ensure_ascii=False, separators=(",", ":"))) for anahtar, deger in durum.items()}
        toplam = sum(boyutlar.values())
        print("son /state dağılımı:", ", ".join(f"{anahtar} %{100 * boyut / toplam:.0f}"
                                               for anahtar, boyut in sorted(boyutlar.items(), key=lambda x: -x[1])[:4]))
        motor.kapat()


if __name__ == "__main__":
    main()
