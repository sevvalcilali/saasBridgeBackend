"""Benzetim (PLAN B1.3): mock tik() dinamiğinin paket üreten hali — aynı senaryo zamanlaması."""
from statistics import mean

import pytest

from yakinlik.cekirdek.sinyal import SinyalDeposu
from yakinlik.giris.benzetim import EN_BUYUK_GRUP, Benzetim, BenzetimKaynak

# Yan yana duran çift ≈ −52 dBm, ayrılan çift ≈ −84 dBm duyulur; arası boş kalır.
GUCLU, ZAYIF = -66.0, -74.0


def kos(benzetim, saniye, dt=0.5):
    """Benzetimi `saniye` kadar ilerletir; tikleri döndürür."""
    return [benzetim.tik(dt) for _ in range(round(saniye / dt))]


def gonderenler(tik):
    return {paket.kart for paket in tik.paketler}


def duyulanlar(tik):
    return {kart for paket in tik.paketler for kart, _ in paket.duyulanlar}


# --- kadro ve kartlar ---

def test_kadro_mock_ile_ayni_oranlarda_ve_adlarla_kurulur():
    kadro = Benzetim(kisi=25, tohum=1).kadro

    roller = [kisi.rol for kisi in kadro]
    assert (roller.count("investor"), roller.count("founder"), roller.count("guest")) == (10, 12, 3)
    assert [kisi.ad for kisi in kadro[:2]] == ["Ayşe Demir", "Mehmet Kılıç"]
    assert (kadro[0].kurum, kadro[10].kurum, kadro[24].kurum) == ("Atlas Ventures", "Nova Robotik", "")
    assert all(2 <= kisi.yildiz <= 5 for kisi in kadro if kisi.rol == "investor")
    assert all(kisi.yildiz == 0 for kisi in kadro if kisi.rol != "investor")


def test_kadro_kartlari_tekildir_ve_ayrilmis_numaralari_kullanmaz():
    kartlar = [kisi.kart for kisi in Benzetim(kisi=25, tohum=1).kadro]

    assert len(set(kartlar)) == 25
    # 1 kullanılmaz, 14 "atanmamış kart" senaryosuna ayrılmıştır (mock ile aynı havuz: 2–99, 14 hariç).
    assert all(2 <= int(kart) <= 99 and kart != "14" for kart in kartlar)


def test_kisi_sayisi_kart_havuzunu_asamaz():
    assert len(Benzetim(kisi=150, tohum=1).kadro) == 97


def test_masada_alti_yedek_kart_durur_paket_yollar_ama_kimseyle_olculmez():
    benzetim = Benzetim(kisi=25, tohum=1)
    kadro_kartlari = {kisi.kart for kisi in benzetim.kadro}
    tikler = kos(benzetim, 120.0)

    assert len(benzetim.masadaki) == 6
    assert not set(benzetim.masadaki) & (kadro_kartlari | {"14"})
    for tik in tikler:
        yedek_paketleri = [paket for paket in tik.paketler if paket.kart in benzetim.masadaki]
        assert len(yedek_paketleri) == 6
        assert all(paket.duyulanlar == () for paket in yedek_paketleri)
        assert not duyulanlar(tik) & set(benzetim.masadaki)


def test_her_tikte_salondaki_her_kart_tek_paket_yollar_ve_zaman_ilerler():
    benzetim = Benzetim(kisi=25, tohum=1)
    tikler = kos(benzetim, 2.0)

    assert [tik.t for tik in tikler] == [0.5, 1.0, 1.5, 2.0]
    for tik in tikler:
        assert {kisi.kart for kisi in benzetim.kadro} <= gonderenler(tik)
        assert len(tik.paketler) == len(gonderenler(tik))
        assert all(paket.t == tik.t for paket in tik.paketler)
        assert all(not hasattr(paket, "pil") for paket in tik.paketler)  # sahte pil yok (Şevval 07.10.2026)


# --- senaryo zamanlaması (mock ile aynı) ---

def test_atanmamis_kart_14_kirk_besinci_saniyede_salona_girer():
    tikler = kos(Benzetim(kisi=25, tohum=1), 50.0)

    assert all("14" not in gonderenler(tik) for tik in tikler if tik.t < 45.0)
    assert all("14" in gonderenler(tik) for tik in tikler if tik.t >= 45.0)


