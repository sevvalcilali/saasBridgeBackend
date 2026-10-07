# Faz 3 — Kurulum / Eşik Ekranı · Teslim Notu

Tarih: 30.09.2026 · Dal: `faz-0-altyapi` (PR #1) · Test: **160/160 yeşil** · Tarayıcıda (Playwright) uçtan uca kabul senaryosu geçti · Faz 2 kabul senaryosu da yeniden çalıştırıldı ve geçti (gerileme yok) · Build: `dist/` 298 kB JS (gzip 91 kB).

**Kabul ölçütü:** Eşik kaydırıcısı, grafik, tablo, sihirbaz ve kart sağlığı mock ile uçtan uca çalışıyor; brief §8'in bütün maddeleri karşılandı. Kabul senaryosunun adımları:
1. panodaki eşik rozeti,
2. eşik kaydırıcısı,
3. canlı grafik,
4. çift tablosu,
5. perspektif,
6. kalibrasyon (ölç → öner → uygula),
7. kart sağlığında kayıp kart,
8. tablet ve telefon düzeni.

Grafik, tablo ve kalibrasyon için mock gerçek hızda (1×) çalıştı; kayıp kart senaryosu için 10× hızda.

## Ekran görüntüleri

| Dosya | Ne gösteriyor |
|---|---|
| `01_kurulum_genel.png` | 1280 px genel görünüm: eşik, canlı sinyal, çiftler, kalibrasyon, kart sağlığı |
| `02_esik.png` | Eşik kaydırıcısı: büyük değer, ±1, "şu an N çift eşik üstünde", kayıt durumu |
| `03_canli_sinyal.png` | Canlı grafik, üzerine gelince ipucu |
| `04_cift_tablosu.png` | Çift tablosu: durum, değer, iki yön ayrı, yön farkı ⇄, ölçüm sayısı |
| `05_perspektif.png` | Perspektif: yalnız seçilen kişinin çiftleri |
| `06_kalibrasyon_olcum.png` | Kalibrasyon 1. adım: yüz yüze, 10 sn geri sayım |
| `07_kalibrasyon_oneri.png` | Kalibrasyon 3. adım: iki ölçüm, ölçekte öneri, "Eşiği -66 dBm yap" |
| `08_kart_sagligi.png` | Kart sağlığı: kayıp kart ve düşük pil üstte |
| `09_tablet_900.png` · `10_telefon_600.png` | Tek sütun düzen |

## Neyi neden böyle yaptım

**Ayrı bir "Kurulum" sayfası.** Brief bunu öneriyordu. Faz 1'de panodaki eşik rozetine "Faz 3'te açılacak" notu konmuştu; rozet artık bu sayfaya götürüyor. Sayfa panoyla aynı canlı veriyi okuyor. Yeni sunucu ucu gerekmedi; yalnız mock'a donanımsız kalibrasyon denemesi için bir demo ucu eklendi.

**Eşik: sürüklerken değil, bırakınca kaydediliyor** (brief: ~250 ms sonra).
- Beş ardışık tuş ya da bir sürükleme tek istek gönderiyor; tarayıcıda istekler sayılarak doğrulandı.
- Grafikteki eşik çizgisi ise sürüklerken **anında** oynuyor. Teknik kişi hangi çiftlerin eşiğin altında kalacağını, kaydetmeden önce görüyor.
- Sunucu reddederse ya da ağ koparsa değer sunucudakine geri dönüyor ve "Kaydedilemedi" yazıyor. `client.js` ret durumunda istisna atmıyor, `false` döndürüyor; bunu da hata sayan bir test var.

**Grafik bağımlılıksız SVG, kabın gerçek piksel genişliğinde çiziliyor.** İlk sürüm sabit genişlikte çizilip ölçekleniyordu; telefonda yazılar okunmaz hale geliyordu. Diğer tercihler:
- Eksen kaydırıcıyla aynı aralıkta (-95…-35) ve sabit, veri geldikçe oynamıyor.
- Her çift, iki kişinin renklerinin dönüşümlü kesikleriyle çiziliyor. Kimliği renk değil çizgi sonundaki "3 · 4" etiketi taşıyor; etiketler çakışmasın diye aralanıyor.
- Varsayılan olarak en güçlü 6 çift gösteriliyor, isteyen "Tümünü göster"e basabiliyor.

**Eşik üstü bölge nötr tonda (senin kararın).** Eşik üstünde olmak henüz birlikte olmak demek değil (5 sn giriş gecikmesi). Bu yüzden yeşil yalnız tabloda "birlikte" ve "bitiyor…" durumlarında kullanılıyor.

**Ara durumlar yeni sunucu alanı gerektirmeden türetiliyor:**
- `above ∧ ¬together` = **başlıyor…**
- `¬above ∧ together` = **bitiyor…**

Brief §9-7'deki `pending` alanına gerek kalmadı.

**Sakin tablo.** Satırlar kart numarasına göre sabit sırada, durum değişince yer değiştirmiyor; tarayıcıda her yarım saniyede ölçüldü. Küçük numara solda; kişiler yer değişince iki yön de (A→B / B→A) birlikte çevriliyor. Bu yön karışıklığı yazarken bir testle yakalandı. Bir kişinin adına tıklamak o kişinin perspektifine geçiriyor.

**Kalibrasyon "10 sn ortanca"yı tam karşılıyor.** `signals[].value` zaten son 10 sn'nin ortancası. Bu yüzden "Kaydet" 10 saniye geri sayıyor ve sonunda değeri okuyor; ölçüm kartların tutulduğu 10 saniyeyi kapsıyor, öncesini değil. Kullanıcıyı iki durumda uyarıyorum:
- iki ölçüm birbirine yakınsa (<6 dB): "eşik güvenilir ayıramaz",
- sırt sırta ölçüm yüz yüzeden güçlü çıkmışsa: "ölçümler karışmış olabilir".

Görsel anlatım gömülü SVG iki insan simgesiyle yapılıyor; mesafe ölçüsü yok.

**Kart sağlığında ölçütler diğer ekranlarla aynı.** 60 sn duyulmayan kart "duyulmuyor" (masadaki "Kartı kontrol et" ile aynı sabit), 30 sn'yi geçen "görünmüyor" (panodaki gibi), pil %20 altı "pil düşük". Sorunlular üstte. Dar sağ sütunda en önemli bilgi olan durum sütunu kart numarasının hemen yanında; sayılar hiç kesilmiyor, kısalma yalnız kişi adında oluyor (tam ad üzerine gelince görünüyor). Paket hızı yok (senin kararın).

**Temiz mimari.** Tüm hesaplar `api/` altında saf ve testli fonksiyonlarda: `esik`, `sinyal`, `grafik`, `kalibrasyon`, `kartSagligi`. Ortak parçalar `components/` altında:
- `HataBantlari` panodan taşındı,
- `KisiRozeti` yeni.

`MasaApi`'deki istek kodu ortak `api/http.js`'e çıkarıldı ve Kurulum aynı katmanı kullanıyor. Masa testleri değişmeden geçiyor.

## Brief kural kontrolü (§8, §10)

- [x] Eşik kaydırıcısı -95…-35, anlık değer büyük yazıyla, bırakınca ~250 ms
- [x] Canlı grafik: 90 sn, çift başına çizgi (iki kişinin rengi), eşik kesikli çizgi, eşik üstü bölge (nötr), uçta "3 · 4" etiketi, üzerine gelince değer, perspektif
- [x] Çift tablosu: iki kişi renkli, iki yön ayrı, ortanca, birlikte sayılır / sayılmaz (+ başlıyor… / bitiyor…), ölçüm sayısı
- [x] Kalibrasyon: yüz yüze → sırt sırta → ortaya koy → onayla; iki insan simgesiyle anlatım
- [x] Kart sağlığı: son duyulma, pil, "sorunlu" etiketi (paket hızı kararla çıkarıldı)
- [x] dBm ve yön farkı yalnız bu teknik ekranda; **metre/cm yok** (koruma testi var)
- [x] Kimlik renk + rol şekli + ad + kart no; durum renk + ikon + yazı
- [x] Tablet (900 px) ve telefon (600 px) düzeni: yatay taşma yok, durum sütunu kaydırmadan görünüyor

## Yol boyunca bulunan ve düzeltilen hatalar

1. **Test kırmızıyken commit gitti (3.1).** Komut zincirim test sonucunu değil `grep`'in sonucunu kontrol ediyordu. Ertesi commit'le düzeltildi; o andan itibaren commit'ler yalnız testler yeşilse atıldı.
2. **Çift tablosunda yön karışıklığı (3.3).** Kişiler yer değiştirirken yönler aynı kalıyordu; test yakaladı.
3. **"Kart 14 14" tekrarı ve ekran okuyucuda birleşik ad/numara (3.3).** Kayıtsız kartta numara iki kez yazılıyordu, ad ile kart no arasında da gerçek bir boşluk yoktu.
4. **Grafik yazıları telefonda okunmuyordu, ipucu satırları kırılıyordu (3.4).**
5. **Kart sağlığında dar sütunlar kesiliyordu (3.7 / 3.8).** Yanlış bir daraltma "görünmüyor" yazısını komşu sütuna taşırıyordu.
6. **Mock istek işleyicisinde rastgele sayı kullanılmıştı (3.6).** Mock'un kendi "tohum bozulmasın" kuralına aykırıydı; kaldırıldı.

## Soru sormadan verdiğim kararlar ("Faz 3'ü sorgulamadan bitir" talimatıyla)

1. Yön farkı işareti **≥8 dB**, seyrek ölçüm **n < 5** (son 10 sn).
2. Grafikte varsayılan **en güçlü 6 çift**.
3. Kalibrasyonda öneri iki ölçümün **tam ortası** (tam sayıya yuvarlı); fark **<6 dB** ise uyarı.
4. Perspektif için 25 düğme yerine **seçici + tablodan tıklama**.
5. Mock'ta 23'ün katı kartların pili zayıf (demo), böylece "pil düşük" görülebiliyor.

## Açık sorular / bilinen konular

1. **Kişi paleti** renk ayrımı doğrulamasından geçmiyor (ayrıntı PLAN §4). Kimlik her yerde zaten renk + şekil + ad ile verildiği için bugün kullanılabilirlik sorunu değil. Öneri: Faz 5'te (tema) paleti yeniden adımlamak.
2. **Muhittin'e yeni soru** (`SUNUCUDAN_ISTENENLER.md` §5): kalibrasyonda kullanılan yedek (atanmamış) kartların çiftleri `signals` ve `history`'de görünecek mi?
3. **Mock'ta "başlıyor…" durumu 10× hızda görülmüyor**, çünkü 5 sn'lik giriş gecikmesi tek bir tike sığıyor. 1× hızda görülüyor; türetme mantığı birim testle kilitli.
4. **Kurulum sayfasına herkes erişebiliyor.** Masa tabletindeki görevli yanlışlıkla eşiği değiştirebilir. Brief'te yetki konusu yok; gerekirse ayrıca karar.
