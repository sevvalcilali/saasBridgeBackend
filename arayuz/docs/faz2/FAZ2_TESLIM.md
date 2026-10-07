# Faz 2 — Kart Atama Ekranı (Karşılama Masası) · Teslim Notu

Tarih: 30.09.2026 · Dal: `faz-0-altyapi` (PR #1) · Test: **136/136 yeşil** (birim + gerçek mock'a karşı HTTP) · Tarayıcıda (Playwright) uçtan uca kabul senaryosu geçti · Build: `dist/` 272 kB JS (gzip 83 kB).

**Kabul ölçütü:** Masa akışı mock ile uçtan uca oynanabiliyor. Ekran görüntüleri tek bir otomatik senaryodan alındı:
- panodan "Kişi ata",
- CSV ile yükleme,
- yaklaştır ve tanı,
- onay ve geri al,
- kart değişimi,
- kişi düzenleme,
- kayıp kart,
- iade ve stok.

`SUNUCUDAN_ISTENENLER.md` Muhittin için hazır.

## Ekran görüntüleri

| Dosya | Ne gösteriyor |
|---|---|
| `01_pano_atanmamis_kart.png` | Pano: kayıtsız "Kart 14" ağda ve listede, satırda "Kişi ata" (masaya köprü) |
| `02_csv_yukleme.png` | CSV toplu yükleme: 4 kişi eklendi, hatalı 6. satır nedeniyle birlikte |
| `03_kart_bekliyor.png` | "Kart bekliyor" listesi: CSV'den gelen, henüz kartı olmayanlar |
| `04_onay.png` | Panodan gelinen Kart 14: kişi seçilince doğrudan kontrol + onay |
| `05_yaklastir_ve_tani.png` | "Kart 85 bulundu ✓" (yaklaştır ve tanı) |
| `06_verildi_geri_al.png` | Onay sonrası ekran sıfırlandı; son atama şeridinde "Geri al" |
| `07_kart_degisimi.png` | Kart değişimi: "Kart 14 bırakılır, Kart 3 verilir; süreler birleşir" |
| `08_kisi_duzenle.png` | Kişi düzenleme: renk gösterilir ama değiştirilemez |
| `09_kayip_kart.png` | "⚠ Kartı kontrol et" şeridi + kişinin satırında etiket |
| `10_kart_kontrol.png` | "Pil değiştirildi" / "Kart değiştirildi" seçimi |
| `11_iade_onay.png` | Kart iadesi onayı: "süreler silinmez, raporda kalır" |
| `12_bostaki_kartlar.png` | İade edilen kart "Boştaki kartlar" şeridine döndü |
| `13_tablet_900.png` · `14_telefon_600.png` | Tablet ve telefon düzeni |

## Neyi neden böyle yaptım

**Kişi ≠ kart.** Kişi kalıcı bir kayıt, kart ise bir cihaz. Süreler ve "kim kimle ne kadar" bilgisi kişiye yazılıyor. Bunun üç sonucu var:
- Kart değişince süreler kişide birleşiyor.
- İade edilen kart başkasına verilince eski sahibin süreleri yeni kişiye geçmiyor.
- Ayrılan kişinin süreleri silinmiyor.

Pano sözleşmesi (`/state`) değişmedi, Faz 1 panosu hiç dokunulmadan çalışıyor.

**Tek I/O noktası.** Masa ekranları sunucuyla yalnız `api/masaApi.js` üzerinden konuşuyor. Gerçek sunucu gelince değişecek tek şey adres. Tüm karar ve dönüşüm mantığı `api/` altında saf ve testli fonksiyonlarda; JSX içinde hesap yok. Bu fonksiyonlar şunlar:
- kart bekliyor / ayrıldı / kayıp ayrımı,
- boştaki kartlar,
- geri alma penceresi,
- düzenleme farkı,
- CSV okuma,
- yönlendirme.

**Hız: hedef kişi başına 15 sn'nin altı.** Akış üç adımdan oluşuyor: Kişi → Kart → Onay. Onaydan sonra ekran hemen sıradaki kişiye dönüyor. "Yaklaştır ve tanı" önerilen yol: kart alıcıya yaklaştırılınca numara yazmadan bulunuyor. Panodan "Kişi ata" ile gelindiğinde kart zaten belli olduğu için kişi seçilince doğrudan onaya geçiliyor.

**Dokunmatik ve ayakta kullanım.** Hedefler büyük (en az 44–56 px), yazı az. Her tehlikeli işlem ekranda onay istiyor:
- kart iadesi,
- başkasının kartını devralma ("Bu kart Ali Kaya'da. Geri alındı mı?").

`window.confirm` kullanmadım; bunun yerine ekran içi onay var.

**Hatalar affediliyor.** "Geri al" brief'teki "son birkaç dakika" için 5 dakika açık kalıyor. Yanlış atamayı geri almak kişiyi "ayrıldı" yapmıyor; kişi yeniden "kart bekliyor" oluyor.

**Kayıp kart masa ekranında.** Masa SSE dinlemiyor. `lost` bildirimiyle aynı ölçütü (atanmış kart 60 sn'dir duyulmuyor) `/api/cards`'tan kendisi türetiyor. "Pil değiştirildi" seçilince uyarı "sinyal bekleniyor"a dönüyor ve kart yeniden duyulunca kendiliğinden kalkıyor. "Kart değiştirildi" seçilince sihirbaz o kişiyle açılıyor.

**Türkçe Excel.** CSV dosyası önce UTF-8, olmazsa Windows-1254 olarak okunuyor; aksi halde ş/ğ/İ bozuluyordu. Ayraç olarak `;` de kabul ediliyor. Hatalı satırlar satır numarası ve nedeniyle gösteriliyor.

**Renk ve durum.** Masada da kişi rengi panodakiyle aynı açık palette; yeşil yalnız "birlikte" demek. Durumlar renk + ikon + yazı üçlüsüyle veriliyor: ⚠ kayıp, "kart bekliyor", "ayrıldı".

## Brief kural kontrolü (§6, §7, §10)

- [x] §6.2 akış: kişi seç / yeni kişi, yaklaştır ve tanı (çift kart uyarısı dahil), numarayla seç, kontrol (açık / son duyulma / pil / zaten atanmış), onay kartı kişinin rengiyle
- [x] §6.3 iade (ayrıldı, süreler silinmez) · kart değişimi (süreler birleşir) · geri al · kişi düzenleme (renk sabit) · kayıp kart (pil/kart) · CSV ön yükleme + "kart bekliyor"
- [x] §6.4 büyük hedefler, az yazı · kişi rengi atama anında belirir ve değişmez · boştaki kartlar şeridi
- [x] Metre/cm yok: 2.7'deki "5–10 cm" metni düzeltildi, bunu artık bir test koruyor · yeşil yalnız "birlikte" · kimlik renk + ad birlikte veriliyor
- [x] Tamamen çevrimdışı · tüm metinler Türkçe · süre `3 dk 20 sn`, "1 dk önce"
- [x] Tablet (900 px) ve telefon (600 px) düzeni

## Yol boyunca bulunan ve düzeltilen hatalar

1. **Mock çöküyordu (2.10).** O an "birlikte" olan bir kişinin kartı iade edilince mock sunucu çöküyordu. Görüşme ~15 sn geç bittiği için bu durum masada çok sık oluşur. Düzeltildi ve test eklendi; gerçek sunucu için de not düşüldü.
2. **Kenar süreleri yanlış kişiye yazılabiliyordu (2.11).** Kenarlar kart numarasıyla tutuluyordu; iade edilen kart başkasına verilince eski süreler yeni kişiye geçiyordu. Kenarlar artık kişiye bağlı.
3. **Masada renk sorunu vardı.** Masa ekranları kişi rengini dönüştürmüyordu: yeşil görünebiliyordu ve renk panodakinden farklıydı. Artık `masaApi` dönüştürüyor.
4. **"5–10 cm" metni pazarlıksız kuralı ihlal ediyordu (2.7).** Kaldırıldı ve bir koruma testi eklendi.
5. **Panodaki "Kişi ata" ölüydü.** Faz 1'de boş bırakılmıştı; artık masaya bağlı.

## Onayınla verilen kararlar

- Kenarlar kişi bazlı (2.11).
- `ayrildi` alanı ve `unassign`'daki `ayrildi` bayrağı (2.12).

## Soru sormadan verdiğim kararlar ("Faz 2'yi bitir" talimatıyla)

1. **"Kartı kontrol et" etiketi masa ekranında.** Panoda kişi zaten "görünmüyor" durumuyla ve `lost` bildirimiyle görünüyor.
2. **Boştaki kartlar yalnız gösteriliyor.** Bir karta tıklayıp doğrudan atama yok; kart, sihirbazın 2. adımında zaten öneriliyor.
3. **Mock'a 6 masa yedeği eklendi,** iade edilen kart da masaya dönüyor. Yedekler `/state`'te görünmüyor (bkz. `SUNUCUDAN_ISTENENLER.md` soru 1).
4. **Geri al penceresi 5 dk** (`GERI_AL_DK`, tek satırda değişir).
5. **Excel (.xlsx) desteği yok.** Bağımlılık gerektiriyor; Excel'de "Farklı kaydet → CSV" yeterli.

## Açık sorular / bilinen konular

1. **Sunucu tarafı** (Muhittin): masadaki yedeklerin panoda hayalet "Kart N" olarak görünmesi, atama geçmişi. Ayrıntılar `SUNUCUDAN_ISTENENLER.md` §4'te.
2. **Kart değişiminden sonra "Geri al"** yeni kartı boşa çıkarıyor, eski kartı geri vermiyor; kişi kartsız kalıyor ve ekran bunu söylüyor.
3. **Faz 1'den kalanlar:**
   - Pano satırının içinde "Kişi ata" düğmesi var ve satır da `role="button"`. İç içe etkileşimli öğe olduğu için ekran okuyucuda satırın adı "Kişi ata"yı da içeriyor.
   - Bildirim akışında yinelenen React anahtarı uyarısı var: aynı tikte iki anlaşma aynı zaman damgasını alıyor.
4. **Masa "Geri al"ı hatırlamıyor.** Sayfa yenilenirse son atama unutuluyor; sunucuda atama geçmişi gelince çözülür.
