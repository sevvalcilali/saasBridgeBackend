# Faz 4 — Kişi Ayrıntı Paneli (Derin) + Etkinlik Sonrası Rapor · Teslim Notu

Tarih: 30.09.2026 · Dal: `faz-0-altyapi` (PR #1) · Test: **179/179 yeşil** · Tarayıcıda (Playwright) uçtan uca kabul senaryosu geçti · Faz 2 ve Faz 3 kabul senaryoları yeniden koşuldu, gerileme yok · Build: `dist/` 313 kB JS (gzip 95 kB).

**Kabul ölçütü:** Kabul senaryosu mock ile uçtan uca çalışıyor:
1. panoda kişi paneli: zaman çizelgesi, pil ve kısayollar,
2. "Kartı değiştir" ve "Kartı iade al" masayı doğru kişiyle açıyor,
3. iade edilen kişi raporda süresiyle "ayrıldı" görünüyor,
4. iki CSV indiriliyor,
5. yazdırma görünümü temiz ve A4 PDF üretiliyor,
6. telefon düzeninde taşma yok.

## Ekran görüntüleri ve örnek çıktılar

| Dosya | Ne gösteriyor |
|---|---|
| `01_kisi_paneli.png` | Pano + kişi paneli: pil, kısayollar, bugün kiminle, **görüşme zaman çizelgesi** (sürmekte olan yeşil ve açık uçlu) |
| `02_kisayol_kart_degistir.png` | "Kartı değiştir" → masa, kart değişimi 2. adımda aynı kişiyle |
| `03_kisayol_iade.png` | "Kartı iade al" → masa, aynı kişinin iade onayı |
| `04_rapor.png` | Rapor sayfası (tamamı) |
| `05_rapor_yazdirma.png` | Yazdırma görünümü (menü ve düğmeler gizli) |
| `06_rapor_telefon_600.png` | Rapor 600 px |
| `ornek_rapor.pdf` | Tarayıcının "PDF olarak kaydet" çıktısı (A4) |
| `ornek_katilimcilar.csv` · `ornek_gorusmeler.csv` | Dışa aktarılan CSV'ler (Excel'de doğrudan açılır) |

## Neyi neden böyle yaptım

**Rapor `/state`'ten değil görüşme kayıtlarından üretiliyor.** `/state` yalnız şu an kartı olan kişileri gösteriyor; oysa rapor kartını iade edip ayrılan kişileri de kapsamalı. Faz 2'de "süreler silinmez, raporda kalır" demiştik; bu söz ancak böyle gerçekten tutuluyor. Rapor iki kaynaktan geliyor:
- **kayıt defteri** (`/api/people`, ayrılanlar dahil),
- **görüşme kayıtları** (`/api/sessions`, kişi bazlı).

Kabul senaryosunda bir kişinin kartı iade edildi ve kişi raporda süresiyle "ayrıldı" olarak göründü.

**Görüşme kayıtları kişiye bağlı ve kenar süreleriyle birebir tutarlı.** Kayıt, çift "birlikte" olunca açılıyor, bitince ya da kart iade/değişiminde kapanıyor. Kayıtsız kartla yapılan görüşme, karta kişi atanınca o kişiye geçiyor. Mock görüşmenin başladığı tiki de kenar süresine sayıyordu; kayıtlar ilk yazıldığında bu yüzden bir tik eksik kalıyordu. Artık çift başına kayıt toplamı `/state` kenar süresiyle aynı ve bu bir testle kilitli.

**Zaman çizelgesi (brief §7):** Her görüşme ortak bir zaman ekseninde bir çubuk; yanında karşı kişi, saat aralığı ve süre yazıyor. Sürmekte olan görüşme açık uçlu ve yeşil (şu an birlikte); bitenler nötr. Sıra başlangıca göre sabit, yeni görüşme alta ekleniyor, satırlar zıplamıyor.

**Kısayollar masayı hazır açıyor:**
- **"Kartı değiştir":** masa, kart değişimi 2. adımda aynı kişiyle açılıyor; süreler Faz 2'deki gibi birleşiyor.
- **"Kartı iade al":** o kişinin iade onayı açılıyor.
- **Kayıtsız kart:** "Bu karta kişi ata".

Adres parametresi kullanılınca temizleniyor, böylece sayfa yenilenince işlem tekrar tetiklenmiyor.

**Rapor bir anlık görüntü.** Açılışta ve "Yenile" ile alınıyor, yazdırırken değişmiyor. Bölümler:
- Özet: görüşme, yatırımcı–girişimci toplam süre, yatırımcıya ulaşan girişimci x/y, potansiyel anlaşma, katılımcı ve ayrılan sayısı.
- Girişimci → ulaştığı yatırımcılar. Hiç ulaşamayan girişimci vurgulu, çünkü organizatörün etkinlik sonrası en çok bakacağı yer burası.
- En uzun 10 görüşme.
- Katılımcılar.
- Kim kimle ne kadar.

