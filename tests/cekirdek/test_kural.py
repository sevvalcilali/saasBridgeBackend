"""Uyarı kuralları (Şevval isteği 2026-10-06): organizatör her etkinlik için kural kurar — "[kim] ile [kiminle]
[yan yana gelince | N dakikadan uzun birlikte kalınca]" → panoda açılır uyarı. Bir çiftin bir görüşmesinde bir kez."""
import pytest
from destek.salon import UZAK, YAKIN, Salon

from yakinlik.cekirdek.kural import Kural, kural_coz

AYSE_MEHMET = {("2", "3"): YAKIN}  # k1 Ayşe (yatırımcı ★3, kart 2) – k2 Mehmet (girişimci, kart 3)


_sayac = iter(range(1, 1000))


def kural(**alanlar):
    """Her çağrıda yeni kimlik (r1, r2, …): aynı kimlikli kurallar birbirinin "uyardı" kaydını paylaşırdı."""
    govde = {"ad": "Deneme", "kim": {"kisiler": ["k1"]}, "kiminle": {"kisiler": ["k2"]}, "dakika": 0, **alanlar}
    sonuc = kural_coz(govde, f"r{next(_sayac)}", {"k1", "k2", "k3", "k4"})
    assert isinstance(sonuc, Kural), sonuc
    return sonuc


def kural_uyarilari(salon):
    return [b for b in salon.alan.bildirimler if b.kind == "kural"]


# --- doğrulama ---

@pytest.mark.parametrize(("govde", "hata"), [
    ({"kim": {"kisiler": []}}, "kim: en az bir kişi seçin"),
    ({"kim": {"kisiler": ["k99"]}}, "kim: bilinmeyen kişi k99"),
    ({"kim": {"rol": "uydurma"}}, "kim: rol yatırımcı, girişimci, misafir ya da herkes olmalı"),
    ({"kim": {"rol": "investor", "enAzYildiz": 7}}, "kim: en az yıldız 0–5 olmalı"),
    ({"kiminle": None}, "kiminle: kişiler ya da rol seçin"),
    ({"dakika": -1}, "dakika 0–600 olmalı"),
    ({"dakika": "beş"}, "dakika 0–600 olmalı"),
    ({"dakika": True}, "dakika 0–600 olmalı"),
    ({"acik": "evet"}, "acik true / false olmalı"),
])
def test_gecersiz_kural_anlasilir_hatayla_reddedilir(govde, hata):
    tam = {"ad": "X", "kim": {"kisiler": ["k1"]}, "kiminle": {"rol": "herkes"}, "dakika": 5, **govde}

    assert kural_coz(tam, "r1", {"k1", "k2"}) == hata


def test_ad_verilmezse_kuraldan_okunur_bir_ad_uretilir_ad_kirpilir():
    k = kural_coz({"kim": {"rol": "investor", "enAzYildiz": 4}, "kiminle": {"rol": "founder"}, "dakika": 5}, "r3", set())
    uzun = kural_coz({"ad": "A" * 300, "kim": {"rol": "herkes"}, "kiminle": {"rol": "herkes"}}, "r4", set())

    assert k.ad == "★4+ yatırımcılar ile girişimciler · 5 dk"
    assert (k.acik, k.dakika) == (True, 5)
    assert len(uzun.ad) == 80 and uzun.dakika == 0


# --- tetiklenme ---

def test_yan_yana_gelince_kurali_gorusme_baslayinca_bir_kez_tetiklenir():
    salon = Salon()
    salon.alan.kurallar = [kural(ad="Ayşe & Mehmet")]

    salon.gecir(59.0, AYSE_MEHMET)
    once = len(kural_uyarilari(salon))
    salon.gecir(120.0, AYSE_MEHMET)

    (uyari,) = kural_uyarilari(salon)
    assert once == 0  # henüz 1 dakika olmadı: "birlikte" değiller
    assert (uyari.title, uyari.kural, uyari.kisiler, uyari.people) == (
        "Ayşe & Mehmet", salon.alan.kurallar[0].kural_id, ("k1", "k2"), ("2", "3"))
    assert uyari.severity == "kural" and "yan yana geldi" in uyari.detail


def test_dakikali_kural_o_sure_dolunca_tetiklenir_ayrilip_yeniden_bulusunca_yine():
    salon = Salon()
    salon.alan.kurallar = [kural(dakika=3)]

    salon.gecir(170.0, AYSE_MEHMET)  # birlikte süresi < 3 dk
    once = len(kural_uyarilari(salon))
    salon.gecir(20.0, AYSE_MEHMET)
    bir = len(kural_uyarilari(salon))
    salon.gecir(40.0, {("2", "3"): UZAK}).gecir(200.0, AYSE_MEHMET)

    assert (once, bir) == (0, 1)
    assert len(kural_uyarilari(salon)) == 2
    assert "3 dakikadır birlikte" in kural_uyarilari(salon)[0].detail


def test_grup_kurali_iki_yonde_de_eslesir_kapali_kural_tetiklenmez():
    # Ayşe ★3 yatırımcı, Mehmet girişimci: "girişimciler ile ★3+ yatırımcılar" ters yazılsa da eşleşir.
    salon = Salon()
    salon.alan.kurallar = [
        kural(ad="ters", kim={"rol": "founder"}, kiminle={"rol": "investor", "enAzYildiz": 3}),
        kural(ad="yüksek", kim={"rol": "investor", "enAzYildiz": 4}, kiminle={"rol": "founder"}),
        kural(ad="kapalı", acik=False),
    ]

    salon.gecir(90.0, AYSE_MEHMET)

    assert [b.title for b in kural_uyarilari(salon)] == ["ters"]


def test_kayitsiz_kart_hicbir_kurala_uymaz_herkes_dahil():
    salon = Salon()
    salon.alan.kurallar = [kural(kim={"rol": "herkes"}, kiminle={"rol": "herkes"})]

    salon.gecir(90.0, {("3", "14"): YAKIN})

    assert kural_uyarilari(salon) == []


def test_sifirlamada_kurallar_kalir_tetiklenmisler_unutulur():
    salon = Salon()
    salon.alan.kurallar = [kural()]
    salon.gecir(90.0, AYSE_MEHMET)

    salon.alan.sifirla()
    salon.gecir(90.0, {("2", "3"): UZAK}).gecir(90.0, AYSE_MEHMET)

    assert len(salon.alan.kurallar) == 1
    assert len(kural_uyarilari(salon)) == 1  # sıfırlamadan sonraki yeni görüşmede