def test_kayip_kart_180_ile_300_saniye_arasinda_susar_ve_kimse_onu_duymaz():
    tikler = kos(Benzetim(kisi=25, tohum=1, kopma=False), 305.0)
    an = {tik.t: tik for tik in tikler}

    (susan,) = gonderenler(an[179.5]) - gonderenler(an[180.0])

    assert all(susan not in gonderenler(tik) | duyulanlar(tik) for tik in tikler if 180.0 <= tik.t < 300.0)
    assert all(susan in gonderenler(tik) for tik in tikler if tik.t >= 300.0)


def test_alici_kopunca_paket_gelmez_ama_tikler_surer():
    tikler = kos(Benzetim(kisi=25, tohum=1), 505.0)

    bos = [tik.t for tik in tikler if not tik.paketler]
    # 120. sn'de 20 sn, sonra 480. sn'de (her 360 sn'de bir) yeniden.
    assert bos == [120.5 + i * 0.5 for i in range(40)] + [480.5 + i * 0.5 for i in range(40)]


def test_hizlandirilinca_kopma_en_az_dort_tik_surer():
    # Mock: kopma süresi max(20, tik × 4). 60 kat hızda tik 30 benzetim sn'dir; kopma 20 sn sürseydi
    # tek tikte atlanır, arayüzdeki "ALICI BAĞLI DEĞİL" bandı hızlandırılmış denemede hiç görünmezdi.
    tikler = kos(Benzetim(kisi=25, tohum=1), 600.0, dt=30.0)

    assert [tik.t for tik in tikler if not tik.paketler] == [150.0, 180.0, 210.0, 240.0, 510.0, 540.0, 570.0, 600.0]


def test_kopma_kapaliyken_bos_tik_olmaz():
    tikler = kos(Benzetim(kisi=25, tohum=1, kopma=False), 145.0)

    assert all(tik.paketler for tik in tikler)


# --- sinyal ---

def test_konusan_cift_guclu_ayrilan_cift_zayif_duyulur():
    benzetim, depo = Benzetim(kisi=25, tohum=1, kopma=False), SinyalDeposu()
    ilk_deger, son_deger, an = {}, {}, {}
    for tik in kos(benzetim, 16 * 60):
        an[tik.t] = tik
        depo.ekle(tik.paketler)
        for sinyal in depo.sinyaller(tik.t):
            ilk_deger.setdefault((sinyal.a, sinyal.b), sinyal.value)
            son_deger[(sinyal.a, sinyal.b)] = sinyal.value
        depo.unut(tik.t)
    # 180. sn'de susan kartın çiftleri zorla ayrılır; görüşme süresinin kendisini sınamak için onları ayır.
    (susan,) = gonderenler(an[179.5]) - gonderenler(an[180.0])
    kendiliginden = [deger for cift, deger in son_deger.items() if susan not in cift]

    assert all(deger > -70.0 for deger in ilk_deger.values())  # çift, yan yana gelince duyulmaya başlar
    assert all(deger > GUCLU or deger < ZAYIF for deger in son_deger.values())
    assert any(deger > GUCLU for deger in kendiliginden)
    assert any(deger < ZAYIF for deger in kendiliginden)  # görüşmeler 2–14 dk sürer: süresi dolup ayrılanlar var


def test_hicbir_gorusme_14_dakikadan_uzun_surmez():
    # Mock: her çiftin yan yana kalma süresi 2–14 dk arası rastgele. Görüşme, çift ilk güçlü ölçüldüğü andan
    # ayrıldığı (zayıf ölçüldüğü) ana kadar sürer. Tek tikte gürültüyle güçlü ölçüm düşebilir (ya da o yön
    # gelmeyebilir); bu görüşmeyi bölmez, yalnız zayıf ölçüm (ayrılık) böler.
    en_uzun = 0.0
    for tohum in range(3):
        baslangic = {}
        for tik in kos(Benzetim(kisi=25, tohum=tohum, kopma=False), 40 * 60):
            guclu, zayif = set(), set()
            for paket in tik.paketler:
                for diger, rssi in paket.duyulanlar:
                    if rssi > -62.0:
                        guclu.add(frozenset((paket.kart, diger)))
                    elif rssi < ZAYIF:
                        zayif.add(frozenset((paket.kart, diger)))
            for cift in zayif:
                baslangic.pop(cift, None)
            for cift in guclu:
                en_uzun = max(en_uzun, tik.t - baslangic.setdefault(cift, tik.t))

    assert 10 * 60 < en_uzun <= 14 * 60


