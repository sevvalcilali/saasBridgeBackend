# Duyarlı Tasarım Turu — Telefon · Tablet · Bilgisayar · Not

Tarih: 02.10.2026 · Dal: `faz-0-altyapi` (PR #1) · Test: 223/223 yeşil · Faz 2–5 kabul senaryoları yeniden geçti.

## Hedef

Brief §7 "mobil/tablet düzeni" ve §11 "ucuz tablette akıcı" diyordu; şimdiye kadar 600 px ve üstü hedeflenmişti. Bu turda
gerçek cihazlar hedeflendi: telefon (360 / 390 / 430 px, yatay 740×360), tablet (600 / 768 / 820 dikey, 1024 yatay) ve
bilgisayar (1180 / 1280 / 1440). Hiçbir yeni bağımlılık eklenmedi; her şey CSS ve iki küçük JSX değişikliği.

## Nasıl ölçüldü

Tarayıcıda (Playwright) 8 ekran durumu × 10 genişlik: pano, pano + kişi paneli, masa (liste, kart seçimi, yeni kişi),
kurulum, rapor, sunum. Her birinde:
- sayfada yatay kaydırma var mı,
- ekranın dışına çıkan öğe var mı,
- 36 px'ten küçük dokunma hedefi var mı (yalnız ≤ 820 px),
- 12 px'ten küçük yazı var mı,
- konsol hatası var mı.

**Önce:** yatay taşma hiçbir yerde yoktu. Ama 360 px'te menü üç satıra dağılıyor, filtre çipleri dört satır tutuyor,
kişi satırında ad kesiliyor (sol sütuna 133 px kalıyordu), kişi paneli ekranın %92'sini kaplayıp arkada işe yaramaz bir
şerit bırakıyor, rapor tabloları kaydırmak yerine hücreleri sarıp sayfayı 8 000 px uzatıyor, sunumda ağ görünmez
küçüklükte kalıyordu. Dokunma hedefleri küçüktü: menü bağlantısı 20 px, tema 28, eşik/sıfırla 30, filtre çipleri 28,
Kurulum'daki ad düğmeleri 24. Birkaç 10–11 px yazı vardı.

Bir de her genişlikte görünen gerçek bir hata çıktı: **kişi panelindeki "Bugün kiminle" listesinde süre alt satıra
düşüp parçalanıyordu.** Önceki turda eklenen rol şekli, üç sütunlu grid'de dördüncü öğe olmuştu.

**Sonra:** aynı tarama — hiçbir genişlikte taşma, küçük hedef ya da küçük yazı yok. Tek işaretli yer bilerek yatay
kaydırılan filtre çipi satırı.

## Kararlar

| Konu | Karar |
|---|---|
| Kırılma noktaları | ≤480 dar telefon · ≤600 telefon · 601–900 tablet dikey / yatay telefon · 901–1100 tablet yatay, küçük laptop · >1100 masaüstü. `theme/tokens.css` başında yazılı. |
| Dokunma hedefi | ≤1024 px'te tüm düğme/bağlantı/seçiciler ≥36 px, birincil olanlar 40–44 px. Görünüm değişmedi, vuruş alanı büyüdü. |
| Menü (≤600) | Dört sekme eşit genişlikte tek sıra (44 px); altında "Sunum modu" ve Açık/Koyu. |
| Pano (≤600) | Boşluklar küçüldü. Filtre çipleri tek sıra, yatay kaydırmalı (dört satır dikey yer yiyordu). Çubuk sabit (sticky) değil. ≤480'de ad kesilmek yerine sarıyor. |
| Kişi paneli (≤600) | Tam ekran; Kapat ya da Escape listeye döndürür. `100dvh` ile adres çubuğu hesaba katılır. |
| Rapor (≤700) | Tablolar kaydırma kabında, en az 560 px; **ilk sütun (kişi) kaydırırken sabit** ve en az 150 px. Yazdırma etkilenmez. |
| Sunum (≤900) | Sayfa kaydırılabilir, ağ kendi oranında. Dokunmatikte araç çubuğu her zaman görünür (`hover: none`). |
| Çentik / güvenli alan | `viewport-fit=cover` + `env(safe-area-inset-*)` dolguları. |

## Ekran görüntüleri

| Dosya | Cihaz | Ne gösteriyor |
|---|---|---|
| `01_telefon_pano.png` | Telefon 390×844 | Menü tek sıra, sekmeler, kaydırmalı çipler, sarılan adlar |
| `02_telefon_kisi_paneli.png` | Telefon | Tam ekran kişi paneli; "Bugün kiminle" satırları tek satır |
| `03_telefon_ag.png` · `04_telefon_bildirimler.png` | Telefon | Ağ ve bildirimler sekmeleri |
| `05_telefon_masa.png` · `06_telefon_masa_kart_sec.png` | Telefon | Karşılama masası: kişi listesi ve kart seçimi |
| `07_telefon_kurulum.png` | Telefon | Kurulum tek sütun |
| `08_telefon_rapor_tablo.png` | Telefon | Rapor tablosu: sabit ilk sütun, yatay kaydırma |
| `09_telefon_pano_koyu.png` | Telefon | Koyu tema |
| `10_tablet_dikey_pano.png` · `11_tablet_yatay_pano.png` | Tablet 768×1024 / 1024×768 | Tek sütun yığın · iki sütun |
| `12_tablet_masa.png` · `13_tablet_kurulum.png` | Tablet | Masa ve kurulum |
| `14_bilgisayar_pano.png` · `15_bilgisayar_rapor.png` | 1280 / 1440 | Üç sütun pano · rapor |
| `16_salon_sunum_1920.png` | Salon ekranı 1920×1080 | Sunum modu |
| `17_telefon_yatay_740x360.png` | Yatay telefon | Tablet düzeni, bildirim şeridi |

## Bilinen sınırlar

- **Kurulum telefonda** çalışır ama teknik ekran olduğu için tablet/laptop için tasarlandı; çift tablosu telefonda
  yatay kaydırmayla okunur.
- **Sunum modu** telefonda açılır ama salon ekranı içindir; adlar küçük kalır.
- Dokunmatik boyutlar ekran genişliğine göre uygulanıyor (≤1024). Genişliği 1024'ten büyük dokunmatik ekranlarda (büyük
  tabletler yatay) masaüstü boyutları geçerli; gerekirse `(pointer: coarse)` ile genişletilebilir.
