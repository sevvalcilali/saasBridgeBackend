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
    Tik(0.5, (Paket("7", (("12", -53.25),), 0.5), Paket("12", (), 0.5))),
    Tik(1.0, ()),  # alıcı kopuk: paket yok, tik var
    Tik(2.5, (Paket("7", (), 2.5),)),
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
            {"kart": "7", "duyulanlar": [["12", -53.25]], "t": 0.5, "alici_rssi": None},
            {"kart": "12", "duyulanlar": [], "t": 0.5, "alici_rssi": None},
        ]},
        {"t": 1.0, "paketler": []},
        {"t": 2.5, "paketler": [{"kart": "7", "duyulanlar": [], "t": 2.5, "alici_rssi": None}]},
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


async def test_kayit_her_tikte_diske_yazilir(tmp_path):
    # Kayıt çoğu zaman bir çökmeyi yakalamak için açılır: süreç aniden kapansa da gelen tikler dosyada olmalı.
    dosya = tmp_path / "iz.jsonl"
    akis = KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya).tikler()
    try:
        await anext(akis)

        assert len(dosya.read_text(encoding="utf-8").splitlines()) == 1
    finally:
        await akis.aclose()


async def test_kaydeden_kaynak_var_olan_dosyanin_ustune_yazmaz(tmp_path, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text("ÖNEMLİ ALTIN DOSYA\n", encoding="utf-8")

    with pytest.raises(FileExistsError):
        await ilk_tikler(KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya))

    assert dosya.read_text(encoding="utf-8") == "ÖNEMLİ ALTIN DOSYA\n"


async def test_sonlu_olmayan_dbm_kayda_yazilmaz(tmp_path, ilk_tikler):
    tik = Tik(0.5, (Paket("7", (("12", float("nan")),), 0.5),))

    with pytest.raises(ValueError):
        await ilk_tikler(KaydedenKaynak(SabitKaynak([tik]), tmp_path / "iz.jsonl"))


async def test_bos_satirlar_atlanir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('\n{"t": 0.5, "paketler": []}\n\n   \n{"t": 1.0, "paketler": []}\n', encoding="utf-8")

    tikler = await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok))

    assert [tik.t for tik in tikler] == [0.5, 1.0]


async def test_bozuk_iz_satiri_satir_numarasiyla_reddedilir(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('{"t": 0.5, "paketler": []}\nbozuk satır\n', encoding="utf-8")

    with pytest.raises(ValueError, match="satır 2"):
        await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok))


@pytest.mark.parametrize(
    "paket",
    [
        '{"kart": 7, "duyulanlar": [], "pil": null, "t": 0.5}',  # kart numarası metin olmalı
        '{"kart": "7", "duyulanlar": [["12", "cok"]], "pil": null, "t": 0.5}',  # dBm sayı olmalı
        '{"kart": "7", "duyulanlar": [["12", NaN]], "pil": null, "t": 0.5}',  # dBm sonlu olmalı
        '{"kart": "7", "duyulanlar": [["12", true]], "pil": null, "t": 0.5}',
        '{"kart": "7", "duyulanlar": [[12, -50]], "pil": null, "t": 0.5}',
        '{"kart": "7", "duyulanlar": [], "pil": null, "t": "a"}',
    ],
)
async def test_yanlis_turdeki_iz_alani_satir_numarasiyla_reddedilir(tmp_path, bekleme_yok, ilk_tikler, paket):
    # Bozuk iz okunurken yakalanmalı; yoksa hata çekirdekte, anlaşılmaz bir yerde çıkar.
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('{"t": 0.5, "paketler": []}\n{"t": 1.0, "paketler": [' + paket + "]}\n", encoding="utf-8")

    with pytest.raises(ValueError, match="satır 2"):
        await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok))


@pytest.mark.parametrize("t", ['"a"', "true", "NaN"])
async def test_yanlis_turdeki_tik_ani_reddedilir(tmp_path, bekleme_yok, ilk_tikler, t):
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('{"t": ' + t + ', "paketler": []}\n', encoding="utf-8")

    with pytest.raises(ValueError, match="satır 1"):
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


def test_kaydedilen_benzetimin_kadrosuna_ulasilir(tmp_path, bekleme_yok):
    # Sunucu benzetim modunda kayıt defterini kadrodan kurar; kayıt açıkken de kadroya ulaşabilmeli.
    kaynak = kaynak_olustur(Ayar(kaynak="benzetim", kisi=5, kaydet=tmp_path / "iz.jsonl"), bekle=bekleme_yok)

    assert len(kaynak.benzetim.kadro) == 5


