"""Kayıt ve oynatma (PLAN B1.4) ile ayarlardan kaynak kurma."""
import json

import pytest

from yakinlik.ayar import Ayar
from yakinlik.cekirdek.sinyal import SinyalDeposu
from yakinlik.giris.benzetim import Benzetim, BenzetimKaynak
from yakinlik.giris.kayit import KaydedenKaynak, KayitKaynak
from yakinlik.giris.kaynak import Tik
from yakinlik.giris.olustur import kaynak_olustur
from yakinlik.giris.paket import Paket

ORNEK_TIKLER = [
    Tik(0.5, (Paket("7", (("12", -53.25),), 88, 0.5), Paket("12", (), None, 0.5))),
    Tik(1.0, ()),  # alıcı kopuk: paket yok, tik var
    Tik(2.5, (Paket("7", (), 88, 2.5),)),
]


class SabitKaynak:
    """Verilen tikleri sırayla üreten kaynak."""

    def __init__(self, tikler):
        self._tikler = tikler

    async def tikler(self):
        for tik in self._tikler:
            yield tik


async def test_kaydeden_kaynak_tikleri_aynen_iletir_ve_satir_satir_yazar(tmp_path, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"

    iletilen = await ilk_tikler(KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya))

    assert iletilen == ORNEK_TIKLER
    assert [json.loads(satir) for satir in dosya.read_text(encoding="utf-8").splitlines()] == [
        {"t": 0.5, "paketler": [
            {"kart": "7", "duyulanlar": [["12", -53.25]], "pil": 88, "t": 0.5},
            {"kart": "12", "duyulanlar": [], "pil": None, "t": 0.5},
        ]},
        {"t": 1.0, "paketler": []},
        {"t": 2.5, "paketler": [{"kart": "7", "duyulanlar": [], "pil": 88, "t": 2.5}]},
    ]


async def test_kayit_oynatilinca_ayni_tikler_kayittaki_araliklarla_gelir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    await ilk_tikler(KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya))

    oynatilan = await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok))

    assert oynatilan == ORNEK_TIKLER
    assert bekleme_yok.istenen == [0.5, 1.5]  # ilk tik hemen; sonrakiler kayıttaki aralıkla


async def test_oynatma_hizlandirilabilir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    await ilk_tikler(KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya))

    await ilk_tikler(KayitKaynak(dosya, hiz=2, bekle=bekleme_yok))

    assert bekleme_yok.istenen == [0.25, 0.75]


async def test_bozuk_iz_satiri_satir_numarasiyla_reddedilir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('{"t": 0.5, "paketler": []}\nbozuk satır\n', encoding="utf-8")

    with pytest.raises(ValueError, match="satır 2"):
        await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok))


async def test_kayit_ve_oynatma_ayni_sinyal_dizisini_uretir(tmp_path, bekleme_yok, ilk_tikler):
    # Kabul ölçütü (PLAN B1): kayıt → oynatma deterministik. 200 benzetim saniyesi: Kart 14'ün gelişi,
    # alıcı kopması ve kayıp kartın susması kaydın içinde.
    async def sinyal_dizisi(kaynak):
        depo, dizi = SinyalDeposu(), []
        for tik in await ilk_tikler(kaynak, 400):
            depo.ekle(tik.paketler)
            dizi.append((depo.sinyaller(tik.t), depo.gecmis(tik.t), depo.alici_yasi(tik.t)))
            depo.unut(tik.t)
        return dizi

    dosya = tmp_path / "iz.jsonl"
    canli = await sinyal_dizisi(KaydedenKaynak(BenzetimKaynak(Benzetim(kisi=25, tohum=3), bekle=bekleme_yok), dosya))
    oynatilan = await sinyal_dizisi(KayitKaynak(dosya, bekle=bekleme_yok))

    assert oynatilan == canli
    assert sum(len(sinyaller) for sinyaller, _, _ in canli) > 1000  # boş dizileri karşılaştırmıyoruz


# --- ayarlardan kaynak kurma ---

async def test_benzetim_bayraklari_kaynaga_gecer(bekleme_yok, ilk_tikler):
    kaynak = kaynak_olustur(Ayar(kaynak="benzetim", kisi=40, hizlandir=10, kopma=False), bekle=bekleme_yok)

    tikler = await ilk_tikler(kaynak, 30)  # 150 benzetim saniyesi: kopma açık olsaydı 120. sn'de boş tik olurdu

    assert len(kaynak.benzetim.kadro) == 40
    assert tikler[0].t == 5.0
    assert all(tik.paketler for tik in tikler)


async def test_kayit_kaynagi_iz_dosyasini_oynatir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    await ilk_tikler(KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya))

    kaynak = kaynak_olustur(Ayar(kaynak="kayit", iz=dosya), bekle=bekleme_yok)

    assert await ilk_tikler(kaynak) == ORNEK_TIKLER


async def test_kaydet_verilirse_kaynagin_tikleri_dosyaya_yazilir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    kaynak = kaynak_olustur(Ayar(kaynak="benzetim", kisi=5, kaydet=dosya), bekle=bekleme_yok)

    tikler = await ilk_tikler(kaynak, 4)

    assert await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok)) == tikler


def test_kayit_kaynagi_iz_dosyasi_ister():
    with pytest.raises(ValueError, match="--iz"):
        kaynak_olustur(Ayar(kaynak="kayit"))


def test_seri_kaynak_henuz_yok():
    # Seri paket biçimi bilinmiyor; SeriKaynak B8'de yazılacak.
    with pytest.raises(ValueError, match="B8"):
        kaynak_olustur(Ayar(kaynak="seri"))
