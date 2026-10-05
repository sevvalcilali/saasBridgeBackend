"""HTTP iskeleti (PLAN B0.4): statik arayüz, /api/health, bilinmeyen uç ve hata yanıtları."""
import asyncio
import mimetypes

import pytest

import yakinlik
from yakinlik.ayar import Ayar
from yakinlik.http.uygulama import uygulama_olustur
from yakinlik.motor import Motor
from yakinlik.saat import SahteSaat


def tur(yanit):
    return yanit.headers["content-type"].split(";")[0]


async def test_saglik_ucu_surumu_ve_kaynagi_bildirir(istemci_ac, dist, tmp_path):
    iz = tmp_path / "iz.jsonl"
    iz.write_text('{"t": 0.5, "paketler": []}\n', encoding="utf-8")
    async with istemci_ac(uygulama_olustur(Ayar(dist=dist, kaynak="kayit", iz=iz))) as istemci:
        yanit = await istemci.get("/api/health")

    assert yanit.status_code == 200
    assert yanit.json() == {
        "ok": True, "surum": yakinlik.__surum__, "kaynak": "kayit", "receiverAge": None, "istemci": 0, "veri": None,
    }


async def test_saglik_ucu_kalici_veriyi_ve_yazimin_durdugunu_bildirir(istemci_ac, dist, tmp_path):
    # Operatör için: arayüz diske yazılamadığını göstermez (sözleşmede alan yok), /api/health gösterir.
    motor = Motor.ayardan(Ayar(kisi=4, veri=tmp_path), saat=SahteSaat(1e9))
    async with istemci_ac(uygulama_olustur(Ayar(dist=dist), motor=motor)) as istemci:
        once = (await istemci.get("/api/health")).json()["veri"]
        motor._depo._db.execute("CREATE TEMP TRIGGER bozuk BEFORE INSERT ON ayar BEGIN SELECT RAISE(ABORT, 'x'); END")
        motor.esik_ayarla(-80)
        sonra = (await istemci.get("/api/health")).json()["veri"]

    assert once == {"dosya": str(tmp_path / "yakinlik.sqlite"), "yaziliyor": True}
    assert sonra["yaziliyor"] is False