async def test_kayit_kaynaginda_benzetim_yoktur(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    await ilk_tikler(KaydedenKaynak(SabitKaynak(ORNEK_TIKLER), dosya))

    assert kaynak_olustur(Ayar(kaynak="kayit", iz=dosya), bekle=bekleme_yok).benzetim is None


def test_kayit_kaynagi_iz_dosyasi_ister():
    with pytest.raises(ValueError, match="--iz"):
        kaynak_olustur(Ayar(kaynak="kayit"))


def test_oynatilacak_iz_dosyasi_yoksa_kaynak_kurulmaz(tmp_path):
    # Hata sunucu açılırken çıkmalı, ilk tikte (sunucu çoktan yayındayken) değil.
    with pytest.raises(ValueError, match="yok.jsonl"):
        kaynak_olustur(Ayar(kaynak="kayit", iz=tmp_path / "yok.jsonl"))


def test_iz_yalniz_kayit_kaynagiyla_verilebilir(tmp_path):
    # --iz verilip --kaynak unutulursa sessizce benzetim çalışmasın.
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('{"t": 0.5, "paketler": []}\n', encoding="utf-8")

    with pytest.raises(ValueError, match="yalnız"):
        kaynak_olustur(Ayar(kaynak="benzetim", iz=dosya))


def test_kaydet_ile_iz_ayni_dosyaysa_kaynak_kurulmaz_ve_iz_bozulmaz(tmp_path):
    dosya = tmp_path / "iz.jsonl"
    dosya.write_text('{"t": 0.5, "paketler": []}\n', encoding="utf-8")

    with pytest.raises(ValueError, match="aynı dosya"):
        kaynak_olustur(Ayar(kaynak="kayit", iz=dosya, kaydet=tmp_path / "." / "iz.jsonl"))

    assert dosya.read_text(encoding="utf-8") == '{"t": 0.5, "paketler": []}\n'


def test_kaydet_var_olan_dosyanin_ustune_yazmaz(tmp_path):
    dosya = tmp_path / "eski.jsonl"
    dosya.write_text("ÖNEMLİ ALTIN DOSYA\n", encoding="utf-8")

    with pytest.raises(ValueError, match="zaten var"):
        kaynak_olustur(Ayar(kaynak="benzetim", kaydet=dosya))

    assert dosya.read_text(encoding="utf-8") == "ÖNEMLİ ALTIN DOSYA\n"


def test_kayit_klasoru_yoksa_kaynak_kurulmaz(tmp_path):
    with pytest.raises(ValueError, match="klasör"):
        kaynak_olustur(Ayar(kaynak="benzetim", kaydet=tmp_path / "yok" / "iz.jsonl"))


def test_seri_kaynak_henuz_yok():
    # Seri paket biçimi bilinmiyor; SeriKaynak B8'de yazılacak.
    with pytest.raises(ValueError, match="B8"):
        kaynak_olustur(Ayar(kaynak="seri"))


async def test_alicinin_duydugu_guc_kayda_yazilir_eski_izde_yoksa_bos(tmp_path, bekleme_yok, ilk_tikler):
    dosya = tmp_path / "iz.jsonl"
    tik = Tik(0.5, (Paket("7", (), 0.5, alici_rssi=-71.5),))
    await ilk_tikler(KaydedenKaynak(SabitKaynak([tik]), dosya))
    eski = tmp_path / "eski.jsonl"
    eski.write_text('{"t": 0.5, "paketler": [{"kart": "7", "duyulanlar": [], "pil": 88, "t": 0.5}]}\n', encoding="utf-8")

    assert await ilk_tikler(KayitKaynak(dosya, bekle=bekleme_yok)) == [tik]
    assert (await ilk_tikler(KayitKaynak(eski, bekle=bekleme_yok)))[0].paketler[0].alici_rssi is None


async def test_eski_izdeki_pil_alani_yok_sayilir(tmp_path, bekleme_yok, ilk_tikler):
    # Pil artık tutulmuyor (Şevval kararı 07.10.2026); eski izlerdeki pil (türü ne olursa olsun) okumayı bozmaz.
    eski = tmp_path / "eski.jsonl"
    eski.write_text('{"t": 0.5, "paketler": [{"kart": "7", "duyulanlar": [], "pil": "yüz", "t": 0.5}]}\n', encoding="utf-8")

    (tik,) = await ilk_tikler(KayitKaynak(eski, bekle=bekleme_yok))

    assert tik.paketler == (Paket("7", (), 0.5),)
