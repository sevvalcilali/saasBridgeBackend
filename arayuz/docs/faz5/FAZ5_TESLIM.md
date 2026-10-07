# Faz 5 — Cilalar: Doğrulanmış Palet, Koyu Tema, Sunum Modu, Kalabalık · Teslim Notu

Tarih: 30.09.2026 · Dal: `faz-0-altyapi` (PR #1) · Test: **194/194 yeşil** · Tarayıcıda (Playwright) Faz 5 kabul senaryosu geçti (15/15) · Faz 2, 3 ve 4 kabul senaryoları yeniden koşuldu: 11/11, 16/16, 13/13, gerileme yok · Build: `dist/` 318 kB JS (gzip 97 kB).

**Kabul ölçütü:** Mock ile uçtan uca:
1. kişi paleti iki temada renk körlüğü doğrulayıcısından geçiyor,
2. koyu tema bütün ekranlarda çalışıyor, seçim yenilemede korunuyor, yazdırma yine açık,
3. sunum modu (`?clean=1`) menüsüz, kaydırmasız, isimli / isimsiz,
4. 97 kişide sunum okunuyor ve ekranlar ucuz cihaz benzetiminde akıcı.

## Ekran görüntüleri ve örnek çıktılar

| Dosya | Ne gösteriyor |
|---|---|
| `00_palet.png` | Sunucu paleti → eski açık palet → yeni açık ve koyu palet, ölçümlerle |
| `01_pano_acik.png` | Pano, açık tema (varsayılan), yeni palet; menüde "Sunum modu ↗" ve Açık/Koyu |
| `02_pano_koyu_panel.png` | Pano, koyu tema, kişi paneli açık |
| `03_masa_koyu.png` · `04_kurulum_koyu.png` · `05_rapor_koyu.png` | Masa, Kurulum ve Rapor koyu temada |
| `06_pano_telefon_koyu_600.png` | Telefon (600 px), koyu tema |
| `07_sunum_isimli.png` · `08_sunum_isimsiz.png` · `09_sunum_koyu.png` | Sunum modu 1920×1080 |
| `10_sunum_kalabalik_97.png` | Sunum modu, 97 kişi (kart havuzunun tamamı) |
| `11_kurulum_kalabalik.png` | Kurulum, ~500 çift |
| `ornek_rapor_koyu_temadan.pdf` | Koyu tema seçiliyken alınan PDF: açık temayla basılıyor |

## Neyi neden böyle yaptım

**Kişi rengi artık bir tema token'ı.** Önceden `sunucuRengi` açık paletten bir hex döndürüyordu. Koyu temada da aynı hex kalacaktı, oysa kişi rengi temaya göre ayrı adımlanmalı. Artık sunucunun gönderdiği renk `var(--kisi-mavi)` gibi bir token'a eşleniyor:
- tema değişince bütün ekranlarda kişi renkleri kendiliğinden güncelleniyor,
- kişi aynı renk ailesinde kalıyor ("renk kişiyi takip eder"),
- `#199e70` yine petrole eşleniyor, yeşil yalnız "birlikte".

**Palet doğrulayıcıdan geçecek şekilde yeniden adımlandı (PLAN §4'teki açık bulgu).** Eski açık palette mercan ↔ turuncu normal görüşte bile ΔE 4.8'di, hardal ↔ turuncu renk körlüğünde 1.7'ydi. Açık ve koyu yüzey için tonlar ayrı ayrı arandı. Ölçütler dataviz doğrulayıcısıyla aynı:
- **Açık:** normal görüşte en kötü çift ΔE 17.5, renk körlüğünde (protan/deutan) **tüm** çiftler ≥ 8.1.
- **Koyu:** normal görüşte tüm çiftler ≥ 15.5, sunucu sırasındaki komşular renk körlüğünde ≥ 13.6. Tüm çiftlerde en kötü 6.8; bu, doğrulayıcının "uyarı" bandı ve ikincil kodlama ister. Bizde kimlik zaten her yerde renk + rol şekli + ad.
- Her renk yüzeyde ≥ 3:1, "birlikte" yeşilinden ΔE ≥ 15; gri de ölçüme dahil.

`kontrast.test.js` artık iki temayı ayrı ayrı bu ölçütlerle denetliyor. Bedeli: açık temada "turuncu" koyu kiremit, "hardal" zeytin tonuna kaydı. Adlar yalnız kodda geçiyor, arayüzde renk adı yok.

**Koyu tema bir token değer seti.** Faz 0'da bu yüzden her şey token'dı:
- `tokens.css`'e `:root[data-tema="koyu"]` bloğu eklendi: sıcak koyu kahve yüzeyler, metin ≥ 7:1, durum renkleri koyu zeminde ≥ 4.5:1.
- Bileşenlerde kalan son üç sabit renk (`rgba`) de token'a çevrildi.
- Blok yalnız ekranda geçerli; yazdırma ve PDF koyu temadan da açık basılıyor (testli).
- Varsayılan açık (PLAN §1 kararın). Menüdeki Açık/Koyu seçimi cihazda saklanıyor ve sayfa çizilmeden önce uygulanıyor, böylece açılışta beyaz yanıp sönme olmuyor.

**Sunum modu, brief'teki adresiyle `?clean=1`.** Salon ekranı için sade bir görünüm:
- menü, kişi listesi ve bildirim yok; ağ ekrana sığıyor ve tıklanmıyor,
- büyük saat ve panodaki özet sayılar (aynı fonksiyon),
- şekil ve "yeşil çizgi = şu an birlikte" anahtarı.

**İsimsiz** seçeneği (`&isimsiz=1`) adları hem ekrandan hem ekran okuyucu metninden kaldırıyor (testli). Seçim adreste durduğu için salon bilgisayarı yenilense de aynı görünüm geliyor. Araç çubuğu (İsimli/İsimsiz, tema, "Sunumdan çık") köşede soluk duruyor ve üzerine gelince beliriyor; seyirci görmüyor, görevli bulabiliyor. `AgGorunumu` iki ekranda kullanıldığı için `components/`'a taşındı (mimari kuralı). Ağ etiketlerine zemin renginde bir hale eklendi, üstünden geçen çizgiler adı bozmuyor; panoya da yaradı.

**Kalabalık: kart havuzu 97 kişiyle sınırlı.** "100+ kişi" hedefiyle ölçmeye başlayınca mock çöktü, çünkü kart numaraları 1–99 (brief §3: 100 ve üstü dinleyici cihaz). Aynı anda en çok 97 kartlı kişi olabiliyor. Mock artık bu sınırda kırpıp uyarı veriyor. Ölçüm donanımın izin verdiği en kalabalık halde yapıldı. Çelişki Muhittin'e soru olarak yazıldı (aşağıda).

**Ölçüm yöntemi:** üretim derlemesi, işlemci 4× yavaşlatılmış (ucuz tablet benzetimi), 15 sn, 97 kişi.

| Ekran | Önce | Sonra | Neden |
|---|---|---|---|
| Pano | %12 meşgul, 33 fps | %12, **55 fps** | Aynı anda 15'ten çok çift birlikteyken yeşil çizgilerin akış animasyonu duruyor. Akış her karede bütün SVG'yi yeniden boyatıyordu. Kesikli yeşil yine "birlikte" diyor. |
| Sunum | etiketler **7 px** (okunmuyor) | **19 px**, 57 fps | Kalabalık rol yan yana sütunlara bölünüyor (sütun başı 11 kişi). Sunumda akış yok, geçmiş çizgiler daha soluk, şu an birlikte olanlar öne çıkıyor. |
| Kurulum | %27, 34 fps, en uzun 530 ms | %13, 40 fps, en uzun 334 ms | 100'den çok çiftte çift tablosu 2 sn'de bir tazeleniyor. ~500 satırın saniyede iki kez değişmesi zaten okunamıyordu; ekranda not var. Kalibrasyon seçenekleri yalnız çift listesi değişince çiziliyor. |
| Masa | %1 | %1 | Değişiklik gerekmedi. |

Panodaki ağ tek sütun kaldı. Pano sayfası kaydırılabiliyor ve 97 kişide etiketler 13 px, okunuyor.

**Temiz mimari.**
- Yeni saf fonksiyonlar `api/` altında ve testli: `agGenislik` / `sutunBasi`, `seyrekDeger`, `sunumModuMu`.
- Hook'lar da `api/` altında: `useTema`, `useSeyrek`.
- Test yardımcıları `theme/tokenOku.js` ve `theme/renkOlcum.js`.
- Yeni bağımlılık yok.

## Brief kural kontrolü (§4.5, §10, §11, §12-5)

- [x] Büyük ekran / sunum modu `?clean=1`: sade, isimli ya da isimsiz ağ görünümü
- [x] Koyu tema + açık tema (açık varsayılan, PLAN §1); kişi paleti her iki yüzeyde doğrulanmış
- [x] Yeşil yalnız "birlikte" (her iki temada test); kimlik renk + şekil + ad
- [x] Sakin hareket: kalabalıkta akış durur, sunumda hiç akmaz; düğümler sabit
- [x] Çevrimdışı: yeni bağımlılık, uzak font ya da CDN yok
- [x] Seçimler cihazda saklanır (tema); sunum görünümü adreste
- [x] Kalabalık (97 kişi = kart havuzunun tamamı): okunaklılık ve akıcılık ölçüldü, iyileştirildi
- [x] Metre/cm yok; konum iması yok ("düğümlerin konumu fiziksel konum değildir" notu sunumda da var)

## Soru sormadan verdiğim kararlar ("sorgulamadan bitir, bitince haber ver" talimatıyla)

1. **Palet yeniden adımlandı:** açık temada "turuncu" koyu kiremit, "hardal" zeytin tonuna kaydı. Bedeli bu, kazancı renk körlüğünde ayırt edilebilirlik.
2. **Koyu tema yüzeyleri sıcak koyu kahve** (`#181614` / `#221f1b`); brief'in `#1a1a19` önerisine yakın, krem temanın sıcaklığıyla uyumlu.
3. **Varsayılan tema açık kaldı** (PLAN §1). Brief koyu varsayılan diyordu, ama bu senin önceki kararın.
4. **Sunum modu alt şeridi panodaki beş sayıyla aynı.** "Potansiyel anlaşma" da bu sayılardan biri. Salonda gösterilmesi istenmiyorsa tek satırla çıkarılabilir.
5. **Eşikler:**
   - aynı anda 15'ten çok çift birlikteyken akış durur,
   - sunumda sütun başı 11 kişi,
   - Kurulum'da 100'den çok çiftte tablo 2 sn'de bir tazelenir.

   Hepsi tek bir sabit, kolayca değişir.
6. **Mock `--kisi` 97'de kırpılıyor**, kart havuzu nedeniyle (brief §3).

## Yol boyunca yakalananlar

1. **Mock 120 kişide çöküyordu:** kart havuzu 97'yken olmayan kart numaraları atanıyordu. Düzeltildi.
2. **İlk çok sütunlu sunum 16 fps'e düştü:** büyüyen SVG'de 44 akan çizgi her kareyi yeniden boyatıyordu. Akış sunumda kaldırıldı.
3. **Seyrek tazelemenin ilk sürümü Kurulum'u açılışta çökertti:** veri gelmeden saklanan boş değer 2 sn geri döndü. Tarayıcı ölçümünde yakalandı, test eklendi.
4. **Kalabalık sunumda etiketler 7 px'e iniyordu.** Çok sütunlu yerleşimle 19 px oldu.
5. **İlk kontrast testi her iki temayı birleştiriyordu:** koyu değerler açığın üstüne yazılıyordu. Temalar ayrı ayrı okunacak şekilde yeniden yazıldı.

## Açık sorular / bilinen konular

1. **Muhittin'e Soru 6** (`SUNUCUDAN_ISTENENLER.md` §7): "100+ kişi" ile kart no 1–99 çelişiyor. Kart aralığı mı genişleyecek, yoksa kastedilen kayıtlı kişi sayısı mı?
2. **`/state` boyutu:** 97 kişide ~20 dakikada ~220 KB'a çıkıyor; çoğu `signals` + `history`. Pano bunları kullanmadan her 0,5 sn'de ayrıştırıyor. Bugün sorun değil; büyürse `history`'nin yalnız Kurulum açıkken gönderilmesi önerildi (§7).
3. **Kurulum'da ~500 çiftte 2 sn'de bir kısa takılma kalıyor** (4× yavaş işlemcide ~330 ms). Bu, etkinlik öncesi kullanılan teknik ekran olduğu için bırakıldı. Gerekirse sanal liste (yalnız görünen satırları çizmek) ayrı bir iş (PLAN §4).
4. **Önceki fazlardan bekleyenler değişmedi** (Muhittin'e §4–§5 soruları, atama geçmişi, bildirim akışında yinelenen anahtar).