def karma_orani(gruplar):
    karma = toplam = 0
    for tohum in range(20):
        benzetim = Benzetim(kisi=25, tohum=tohum, kopma=False, gruplar=gruplar)
        rol = {kisi.kart: kisi.rol for kisi in benzetim.kadro}
        bulusan = set()
        for tik in kos(benzetim, 15 * 60):
            bulusan |= {
                frozenset((paket.kart, diger)) for paket in tik.paketler for diger, rssi in paket.duyulanlar
                if rssi > -62.0 and paket.kart in rol and diger in rol
            }
        toplam += len(bulusan)
        karma += sum({rol[x] for x in cift} == {"investor", "founder"} for cift in bulusan)
    return karma / toplam


def test_yatirimci_ile_girisimci_birbirini_daha_cok_bulur():
    # Mock: boştaki kart %70 olasılıkla karşı rolden birini seçer. Bu eğilim pano istatistiklerini (karma
    # görüşme, yatırımcıya ulaşan girişimci) ve anlaşma bildirimlerini besler. Eğilim varken çiftlerin
    # ~%65'i yatırımcı–girişimci, yokken ~%40 (20 tohum × 15 dk ile ölçüldü, 04.10.2026).
    assert karma_orani(gruplar=False) > 0.52  # mock birebir (yalnız ikili)
    # Gruplarda aynı rolden çiftler de oluşur (iki yatırımcı aynı girişimciyle); eğilim yine belirgin (~%51).
    assert karma_orani(gruplar=True) > 0.45


def guclu_gruplar(tik):
    """O tikte gerçekten ölçülen güçlü çiftlerden gruplar (bağlı bileşenler). Susan kartın eski değeri karışmasın
    diye sinyallere değil paketlere bakılır."""
    komsu = {}
    for paket in tik.paketler:
        for diger, rssi in paket.duyulanlar:
            if rssi > -62.0:  # ayrılmış çiftin tek ölçümü buraya çıkamaz (merkez en çok −79, sapma 3)
                komsu.setdefault(paket.kart, set()).add(diger)
                komsu.setdefault(diger, set()).add(paket.kart)
    gruplar, gorulen = [], set()
    for kart in komsu:
        if kart in gorulen:
            continue
        grup, yigin = set(), [kart]
        while yigin:
            x = yigin.pop()
            if x not in grup:
                grup.add(x)
                yigin.extend(komsu[x] - grup)
        gorulen |= grup
        gruplar.append(grup)
    return gruplar


def test_bos_kart_bazen_var_olan_gruba_katilir_3_4_kisilik_gruplar_olusur_5i_gecmez():
    # Şevval isteği (2026-10): panoda 3–4 kişilik grupları da görmek. Mock yalnız ikili eşleştirir; gerçek salonda
    # biri yan yana duran ikiliye katılır. Grup en çok EN_BUYUK_GRUP (5) kişi.
    boyutlar = set()
    for tohum in range(3):
        for tik in kos(Benzetim(kisi=25, tohum=tohum, kopma=False), 30 * 60):
            boyutlar |= {len(grup) for grup in guclu_gruplar(tik)}

    assert {2, 3, 4} <= boyutlar
    assert max(boyutlar) <= EN_BUYUK_GRUP


def test_ayni_tohum_ayni_paketleri_farkli_tohum_farkli_paketleri_uretir():
    assert kos(Benzetim(kisi=25, tohum=7), 60.0) == kos(Benzetim(kisi=25, tohum=7), 60.0)
    assert kos(Benzetim(kisi=25, tohum=7), 60.0) != kos(Benzetim(kisi=25, tohum=8), 60.0)