@pytest.mark.parametrize("parcali", [False, True], ids=["content-length", "parca-parca"])
async def test_1_mb_ustu_govde_413_ve_sozlesme_govdesi(istemci, parcali):
    govde = b"a;b;Misafir;;\n" * (1024 * 1024 // 14 + 1)  # 1 MB'ı biraz aşar

    async def parcalar():
        for i in range(0, len(govde), 65536):
            yield govde[i:i + 65536]

    once = len((await istemci.get("/api/people")).json())
    yanit = await istemci.post("/api/people/import", content=parcalar() if parcali else govde)
    sonra = len((await istemci.get("/api/people")).json())

    assert yanit.status_code == 413
    assert yanit.json() == {"ok": False, "hata": "istek gövdesi çok büyük (en çok 1 MB)"}
    assert sonra == once  # hiçbiri işlenmedi


async def test_1_mb_icindeki_govde_islenir(istemci):
    govde = "Ad;Soyad;Rol;Kurum\n" + "Ali;Kaya;Misafir;" + "x" * (1024 * 1024 - 40) + "\n"

    yanit = await istemci.post("/api/people/import", content=govde.encode())

    assert len(govde.encode()) <= 1024 * 1024
    assert yanit.status_code == 200 and yanit.json()["eklenen"] == 1


async def test_yazma_istekleri_gunluge_yazilir_okumalar_yazilmaz(istemci, caplog):
    caplog.set_level("INFO", logger="yakinlik.http")
    await istemci.post("/api/people", json={"ad": "Deniz"})
    await istemci.get("/api/people")
    await istemci.post("/control", content=b'{"cmd":"threshold","value":-70}')

    satirlar = [kayit.getMessage() for kayit in caplog.records if kayit.name.startswith("yakinlik.http")]
    assert [satir.split(" (")[0] for satir in satirlar] == ["POST /api/people → 200", "POST /control → 200"]


async def test_motor_durdurulurken_hata_olsa_da_veri_dosyasi_kapatilir(dist, tmp_path):
    motor = Motor.ayardan(Ayar(kisi=4, veri=tmp_path), saat=SahteSaat(1e9))

    async def patlayan_calis():
        raise RuntimeError("beklenmeyen")

    motor.calis = patlayan_calis
    uygulama = uygulama_olustur(Ayar(dist=dist), motor=motor)
    with pytest.raises(RuntimeError):
        async with uygulama.router.lifespan_context(uygulama):
            await asyncio.sleep(0)  # motor görevi çalışıp düşsün

    assert motor._depo is None  # kapatıldı: ikinci sunucu dosyayı açabilir
    Motor.ayardan(Ayar(kisi=4, veri=tmp_path), saat=SahteSaat(1e9)).kapat()


@pytest.mark.parametrize("adres", ["/", "/?clean=1"])
async def test_kok_adres_arayuzu_verir(istemci, dist, adres):
    yanit = await istemci.get(adres)

    assert yanit.status_code == 200
    assert tur(yanit) == "text/html"
    assert yanit.text == (dist / "index.html").read_text(encoding="utf-8")


async def test_index_html_tarayici_onbelleginde_bayatlamaz(istemci):
    # Arayüz yeniden derlenince index.html yeni .js adını gösterir; tarayıcı eski kopyayı sormadan
    # kullanırsa silinmiş dosyayı ister ve sayfa boş kalır.
    yanit = await istemci.get("/")

    assert yanit.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize(
    ("yol", "beklenen_tur"),
    [
        ("assets/x.js", "text/javascript"),
        ("assets/x.css", "text/css"),
        ("assets/yazi.woff2", "font/woff2"),
        ("logo.svg", "image/svg+xml"),
        ("veri.json", "application/json"),
    ],
)
async def test_statik_dosya_turu_isletim_sisteminden_bagimsiz(istemci, dist, monkeypatch, yol, beklenen_tur):
    # Windows'ta Python `mimetypes` kayıt defterinden .js için text/plain okuyabilir ve sayfa
    # açılmaz (PLAN R6). Aynı durumu taklit et: işletim sistemi tablosu yanlış tür söylüyor.
    mimetypes.init()
    monkeypatch.setitem(mimetypes.types_map, "." + yol.rsplit(".", 1)[1], "text/plain")

    yanit = await istemci.get("/" + yol)

    assert yanit.status_code == 200
    assert tur(yanit) == beklenen_tur
    assert yanit.content == (dist / yol).read_bytes()


@pytest.mark.parametrize("yol", ["/assets/yok.js", "/assets", "/assets/"])
async def test_olmayan_dosya_ve_klasor_istegi_404(istemci, yol):
    yanit = await istemci.get(yol)

    assert yanit.status_code == 404


@pytest.mark.parametrize("yol", ["/%2e%2e/gizli.txt", "/assets/%2e%2e/%2e%2e/gizli.txt"])
async def test_ust_klasore_cikan_yol_dist_disindaki_dosyayi_vermez(istemci, dist, yol):
    (dist.parent / "gizli.txt").write_text("parola", encoding="utf-8")

    yanit = await istemci.get(yol)

    assert yanit.status_code == 404
    assert "parola" not in yanit.text


async def test_mutlak_yol_dist_disindaki_dosyayi_vermez(istemci, dist):
    gizli = dist.parent / "gizli.txt"
    gizli.write_text("parola", encoding="utf-8")

    # İstek yolu "//…/gizli.txt". Tam adres şart: "//" ile başlayan göreli adreste ilk parça sunucu adı sayılır.
    yanit = await istemci.get("http://test/" + str(gizli))

    assert yanit.status_code == 404
    assert "parola" not in yanit.text


async def test_dist_yokken_kok_adres_aciklama_verir_ve_sunucu_calisir(istemci_ac, tmp_path):
    async with istemci_ac(uygulama_olustur(Ayar(dist=tmp_path / "yok"))) as istemci:
        kok = await istemci.get("/")
        saglik = await istemci.get("/api/health")

    assert kok.status_code == 200
    assert tur(kok) == "text/plain"
    assert "derlenmedi" in kok.text
    assert saglik.status_code == 200


@pytest.mark.parametrize(
    "yol",
    [
        "/%00",  # NUL baytı
        "/assets/%00.js",
        "/" + "a" * 300,  # dosya adı sınırını aşan parça
    ],
)
async def test_bozuk_yol_404_doner_sunucu_hatasi_degil(istemci, yol):
    yanit = await istemci.get(yol)

    assert yanit.status_code == 404


@pytest.mark.parametrize(
    "adres",
    [
        "http://test///sunucu/paylasim/x",  # ağ yolu (UNC), eğik çizgiyle
        "http://test/%5C%5Csunucu%5Cpaylasim%5Cx",  # ağ yolu, ters eğik çizgiyle
        "http://test/C:%5CWindows%5Cwin.ini",  # sürücü harfi
        "http://test/C:/Windows/win.ini",  # sürücü harfi, eğik çizgiyle
        "http://test/assets%5C..%5C..%5Cgizli.txt",  # ters eğik çizgiyle üst klasör
    ],
)
async def test_windows_ag_ve_surucu_yollari_dosya_sistemine_sorulmadan_reddedilir(istemci, monkeypatch, adres):
    # Windows'ta \\sunucu\paylasim yolunu çözmek bile o sunucuya oturum açar (kimlik bilgisi sızar) ve ağ
    # zaman aşımına kadar olay döngüsünü kilitler. Böyle yollar dosya sistemine hiç sorulmamalı.
    def dokunuldu(self, *args, **kwargs):
        raise AssertionError(f"dosya sistemine soruldu: {self}")

    monkeypatch.setattr("pathlib.Path.resolve", dokunuldu)

    yanit = await istemci.get(adres)

    assert yanit.status_code == 404


@pytest.mark.parametrize("yontem", ["GET", "POST", "PUT", "PATCH", "DELETE"])
async def test_bilinmeyen_api_ucu_404_ve_sozlesme_govdesi(istemci, yontem):
    # Arayüz PATCH ve DELETE de kullanır: tanımsız uç her yöntemde sözleşme gövdesiyle 404 dönmeli.
    yanit = await istemci.request(yontem, "/api/yok")

    assert yanit.status_code == 404
    govde = yanit.json()
    assert govde["ok"] is False
    assert isinstance(govde["hata"], str) and govde["hata"]


@pytest.mark.parametrize(
    ("yontem", "yol"),
    [("GET", "/api/demo"), ("POST", "/api/yaklastir"), ("POST", "/api/demo/tut")],
)
async def test_mocka_ozgu_uclar_gercek_sunucuda_yok(istemci, yontem, yol):
    # Arayüz demo düğmelerini yalnız GET /api/demo başarılı dönerse gösterir.
    yanit = await istemci.request(yontem, yol)

    assert yanit.status_code == 404
    assert yanit.json()["ok"] is False


async def test_isleyici_istisnasi_500_doner_ve_sunucu_ayakta_kalir(istemci_ac, dist):
    uygulama = uygulama_olustur(Ayar(dist=dist))

    async def patla():
        raise RuntimeError("beklenmeyen")

    uygulama.add_api_route("/api/patla", patla)
    uygulama.router.routes.insert(0, uygulama.router.routes.pop())  # /api/* 404 yakalayıcısının önüne

    async with istemci_ac(uygulama) as istemci:
        hata = await istemci.get("/api/patla")
        sonra = await istemci.get("/api/health")

    assert hata.status_code == 500
    assert hata.json()["ok"] is False
    assert sonra.status_code == 200