**Yazdırma / PDF:** Ayrı bir PDF kütüphanesi eklemedim (Kural 3: bağımlılık onaya tabi). Tarayıcının "PDF olarak kaydet"i için yazdırma stili yazdım:
- menü ve düğmeler gizleniyor,
- satırlar sayfa arasında bölünmüyor,
- kişi renk noktaları basılıyor,
- renkler yine token'lardan geliyor.

`ornek_rapor.pdf` bu yolla üretildi.

**CSV tarayıcıda üretiliyor.** Sunucunun `report.csv`'sini beklemeye gerek kalmadı. Faz 2'deki içe aktarmayla aynı Türkçe Excel kuralları geçerli: UTF-8 BOM, `;`, ondalıkta virgül (`25,7`), içinde `;` olan alan tırnaklı. Testler dosyayı geri okuyarak doğruluyor.

**Temiz mimari.** Rapor hesapları, saat dönüşümü ve CSV üretimi `api/` altında saf ve testli fonksiyonlarda (`rapor.js`, `csvDisa.js`). `ZamanCizelgesi` ortak bileşen olarak `components/`'ta. Kişi rengi dönüşümü `renkler.katilimciRengiUyarla` ile tek yerde, masa ve rapor aynı fonksiyonu kullanıyor. Faz 1 paneli yalnız genişletildi; mevcut bölümleri değişmedi.

## Brief kural kontrolü (§4.4, §7, §10)

- [x] Rapor: kim kimle toplam kaç dakika, hangi girişimci kaç yatırımcıya ulaştı, en uzun görüşmeler; yazdırılabilir / PDF'e uygun
- [x] Kişi ayrıntı paneli: bugün kiminle ne kadar, görüşme zaman çizelgesi, kart bilgisi (pil, son duyulma), "kartı değiştir / iade al" kısayolları
- [x] Ayrılan kişilerin süreleri raporda (Faz 2 sözü)
- [x] Tarih `30.09.2026 14:05`, süre `3 dk 20 sn`; metre/cm yok; yeşil yalnız "birlikte"
- [x] Telefon (600 px) düzeninde taşma yok

## Soru sormadan verdiğim kararlar ("sorgulamadan bitir" talimatıyla)

1. **`/api/sessions` biçimi:** `a/b` = kişi kimliği (kayıtsız kart `kart:N`), `start/end` = etkinlik saniyesi, sürmekte olanda `end: null`. `SUNUCUDAN_ISTENENLER.md` §6'ya yazıldı.
2. **Rapor tarayıcıda üretiliyor.** Sunucunun `report.csv`'si isteğe bağlı kaldı.
3. **PDF için tarayıcı yazdırması kullanılıyor,** PDF kütüphanesi yok.
4. **Katılımcı tablosunda yalnız kayıtlı kişiler var** (özetteki sayıyla aynı). Kayıtsız kartın görüşmeleri çift ve "en uzun" tablolarında görünüyor.
5. **Kişi paneli verisi 5 sn'de bir yenileniyor,** yalnız panel açıkken.
6. **Rapor anlık görüntü.** Canlı akmıyor, "Yenile" ile güncelleniyor.

## Yol boyunca yakalananlar

1. **Bir tiklik kayma (öngörüldü):** Mock başlangıç tikini kenar süresine de saydığı için kayıtlar bir tik kısa kalacaktı. Yazmadan önce fark edildi ve tutarlılık testiyle baştan doğru kuruldu.
2. **Kayıtsız kart katılımcı sayısını bozuyordu.** Özet "25" derken tablo başlığı "26" gösteriyordu.
3. **Zaman çizelgesinde uzun adlar kesiliyordu.** Artık panodaki kısa ad kullanılıyor, tam ad üzerine gelince görünüyor.
4. **Yazdırma stiline sabit renk kodu girmişti.** Token'a çevrildi.
5. **Test altyapısında aynı hatayı tekrarladım.** Süreç öldüren `pkill` deseni, onu içeren kabuk komutunu da eşleştirdi. Kod ya da teslim etkilenmedi; kural olarak süreç öldürme artık her zaman ayrı bir komutta yapılıyor.

## Açık sorular / bilinen konular

1. **Faz 5 (isteğe bağlı cilalar)** başlamadan sorulacak: sunum modu, koyu tema, 100+ kişi performansı. Kişi paleti bulgusu (PLAN §4) koyu temayla birlikte ele alınabilir.
2. **Etkinlik saatleri mock'ta sıkıştırılmış görünüyor:** hızlandırmada dakikalar saniyelere iniyor. Gerçek sunucuda saatler gerçek.
3. **Muhittin'e bekleyen sorular** (`SUNUCUDAN_ISTENENLER.md` §4 ve §5) değişmedi.