def test_60_saniyede_sinyal_sayisi_ve_grafik_uzunlugu_mock_ile_ayni_buyuklukte():
    # Kabul ölçütü (PLAN B1): mock ile ±%10. Karşılaştırma değerleri mock'un kendi tik() kodu
    # 300 tohumla 60 benzetim saniyesi (120 tik, 25 kişi) koşturularak ölçüldü (04.10.2026):
    # ortalama sinyal sayısı 8,803; çift başına ortalama grafik uzunluğu 18,413.
    MOCK_SINYAL_SAYISI, MOCK_GRAFIK_UZUNLUGU = 8.803, 18.413
    sinyal_sayilari, grafik_uzunluklari = [], []
    for tohum in range(300):
        benzetim, depo = Benzetim(kisi=25, tohum=tohum, gruplar=False), SinyalDeposu()  # mock birebir: yalnız ikili
        for tik in kos(benzetim, 60.0):
            depo.ekle(tik.paketler)
        sinyal_sayilari.append(len(depo.sinyaller(60.0)))
        grafik_uzunluklari += [len(seri) for seri in depo.gecmis(60.0).values()]

    assert mean(sinyal_sayilari) == pytest.approx(MOCK_SINYAL_SAYISI, rel=0.10)
    assert mean(grafik_uzunluklari) == pytest.approx(MOCK_GRAFIK_UZUNLUGU, rel=0.10)


# --- kaynak (gerçek zaman sarmalayıcısı) ---

async def test_kaynak_yarim_saniyede_bir_tik_uretir_hizlandirma_benzetim_zamanini_carpar(bekleme_yok, ilk_tikler):
    kaynak = BenzetimKaynak(Benzetim(kisi=5, tohum=1), hiz=10, bekle=bekleme_yok)

    tikler = await ilk_tikler(kaynak, 3)

    assert bekleme_yok.istenen == [0.5, 0.5, 0.5]  # gerçek zamanda hep 0,5 sn
    assert [tik.t for tik in tikler] == [5.0, 10.0, 15.0]  # benzetim zamanı 10 kat hızlı


# --- masa ile bağlantı (PLAN B3, 16.3 madde 6 kararı) ---

def test_masadan_verilen_kart_salona_girer_masadan_cikar():
    benzetim = Benzetim(kisi=25, tohum=1, kopma=False)
    kart = benzetim.masadaki[0]

    benzetim.kart_ver(kart, "founder")
    tikler = kos(benzetim, 20 * 60)

    assert kart not in benzetim.masadaki
    assert any(kart in duyulanlar(tik) for tik in tikler)  # salonda biriyle yan yana gelip ölçüldü


def test_iade_edilen_kart_salondan_cikar_masada_acik_durur():
    benzetim = Benzetim(kisi=25, tohum=1, kopma=False)
    kart = benzetim.kadro[0].kart

    benzetim.kart_al(kart, masaya=True)
    tikler = kos(benzetim, 5 * 60)

    assert kart in benzetim.masadaki
    assert all(kart in gonderenler(tik) and kart not in duyulanlar(tik) for tik in tikler)


def test_degisimde_birakilan_eski_kart_kapanir():
    benzetim = Benzetim(kisi=25, tohum=1, kopma=False)
    kart = benzetim.kadro[0].kart

    benzetim.kart_al(kart, masaya=False)
    tik = benzetim.tik(0.5)

    assert kart not in gonderenler(tik) | duyulanlar(tik)
    assert kart not in benzetim.masadaki


def test_kirk_besinci_saniyeden_once_verilen_kart_14_ikinci_kez_eklenmez():
    benzetim = Benzetim(kisi=25, tohum=1, kopma=False)
    benzetim.kart_ver("14", "guest")
    kos(benzetim, 60.0)  # 45. sn senaryosu geçti

    benzetim.kart_al("14", masaya=False)  # tek kopya varsa kart artık salonda değil
    tik = benzetim.tik(0.5)

    assert "14" not in gonderenler(tik)


def test_alici_kartlari_masadan_zayif_duyar_degerler_tekrarlanabilir():
    # Mock: alıcı kartları −72 − (no mod 15) ± 3 dBm duyar; kimse kartı alıcıya yaklaştırmıyor ("yaklaştır" yalnız mock'ta).
    tikler = kos(Benzetim(kisi=25, tohum=1), 30.0)
    gucler = [paket.alici_rssi for tik in tikler for paket in tik.paketler]

    assert all(-90.0 <= guc <= -69.0 for guc in gucler)
    assert kos(Benzetim(kisi=25, tohum=1), 30.0) == tikler
