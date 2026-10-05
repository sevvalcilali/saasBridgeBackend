"""Motor (PLAN B2.4): kaynaktan tik → alan → durum bir kez üretilir → bütün izleyicilere aynı baytlar."""
import asyncio
import json

import pytest
from destek.salon import KADRO, YAKIN, tik_uret

from yakinlik.ayar import Ayar
from yakinlik.cekirdek.alan import Alan
from yakinlik.cekirdek.durum import Etkinlik
from yakinlik.cekirdek.kisi import KisiDefteri
from yakinlik.motor import EN_COK_BEKLEYEN, Motor
from yakinlik.saat import SahteSaat

ETKINLIK = Etkinlik("Deneme", "alt", "tarih")


class SabitKaynak:
    benzetim = None

    def __init__(self, tikler, sonda_hata=None):
        self._tikler, self._sonda_hata = tikler, sonda_hata

    async def tikler(self):
        for tik in self._tikler:
            yield tik
        if self._sonda_hata:
            raise self._sonda_hata


class Dur(Exception):
    """Testte sonsuz döngüyü kesmek için."""


def durduran_bekleme(adet):
    """`adet` beklemeden sonra Dur fırlatan bekleme; istenen süreleri kaydeder."""

    async def bekle(saniye):
        bekle.istenen.append(saniye)
        await asyncio.sleep(0)
        if len(bekle.istenen) >= adet:
            raise Dur

    bekle.istenen = []
    return bekle


def motor_kur(tikler=(), **secenek):
    alan = Alan(KisiDefteri.kadrodan(KADRO), baslangic=0.0)
    return Motor(SabitKaynak(list(tikler), secenek.pop("sonda_hata", None)), alan, ETKINLIK, saat=SahteSaat(1e9), **secenek)


def durum(motor):
    return json.loads(motor.anlik)


def test_her_tik_durumu_yeniler():
    motor = motor_kur()

    motor.isle(tik_uret(0.5))
    motor.isle(tik_uret(1.0, {("2", "3"): YAKIN}))

    assert durum(motor)["elapsed"] == 1.0
    assert durum(motor)["signals"][0]["a"] == "2"


def test_ilk_tikten_once_de_durum_vardir():
    assert durum(motor_kur())["elapsed"] == 0.0


def test_butun_izleyicilere_ayni_baytlar_gider():
    motor = motor_kur()
    birinci, ikinci = motor.abone_ol(), motor.abone_ol()

    motor.isle(tik_uret(0.5))

    a, b = birinci.bekleyen(), ikinci.bekleyen()
    assert a == [motor.anlik] and b == [motor.anlik]
    assert a[0] is b[0]  # JSON bir kez üretilir


def test_yetisemeyen_izleyici_kapatilir_digerleri_surer():
    motor = motor_kur()
    yavas, hizli = motor.abone_ol(), motor.abone_ol()

    for i in range(EN_COK_BEKLEYEN + 1):
        motor.isle(tik_uret(0.5 * (i + 1)))
        hizli.bekleyen()  # hızlı izleyici her mesajı alıyor

    assert yavas.kapandi and not hizli.kapandi
    motor.isle(tik_uret(10.0))
    assert hizli.bekleyen() == [motor.anlik]


def test_ayrilan_izleyiciye_bir_sey_gitmez():
    motor = motor_kur()
    abone = motor.abone_ol()
    motor.ayril(abone)

    motor.isle(tik_uret(0.5))

    assert abone.bekleyen() == []


def test_esik_ve_sifirlama_durumda_hemen_gorunur():
    motor = motor_kur()
    for i in range(130):
        motor.isle(tik_uret(0.5 * (i + 1), {("2", "3"): YAKIN}))
    assert durum(motor)["edges"]

    motor.esik_ayarla(-70)
    motor.sifirla()

    assert durum(motor)["threshold"] == -70
    assert (durum(motor)["edges"], durum(motor)["elapsed"]) == ([], 0.0)


async def test_kaynak_bitince_yayin_surer_zaman_ilerler():
    # Kayıt kaynağı iz bitince durur; arayüz 6 sn sessizlikte "bağlanılamıyor" der → yayın sürmeli (İ6).
    bekle = durduran_bekleme(3)
    motor = motor_kur([tik_uret(0.5), tik_uret(1.0)], bekle=bekle)
    abone = motor.abone_ol()

    with pytest.raises(Dur):
        await motor.calis()

    assert bekle.istenen == [0.5, 0.5, 0.5]
    assert [json.loads(veri)["elapsed"] for veri in abone.bekleyen()] == [0.5, 1.0, 1.5, 2.0]
    assert durum(motor)["receiverAge"] == 1.0  # veri yok: alıcı yaşı büyür


async def test_kaynak_hata_verse_de_yayin_surer():
    bekle = durduran_bekleme(2)
    motor = motor_kur([tik_uret(0.5)], sonda_hata=ValueError("iz satırı bozuk"), bekle=bekle)

    with pytest.raises(Dur):
        await motor.calis()

    assert durum(motor)["elapsed"] == 1.0  # hata sonrası iki boş tikten biri işlendi


def test_ayarlardan_benzetimle_kurulur_kisiler_kadrodan():
    motor = Motor.ayardan(Ayar(kisi=7, esik=-68, anlasma_sn=30))

    d = durum(motor)
    assert len(d["people"]) == 7
    assert d["threshold"] == -68
    assert d["rules"] == {"dealAfterS": 30}
    assert d["event"]["name"] == Ayar().etkinlik_adi


# --- inceleme (B2): hata yalıtımı ---

async def test_durum_uretilemeyen_tik_kaynagi_birakmaz_son_durum_yeniden_gider(monkeypatch):
    import yakinlik.motor as motor_modulu

    bekle = durduran_bekleme(1)
    motor = motor_kur([tik_uret(0.5), tik_uret(1.0), tik_uret(1.5)], bekle=bekle)
    asil, cagri = motor_modulu.durum_uret, []

    def bir_kez_bozuk(*argumanlar):
        cagri.append(1)
        if len(cagri) == 1:
            raise KeyError("beklenmeyen")
        return asil(*argumanlar)

    monkeypatch.setattr(motor_modulu, "durum_uret", bir_kez_bozuk)
    abone = motor.abone_ol()

    with pytest.raises(Dur):
        await motor.calis()

    mesajlar = [json.loads(veri) for veri in abone.bekleyen()]
    assert [m["elapsed"] for m in mesajlar] == [0.0, 1.0, 1.5]  # bozuk tikte önceki durum yeniden gitti
    assert mesajlar[-1]["receiverAge"] == 0.0  # kaynak bırakılmadı, veri gelmeye devam etti


async def test_durum_hic_uretilemese_de_motor_durmaz(monkeypatch):
    import yakinlik.motor as motor_modulu

    bekle = durduran_bekleme(3)
    motor = motor_kur([tik_uret(0.5)], bekle=bekle)

    def hep_bozuk(*_):
        raise KeyError("beklenmeyen")

    monkeypatch.setattr(motor_modulu, "durum_uret", hep_bozuk)

    with pytest.raises(Dur):  # döngü bekleme fonksiyonuna kadar sürdü; KeyError ile ölmedi
        await motor.calis()

    assert bekle.istenen == [0.5, 0.5, 0.5]
