# Yakınlık Takip Sistemi — Arayüz Projesi Planı

> Kaynak gereksinim belgesi: `UI_TASARIM_BRIEF.md`
> Bu dosya projenin yol haritası ve çalışma sözleşmesidir.
> Plan tarihi: 28.09.2026 · Proje sahibi: Şevval (arayüz) · Backend: Muhittin (pano.py)

---

## ⏩ DEVİR NOTU — BURADAN BAŞLA (güncelleme: 30.09.2026)

> Bu bölüm projeyi devralan kişi (ya da Claude oturumu) için. Önce bunu, sonra **Bölüm 0 (çalışma
> kuralları)** ve `UI_TASARIM_BRIEF.md`'yi oku. Ayrıntı gerekirse ilgili fazın başlığına ve `docs/`'a in.

### Tek cümlede durum
Brief §12'deki **beş önceliğin hepsi bitti** (Faz 0–5) ve üstüne bir **uçtan uca tarama + düzeltme turu** ile
bir **kod incelemesi turu** yapıldı (sırasıyla `docs/duzeltme-turu/NOT.md` ve aşağıda "Kod incelemesi turu"). Brief'teki açık maddeler de (C turu, 02.10.2026) kapandı ve arayüz **telefon / tablet / bilgisayarda** çalışacak
şekilde elden geçti (Duyarlı tasarım turu): arayüz tarafında **bilinen eksik yok**. Arayüz **mock
sunucuyla uçtan uca çalışıyor**. Gerçek sunucuya (Muhittin'in `pano.py`'si) henüz bağlanmadı; **sıradaki iş gerçek
sunucuya geçiş** — Muhittin'in cevapları ve `/api/*` uçları gerekiyor (aşağıda 2. madde).

- **Dal:** `faz-0-altyapi` · **PR:** https://github.com/sevvalcilali/SaasBridge/pull/1 (açık, `main`'e birleşmedi)
- **Son commit:** bkz. `git log -1` (02.10.2026: kod incelemesi turu R1–R5) · **Testler:** `npm test` → 210/210 yeşil · **Build:** temiz

### Nasıl çalıştırılır (5 dakika)
Gereken tek şey Node 22 (ya da 20+). İnternet gerekmez: CDN yok, font indirilmez.

```bash
npm install
npm run dev          # mock sunucu (8002) + Vite birlikte → http://localhost:5173
KISI=97 npm run dev  # kalabalık deneme (kart no 1–99 olduğu için en çok 97 kişi)
npm test             # birim + mock testleri (node --test, ek bağımlılık yok)
npm run build        # → dist/  (gerçek sunucu bu klasörü statik verir)
```

Ekranlar (adres çubuğu):

| Adres | Ekran |
|---|---|
| `/#/` | Organizatör panosu |
| `/#/kart-ver` | Karşılama masası |
| `/#/kurulum` | Eşik / kalibrasyon / kart sağlığı |
| `/#/rapor` | Etkinlik sonrası rapor |
| `/?clean=1` | Salon ekranı (sunum modu); `&isimsiz=1` adsız |

Tema: sağ üstte Açık/Koyu.

Mock seçenekleri:

```
node mock-server/mock.js --port=8002 --kisi=25 --hizlandir=10 --kopma=1 --tohum=42
```

`--hizlandir` zamanı hızlandırır. `--kopma=1` alıcı kopmasını taklit eder.

**Gerçek sunucuya bağlanma:** `pano.py`'yi 8002'de çalıştır, **yalnız** `npx vite` başlat (`npm run dev` değil: o mock'u
da 8002'de açar ve çakışır). Vite'ın proxy'si zaten 8002'ye gider (`vite.config.js`). Üretimde `npm run build` çıktısı
`dist/`, `pano.py` tarafından aynı adresten verilir. Adres değişecekse **tek yer** `src/api/client.js` →
`SUNUCU_ADRESI`.

### Ne bitti — nerede anlatılıyor

| Faz | Ne | Teslim notu / görüntüler |
|---|---|---|
| 0 | Altyapı, token'lar, gerçek SSE mock, `api/client.js` | aşağıda Faz 0 |
| 1 | Canlı pano: kişi listesi, ağ, bildirimler, ayrıntı paneli | `docs/faz1/`, kökteki `adim_1_*.png` |
| 2 | Karşılama masası: kart ver / değiştir / iade / geri al, CSV, kayıp kart | `docs/faz2/` |
| 3 | Kurulum: eşik, canlı grafik, çift tablosu, kalibrasyon, kart sağlığı | `docs/faz3/FAZ3_TESLIM.md` |
| 4 | Derin kişi paneli (zaman çizelgesi) + rapor (yazdır/PDF, 2 CSV) | `docs/faz4/FAZ4_TESLIM.md` |
| 5 | Doğrulanmış palet, koyu tema, sunum modu, 97 kişi performansı | `docs/faz5/FAZ5_TESLIM.md` |
| Tarama | 3 kod incelemesi + tarayıcı taraması → 20 düzeltme | `docs/duzeltme-turu/NOT.md` |
| İnceleme | Uçtan uca kod incelemesi → 10 bulgu, R1–R4 düzeltmeleri (ölçümlü) | PLAN "Kod incelemesi turu" |
| C turu | Brief §7 eksikleri: karşı rol sayısı, sıralama + filtreler, bildirim süzgeci/"tümünü göster", alıcı kopunca soluk | PLAN "C turu" |
| Duyarlı | Telefon / tablet / bilgisayar: menü, dokunma hedefleri, kaydırmalı çipler, tam ekran panel, kaydırmalı rapor tabloları | `docs/duyarli/NOT.md` |

Sunucudan istenen her şey (uç listesi, veri biçimleri, Muhittin'e sorular): **`SUNUCUDAN_ISTENENLER.md`**.
Gerçek sunucu **ayrı repoda** yazılıyor: https://github.com/sevvalcilali/saasBridgeBackend (tek plan belgesi `PLAN.md`:
kurallar, mimari, veri modeli, sözleşme, kalıcılık, test, Faz B sırası, riskler; açık işler §16.2). Bu repoda sunucu kodu **yok**.

### Nerede kaldık / sıradaki işler (öncelik sırasıyla)

**1. ~~Karar bekleyen brief eksikleri (C)~~ — bitti (02.10.2026).** Dört madde de uygulandı; verilen kararlar
"C turu" başlığında. Kalan tek açık nokta sunucuya ait: "yalnız kaldı" süresi için `people[].idleSinceS`
(`SUNUCUDAN_ISTENENLER.md` §9). Gelirse satıra "boşta · 4 dk'dır" eklenir (`api/durum.durumCumlesi`).

**2. Gerçek sunucu — ayrı repoda yazılıyor (karar 03.10.2026).** https://github.com/sevvalcilali/saasBridgeBackend —
Python 3.11 + FastAPI; donanım yok, benzetim kaynağıyla; fazlar B0–B8 ve kabul ölçütleri orada. Bu repoya düşen tek iş
B2.6: `mock-server/*.test.js`'e `SUNUCU=` değişkeni (sözleşme testleri gerçek sunucuya karşı) — **ayrı onayla**.
Muhittin'e sorular hâlâ geçerli (aşağıda).
- `pano.py` bugün yalnız `/`, `/state`, `/events`, `/control` sunuyor. Masa, rapor, kart sağlığı ve kişi panelinin ek
  verisi için `/api/people`, `/api/assign`, `/api/unassign`, `/api/people/import`, `/api/cards`, `/api/sessions`
  gerekiyor. Biçimleri `SUNUCUDAN_ISTENENLER.md` §1–3, §6 ve §8'de.
- Bu uçlar yokken ekranlar çökmüyor. Masa "sunucuya bağlanılamıyor" der, rapor "veri alınamadı" der, pano her
  durumda çalışır.
- `GET /api/demo`, `/api/yaklastir` ve `/api/demo/tut` **yalnız mock'a ait**. Gerçek sunucuda olmamalı; arayüz demo
  düğmelerini ancak `/api/demo` varsa gösterir.
- Muhittin'e bekleyen sorular: `SUNUCUDAN_ISTENENLER.md` §4 (Soru 1–4), §5 (Soru 5), §7 (Soru 6: "100+ kişi" ile
  kart no 1–99 çelişkisi).
- Geçişte kontrol edilecekler:
  - `/events` alıcı yokken de ~2 Hz yayın yapmalı. Yapmazsa 6 sn sessizlikte "sunucuya bağlanılamıyor" görünür.
  - `/control` başarıda 2xx dönmeli.
  - `pano.py` `.js` dosyalarını JavaScript MIME türüyle vermeli. Windows'ta Python bazen `text/plain` verir ve
    sayfa açılmaz.
  - Masadaki yedek kartlar panoda "Kart N" hayaleti olmamalı (Soru 1).
  - Bildirimlerdeki `people` kart no taşıyor. Kart değişiminden sonra eski bildirim yanlış kişiyi vurgulayabilir;
    sunucu `kisiId` de gönderebilir mi, sorulmalı.

**3. Bilinen küçük konular.** Bölüm 4'te ayrıntılı; hiçbiri engelleyici değil.
- **Kart değişiminde "Geri al":** Eski kartı geri vermiyor, kişi kartsız kalıyor. Ekranda bu söyleniyor.
- **Kurulum'da ~500 çift:** 4× yavaşlatılmış işlemcide 2 sn'de bir ~330 ms takılma var.
- **Atama geçmişi sunucuda yok:** "Geri al" masanın kendi hafızasında; sayfa yenilenince kaybolur.

### Çalışma yöntemi (her iş için)
1. Bölüm 0'daki kurallar geçerli. En önemlileri:
   - **onaysız faz / kapsam dışı iş yok**,
   - `api/` dışında ağ çağrısı yok,
   - bileşende sabit renk yok (yalnız `theme/tokens.css` token'ları),
   - yeşil yalnız "şu an birlikte" anlamında,
   - metre/cm yok,
   - yeni bağımlılık onaya tabi.
2. **Mantık `src/api/` altında saf fonksiyonda, yanında `*.test.js`.** Ekran (`screens/`) yalnız gösterir. Mock
   davranışı `mock-server/*.test.js`'te (her dosya kendi portunda bir mock başlatır).
3. **Her değişiklik şu sırayla doğrulanır:**
   - `npm test` tamamen yeşil,
   - `npm run build` temiz,
   - tarayıcıda gerçekten denenir (mock ile) — **telefon (390), tablet (768) ve bilgisayar (1280) genişliklerinde**.
     Tarayıcı kabul betikleri (Playwright) **repoda değil**; kabul ölçütleri her fazın başlığında ve
     `docs/faz*/…TESLIM.md`'de yazılı. Kabul betikleri mock'u **taze** başlatıp hemen koşmalı: mock'un zamanlı
     senaryoları (Kart 14 → 45. sn, kayıp kart → 180–300. sn, alıcı kopması → 120. sn) kaçırılırsa beklemeler düşer.
4. **Commit ve not:** Her adım kendi commit'i. Bu dosyada ilgili adım ✅ yapılır ve kısa bir "Yapıldı:" notu düşülür.
   Faz sonunda `docs/fazN/` altına ekran görüntüsü ve "neyi neden" notu eklenir.
5. **Süreç kapatırken:** `pkill -f` desenini içeren metin, aynı komutta başka yerde geçmemeli. Yoksa komut kendi
   kabuğunu öldürür; bu projede birkaç kez oldu.

---

## 0. ÇALIŞMA KURALLARI (Claude için — pazarlıksız)

### Onay kuralları
1. **Onaysız hiçbir faza başlanmaz.** Her faz, Şevval açıkça "başla" demeden
   başlamaz; faz bitince sonuç gösterilir ve bir sonraki faz için yeniden onay alınır.
2. **Faz kapsamı dışına çıkılmaz.** Faz sırasında akla gelen "hazır buradayken
   şunu da yapayım" işleri yapılmaz; PLAN'a not düşülür, onayla sıraya girer.
3. **Yıkıcı/geri alınamaz işlemler her zaman ayrıca sorulur:** dosya silme,
   veri sıfırlama, git geçmişi değiştirme, bağımlılık ekleme/çıkarma,
   plan/mimari değişikliği.
4. **Belirsizlikte uydurma yok.** Brief'te cevabı olmayan her karar önce
   Şevval'e sorulur; brief'in "Kavramlar" bölümünde olmayan kavram icat edilmez.
5. Her faz sonunda teslim: **ekran görüntüsü + kısa "neyi neden böyle yaptım"
   notu** (brief §12'nin istediği format).

### Mimari kuralları — "arka planda iş ne kadar karışık olursa olsun, kod tertemiz"
1. **Katman ayrımı kesin:**
   - `api/` → sunucuyla konuşan TEK yer. Ekran bileşenleri asla fetch/SSE yapmaz.
   - `screens/` → ekranlar; sadece görüntüler ve kullanıcı olayını iletir.
   - `components/` → ekranlar arası ortak, tek işli, bağımsız test edilebilir parçalar.
   - `theme/` → tüm renk/boşluk/yazı değerleri CSS token'ı. Bileşen içinde
     sabit renk kodu (hex) yazmak yasak.
2. **Tek sorumluluk:** Bir dosya bir iş yapar. Bir dosya büyümeye başladıysa
   bu, ikiye bölünme sinyalidir. "Ne yapar / nasıl kullanılır / neye bağımlı"
   sorularına tek cümleyle cevap veremeyen birim yeniden tasarlanır.
3. **Veri dönüşümü tek yerde:** Birim çevirileri (dk/sn → "3 dk 20 sn",
   "az önce"), sıralama, filtreleme gibi mantık `api/` ve yardımcı
   modüllerde yaşar; JSX içinde hesap yapılmaz.
4. **YAGNI:** İhtiyaç doğmadan soyutlama, ayar, seçenek eklenmez.
   Bağımlılık eklemek istisnadır, varsayılan değil (her yeni paket onaya tabi).
5. **Mock ↔ gerçek geçişi tek noktadan:** Gerçek sunucu geldiğinde değişecek
   tek şey `api/client.js` içindeki adres olmalı. Bu bozulursa mimari hatalıdır.
6. **İsimlendirme tutarlı:** Arayüz metinleri ve alan adları Türkçe kavram
   sözlüğüne (brief §3) uyar; kod tanımlayıcıları tek dilde ve tutarlı.

### Brief'in pazarlıksız ürün kuralları (her fazda geçerli)
- **Metre/cm asla gösterilmez**, sinyal metreye çevrilmez.
- **Konum/harita/ısı haritası yok** — düğüm konumu fiziksel konum değildir, bu belli edilir.
- **Ses/konuşma iması yok** — "konuşma" değil "birlikte".
- **Yeşil = yalnızca "şu an birlikte".** Başka anlamda yeşil kullanılmaz.
- **Kimlik asla sadece renkle verilmez:** renk + ad + rol şekli birlikte.
- Kişi rengi kişiyi takip eder, asla sıraya göre değişmez.
- Durumlar renk + ikon + yazı üçlüsüyle verilir (renk körlüğü).
- **Sakin hareket:** liste zıplamaz, kartlar titremez; görüşmelerin ~5 sn geç
  başlayıp ~15 sn geç bitmesi normaldir, hata gibi gösterilmez.
- **Tamamen çevrimdışı çalışır:** CDN, uzak font, harici servis yasak.
- Tüm metinler Türkçe; tarih `28.09.2026`, saat `14:05`, süre `3 dk 20 sn`.
- Kart no 100+ dinleyici cihazdır, kişi listelerinde gösterilmez.
- Süre birimlerine dikkat: `live/min/invMin/edges.min` **dakika**;
  `seenAgo/receiverAge/elapsed` **saniye**.

### Kullanılacak skill'ler (faz bazında)

| Skill | Ne zaman / nasıl |
|---|---|
| `/frontend-design` | Faz 1 ve 2'de ekran tasarımına başlarken — görsel yön ve tipografi rehberi |
| `/theme-factory` | Faz 0'da `tokens.css` kurulurken — "sıcak ve samimi" krem/pastel temanın token setini üretmek için (koyu lacivert değil; Bölüm 1'deki tema kararı geçerli) |
| `/vercel-composition-patterns` | Faz 1'de ortak bileşenler (liste satırı, panel, rozet) kurulurken — bileşen yapısı desenleri |
| `/vercel-react-best-practices` | Her fazın kod bitiminde — React kodu gözden geçirme (temiz mimari kuralının denetimi) |
| `/better-icons` | Faz 1'de bildirim/durum/rol ikonları seçilirken — SVG'ler projeye yerel gömülür (çevrimdışı kuralı) |
| `/a11y-audit` | Her fazın teslim öncesinde — erişilebilirlik denetimi (renk körlüğü, kontrast; brief §10 kuralları) |
| `/webapp-testing` | Faz kabul ölçütlerini doğrularken — mock senaryo üzerinde uçtan uca test |
| `/gsap-web` | Yalnız gerekçesi çıkarsa (ör. Faz 5 sunum modunda ağ görünümü geçişleri) ve **sakin hareket kuralı bozulmadan**; yeni bağımlılık olduğu için kullanım öncesi ayrıca onay alınır |

---

## 1. VERİLMİŞ KARARLAR

| Konu | Karar | Not |
|---|---|---|
| Backend erişimi | Şu an yok, beklenmeden başlanacak | Gerçek proje gelince `api/client.js`'ten bağlanılır |
| Teknoloji | **Vite + React** | Çıktı: tek `dist/` klasörü, sunucu statik verir |
| Tema | **Açık, sıcak-samimi** (krem zemin, pastel vurgular, yuvarlak hatlar) | Brief'in koyu varsayılanı bilinçli olarak değiştirildi (Şevval kararı). Token'lar sayesinde koyu tema ileride ucuza eklenebilir |
| Kişi paleti | Brief paleti açık zemine uyarlanır; **`#199e70` paletten çıkarılır** | Gerekçe: yeşil yalnızca "birlikte" durumunun rengi (brief §10 kendi önerisi) |
| Mock mimarisi | **Gerçek SSE mock sunucusu** (tek dosya Node) | pano.py ile birebir aynı sözleşme; EventSource/kopma davranışı gerçekçi test edilir |
| İlk hedef | **Organizatör panosu** | Brief §12 öncelik sırası korunuyor |
| Gerçek sunucu (03.10.2026) | **Ayrı repo** `saasBridgeBackend`, Python 3.11 + FastAPI + pyserial, SQLite; donanım yokken benzetim kaynağı | Bu repo yalnız arayüz + mock + sözleşme belgesi; sunucu planı ve kodu orada |

---

## 2. FAZLAR

Durum işaretleri: ⬜ onay bekliyor · 🟡 devam ediyor · ✅ bitti ve onaylandı

### ✅ Faz 0 — Temel altyapı
**Tamamlandı 28.09.2026.** Git + Vite/React, tokens.css, mock sunucu, api/client.js,
api/format.js, api/renkler.js. 36/36 test yeşil; tarayıcı kabul testi geçti.

---

> **Faz-sonu yeniden planlama kuralı:** Her faz tamamlandığında bir sonraki
> faz mikro-adımlarıyla birlikte yeniden planlanır. Bu planda Faz 1 mikro
> düzeyde, diğer fazlar kaba düzeyde tanımlıdır. Faz 1 bitince Faz 2
> mikro-adımları yazılır, vb.

---

### ✅ Faz 1 — Organizatör canlı panosu (TAMAMLANDI 29.09.2026)
**Amaç:** Brief'in 1 numaralı önceliği; gerçek API ile de hemen çalışır.
**Yöntem:** Her adım kendi commit'ini alır; test veya ekran görüntüsüyle doğrulanır.

#### 1.1 ✅ Sayfa düzeni iskeleti
- Yönlendirme yok (tek sayfa); `App.jsx` → `<PanoEkrani>` bileşeni.
- CSS Grid ile 3 bölgeli düzen: üst şerit, gövde (sol kişi + orta ağ + sağ bildirim),
  alt şerit. Tablet için 1 sütuna düşen breakpoint (≤900px).
- **Doğrulama:** Tarayıcıda boş iskelet görünür; geniş ve dar pencerede düzen değişir.

#### 1.2 ✅ Üst şerit
- Etkinlik adı, alt başlık, tarih/mekân (`durum.event.*`).
- Büyük saat (`durum.clock`; tabular-nums ile titremesin).
- **ALICI BAĞLI / BAĞLI DEĞİL** rozeti (`receiverAge > 5 → ciddi`).
- Eşik değeri göstergesi (`durum.threshold` dBm; tıklayınca Faz 3'e gidecek,
  şimdilik sadece göster).
- Sıfırla düğmesi: tıklayınca `window.confirm` ile onay → `baglanti.sifirla()`.
- **Doğrulama:** Bant, saat ve rozet canlı veriyle görünür; mock'ta `--kopma=1` ile
  "BAĞLI DEĞİL" rozeti belirir.

#### 1.3 ✅ Kişi listesi — temel satır
- `KisiSatiri` bileşeni: renk dairesi, rol şekli (brief §6.4: ○ yatırımcı, □ girişimci,
  ◇ misafir), ad (girişimcide kurum + ad), yıldız, durum cümlesi, toplam süre.
- Liste `people` dizisini rol gruplarıyla gösterir (Yatırımcılar / Girişimciler başlığı).
- **Doğrulama:** 25 kişilik senaryoda tüm satırlar doğru biçimde render.

#### 1.4 ✅ Kişi listesi — durum renkleri ve "birlikte" vurgusu
- `talking` → `birlikte-zemin` + `birlikte` kenarlık + "X ile · 3 dk 20 sn".
- `idle` → normal zemin + "boşta".
- `away` → `pasif-zemin` + "görünmüyor · 2 dk önce".
- Atanmamış kart (`/^Kart \d+$/`) için öne çıkan "Kişi ata" düğmesi (henüz
  tıklama işlevi yok — Faz 2'ye köprü).
- **Doğrulama:** Ekran görüntüsünde üç durum rengi birbirinden ayrılır; atanmamış
  kart sarı/turuncu vurguyla belirgin.

#### 1.5 ✅ Kişi listesi — arama ve filtre
- Arama kutusu: ad/kurum/kart no üzerinde `includes` (büyük-küçük harf duyarsız).
- Filtre düğme grubu: Tümü | Yatırımcı | Girişimci | Birlikte | Boşta |
  Görünmüyor | Hiç görüşmemiş (invPeers === 0 ve rol founder).
- Seçili filtre `localStorage`'da saklanır; sayfa yenilenince korunur.
- **Doğrulama:** "Hiç görüşmemiş" filtresi yalnız invPeers=0 girişimcileri gösterir;
  sayfa yenilenince filtre korunur.

#### 1.6 ✅ Kişi listesi — sakin sıralama
- Liste sırası saniyede 2 güncellemeyle DEĞİŞMEZ; yalnız `status` değişince
  (talking↔idle↔away) satır konumu güncellenir — CSS `transition` ile.
- **Doğrulama:** Mock çalışırken liste sürekli zıplamaz; durum değişen satır
  yumuşak geçişle yer değiştirir.

#### 1.7 ✅ Bildirim akışı paneli
- En yeni üstte; `kind`'a göre ikon (SVG, `/better-icons`):
  `deal` → altın yıldız, `repeat` → yineleme, `idle_investor` → saat,
  `lost` → sinyal kesik, `no_investor` → uyarı üçgeni.
- Bildirim `severity`'sine göre sol kenarlık rengi (olumlu / uyarı / ciddi).
- Tıklayınca `vurgulananKisiler` state'ini ayarlar (bir sonraki adımda
  kişi listesinde ve ağda vurgu efekti).
- Son 20 bildirim; daha fazlası için "tümünü göster" kaydırma.
- **Doğrulama:** Mock hızlandırılmış modda (--hizlandir=60) anlaşma ve kayıp kart
  bildirimleri görünür; ikon ve renk kurallarına uygun.

#### 1.8 ✅ Bildirim → kişi vurgulama bağlantısı
- Bildirime tıklayınca `vurgulananKisiler` set edilir; kişi satırları ve ağ
  düğümleri parıldama efekti alır (box-shadow pulse, 3 sn sonra söner).
- **Doğrulama:** Bir bildirime tıklanınca ilgili kişi satırı/satırları vurgulanır.

#### 1.9 ✅ Alt şerit — özet sayılar ve ilerleme
- `stats` alanları kutu sırasıyla: şu an birlikte | biten görüşme |
  karma görüşme (sureYazisi) | potansiyel anlaşma | ulaşan/toplam girişimci.
- Etkinlik ilerleme çubuğu (`event.progress`; null ise gizli).
- **Doğrulama:** Sayılar canlı değişir; ilerleme çubuğu mock'ta 3 saat
  etkinlikle yavaş ilerler.

#### 1.10 ✅ Hata bantları
- "Sunucuya bağlanılamıyor" bantı: `baglandi === false` ise sayfanın üstünde
  ciddi renkli bant + son veri soluk opacity. Bağlantı gelince kalkar.
- "ALICI BAĞLI DEĞİL" bantı: `receiverAge > 5` ise ayrı ciddi bant.
- İkisi birden olabilir (üst üste).
- **Doğrulama:** Mock kapatılınca bant belirir, tekrar açılınca kalkar; veri silinmez.

#### 1.11 ✅ Ağ görünümü — düğümler
- `AgGorunumu` bileşeni: SVG, sabit deterministik yerleşim.
  - Yatırımcılar sol sütun, girişimciler sağ sütun, misafirler alt sıra
    (sıra `people` dizisindeki sıra ile aynı — zıplama yok).
  - Düğüm = kişinin rengiyle dolu rol şekli (daire/kare/baklava) + ad etiketi.
- "Bu düğümlerin konumu fiziksel konum değildir" yazısı SVG altında.
- **Doğrulama:** 25 kişilik senaryoda düğümler okunaklı dağılır; konum uyarısı görünür.

#### 1.12 ✅ Ağ görünümü — çizgiler
- `edges` dizisinden çizgiler: kalınlık = `Math.min(1 + min * 0.4, 8)`.
- `live` dizisindeki çiftler yeşil ve `stroke-dasharray` animasyonlu
  (yavaş, sakin — brief "sakin hareket" kuralı).
- **Doğrulama:** Birlikte olan çiftlerin yeşil çizgisi, geçmiş görüşmelerin
  gri çizgisi görünür; kalınlık farkı ayırt edilebilir.

#### 1.13 ✅ Ağ + vurgulama entegrasyonu
- Bildirim tıklamasından gelen `vurgulananKisiler`, ağ düğümlerini de vurgular
  (parlak halka + diğerleri soluk).
- **Doğrulama:** Bildirime tıklayınca hem listede hem ağda aynı kişiler parlar.

#### 1.14 ✅ Basit kişi detay paneli
- Kişi satırına veya ağ düğümüne tıklayınca sağda açılan panel:
  - Ad, rol, kurum, yıldız, kart no.
  - "Kiminle ne kadar" tablosu (`edges` filtrelenmiş, o kişiye ait).
  - Kart bilgisi: son duyulma, durum.
- Kapatma düğmesi. Aynı anda yalnız 1 panel açık.
- **Doğrulama:** Bir kişiye tıklayınca panel doğru verilerle açılır; ikinci
  kişiye tıklayınca ilki kapanır.

#### 1.15 ✅ Tablet düzeni (responsive)
- ≤900px: ağ görünümü gövdenin altına iner; bildirimler üstte yatay kaydırma.
- ≤600px: tek sütun; ağ varsayılan gizli, "Ağı göster" düğmesiyle açılır.
- `localStorage`'da son açık sekme (liste / ağ / bildirimler) korunur.
- **Doğrulama:** Ekran görüntüleri — 1280px, 900px, 600px genişlik.

#### 1.16 ✅ 50 kişi stres testi + son dokunuşlar
- Mock `--kisi=50` ile başlatılır; tüm bileşenler akıcı ve okunaklı mı kontrol.
- React performans: gereksiz yeniden render'lar `React.memo` ve `useMemo` ile
  engellenir (saniyede 2 güncelleme x 50 kişi).
- **Kabul ölçütü (Faz 1 tamamı):**
  - 25 ve 50 kişilik ekran görüntüleri teslim edildi.
  - Tasarım gerekçesi notu ("neyi neden böyle yaptım") yazıldı.
  - Tüm brief §7 ve §10 kuralları doğrulandı.

---

### ✅ Faz 2 — Kart atama ekranı (karşılama masası) ⭐ (TAMAMLANDI 30.09.2026)
**Amaç:** Brief'in en önemli yeni özelliği (§6). Tamamı §9 mock uçlarıyla çalışır;
gerçek sunucu gelince yalnız `api/masaApi.js` değişir.

**Model kararı (2.1'de kurulur):** Kişi ≠ Kart. Bir **atama katmanı** eklenir.
- **Katılımcı** = kayıtlı insan (id, ad, rol, kurum, yıldız, not, renk, atananKart|null).
- **Kart** = fiziksel cihaz 1–99 (alıcıdaki güç, seenAgo, pil; atanan kişi|boş).
- `/state` çıktısı Faz 1 ile uyumlu kalır (pano bozulmaz): atanmış+duyulan kartlar
  kişi olarak, atanmamış duyulan kartlar "Kart N" olarak görünür.

#### 2.1 ✅ Mock: kişi/kart/atama modeli + katılımcı ve atama uçları
- Mock'u kişi≠kart modeline taşı; `/state` çıktısı alan-alan aynı kalsın (Faz 1 testleri geçmeli).
- `GET/POST /api/people`, `PATCH/DELETE /api/people/{id}`; `POST /api/assign {kisiId,kart}`,
  `POST /api/unassign {kart}`. Atama zaman damgalı geçmişe yazılır.
- **Doğrulama:** kişi ekle→ata→`/state`'te görünür; iade et→kart boşta; süreler silinmez. Mock testleri + Faz 1 şema testi yeşil.

#### 2.2 ✅ Mock: GET /api/cards + yaklaştır ve tanı + boştaki kartlar
- `GET /api/cards` → `[{kart, rssiAlici, seenAgo, atanan, pil}]`.
- Alıcıya yaklaştırılan kartın simülasyonu (tek kart çok güçlü); iki kart yakınsa ikisi de güçlü.
- **Doğrulama:** `/api/cards` şeması; "yaklaştır" senaryosunda bir kart belirgin öne çıkar; çift-kart durumu ayırt edilir. Mock testleri.

#### 2.3 ✅ api/masaApi.js — §9 uçlarıyla konuşan tek yer
- people/assign/unassign/cards için ince sarmalayıcı (client.js felsefesi: tek I/O noktası).
- **Doğrulama:** gerçek HTTP mock'a karşı uçtan uca (ekle/ata/iade/cards) birim testleri.

#### 2.4 ✅ Ekran yönlendirme + "Kart Ver" iskeleti
- Hafif yönlendirme (hash/yol): `/` = Pano, `/kart-ver` = Karşılama masası. Üstte geçiş.
- Dokunmatik-ayakta düzen iskeleti (büyük hedefler, az yazı).
- **Doğrulama:** iki ekran arası geçiş; iskelet tabette okunur.

#### 2.5 ✅ Adım 1 — Kişi seç / yeni kişi oluştur
- Kayıtlı listede ada göre arama; yoksa hızlı form: **Ad**, **Rol** (büyük düğmeler),
  **Kurum**, yatırımcıysa **Yıldız (1–5)**, **Not**. Kişi rengi atama anında belirir.
- **Doğrulama:** arama + yeni kişi oluşturma `/api/people`'a gider; büyük dokunma hedefleri.

#### 2.6 ✅ Adım 2a — Kartı numarayla seç
- Numara girişi; yalnız "şu an açık" (duyulan) kartlar önerilir (yeşil nokta = açık).
- **Doğrulama:** duyulmayan kart uyarısı; açık kartlar önerilir.

#### 2.7 ✅ Adım 2b — "Yaklaştır ve tanı" akışı
- "Kartı alıcıya yaklaştırın" → `/api/cards` yoklanır, en güçlü kart otomatik belirir ("Kart 14 bulundu ✓").
- İki kart yakınsa "İki kart algılandı, birini uzaklaştırın".
- **Doğrulama:** mock simülasyonunda kart otomatik bulunur; çift-kart uyarısı çıkar.

#### 2.8 ✅ Adım 3 — Kontrol (açık/son duyulma/pil/zaten atanmış)
- Seçilen kartın durumu; **zaten atanmışsa** "Bu kart Ali Kaya'da. Geri alındı mı?" onayı.
- **Doğrulama:** atanmış kart seçilince uyarı; evet→eski atama kapanır.

#### 2.9 ✅ Adım 4 — Onay kartı → ekran sıfırlanır
- Kişinin rengiyle "Ayşe Demir → Kart 14" özeti; onayla→`/api/assign`; ekran hemen sıradaki kişiye.
- **Doğrulama:** onaydan sonra kişi panoda görünür; ekran sıfırlanır; akış hızlı.

#### 2.10 ✅ İade + son atamayı geri al
- Kart iadesi (kişi "ayrıldı", kart boşta, **süreler silinmez**); "Geri al" (son atama).
- **Doğrulama:** iade→pano'dan düşer, rapor süreleri kalır; geri al son atamayı bozar.
- **Yapıldı (30.09.2026):** Kart Ver ekranında "Kart ver | Kart iadesi" seçimi; `IadePaneli`
  (kart no/ad/kurum ile ara → tek onay → `/api/unassign`). Son atama şeridi + "Geri al":
  brief §6 "son birkaç dakika" → `GERI_AL_DK = 5` (masaYardim.js; 2.9'daki 4 sn'lik
  kendiliğinden kalkma bu yüzden 5 dk oldu). Geri al yalnız kartı boşa çıkarır; eski sahibe/
  eski karta geri vermez (onlar fiziksel olarak geri alınmıştı). Mock düzeltmesi: "birlikte"
  olan kart iade edilince sunucu çöküyordu (`tik()` → silinmiş kart) — artık kartın çiftleri
  kapanır, kenarlar (kim kimle ne kadar) kalır. 107/107 test + tarayıcı uçtan uca.

#### 2.11 ✅ Kart değişimi + kişi bilgisi düzenleme
- Kart değişimi (kişi aynı, kart değişir, **süreler kişide birleşir**); ad/kurum/yıldız/rol düzenleme (renk değişmez).
- **Doğrulama:** kart değişince eski+yeni süre birleşir; düzenleme `/api/people`'a gider.
- **Yapıldı (30.09.2026):** Mock'ta kenarlar (kim kimle ne kadar) artık **kişiye** bağlı
  (Şevval onayı); `/state` çıktısı Faz 1 ile aynı (kenarlar güncel kart no ile). Kart
  değişiminde kişinin süresi ve kenarları yeni kartta birleşir; iade edilen kart başkasına
  verilince eski sahibin süreleri devredilmez; kartsız kişinin süreleri silinmez, panoda
  görünmez, yeni kart alınca geri gelir. Kart değişimi mevcut sihirbazla yapılır (kartı olan
  kişi seçilir); onayda "Kart değişimi … süreler birleşir" açıklaması. Kişi düzenleme:
  Adım 1 listesinde "Düzenle"; form yeni-kişi formuyla ortak (`KisiFormu.jsx`), yalnız
  değişen alanlar PATCH edilir (`duzenlemeFarki`), renk gösterilir ama değiştirilemez.
  Mock PATCH: geçersiz rol/boş ad yok sayılır, yıldız 0–5. 113/113 test + tarayıcı uçtan uca.

#### 2.12 ✅ CSV toplu ön yükleme + "kart bekliyor" listesi
- CSV (ad, soyad, rol, kurum, yıldız) yükle → `/api/people/import`; kartsız kişiler "kart bekliyor".
- **Doğrulama:** CSV yüklenir, kişiler listeye düşer, kapıda atanır.
- **Yapıldı (30.09.2026):** Kişiye `ayrildi` alanı (Şevval onayı): kart iadesi → `true`,
  kart verilince → `false`. `POST /api/unassign {kart, ayrildi}` — varsayılan `true`;
  "Geri al" `false` gönderir (yanlış atamada kişi ayrılmış sayılmaz); başkasından alınan kart
  da kişiyi ayrılmış yapmaz. `POST /api/people/import` ham CSV alır → `{eklenen, atlanan:
  [{satir, sebep}]}`: başlık varsa sütun adına göre, yoksa sırayla; ayraç `;` `,` sekme;
  tırnaklı alan; rol Türkçe/İngilizce; aynı ad+kurum ikinci kez eklenmez. Arayüz: dosya
  UTF-8, değilse Windows-1254 okunur (Türkçe Excel). Adım 1'de "Tümü | Kart bekliyor (n)"
  filtresi, satırda "kart bekliyor" / "ayrıldı" etiketi; yükleme sonrası bekleyenler açılır.
  Excel (.xlsx) desteği yok — bağımlılık gerektirir, istenirse onaya sunulur.
  123/123 test + tarayıcı uçtan uca.

#### 2.13 ✅ "Boştaki kartlar" şeridi + kayıp kart etiketi
- Atanmamış ama açık kartlar ayrı şeritte (stok takibi); `lost` bildirimli kişide "Kartı kontrol et" → pil/kart değişimi.
- **Doğrulama:** boştaki kartlar görünür; kayıp kart etiketi ve düzeltme akışı.
- **Yapıldı (30.09.2026):** Kart Ver ekranı `/api/cards`'ı 3 sn'de bir yoklar (`useKartlar`).
  Alttaki "Boştaki kartlar" şeridi: açık + atanmamış kartlar, numaraya göre sabit, pil
  %20 altı ⚠. Mock'a masadaki yedekler eklendi (6 kart; iade edilen kart da masaya döner):
  alıcı duyar, `/state`'te kişi olarak görünmez. Kayıp kart = atanmış kart ≥60 sn duyulmuyor
  (`lost` ile aynı ölçüt; masa SSE dinlemeden `/api/cards`'tan türetir): üstte ciddi renkli
  "⚠ Kartı kontrol et" şeridi + kişinin satırında etiket. "Kontrol et" → "Pil değiştirildi"
  (uyarı "sinyal bekleniyor"a döner, sinyal gelince kalkar) ya da "Kart değiştirildi"
  (sihirbaz o kişiyle Adım 2'den açılır → kart değişimi, süreler birleşir).
  Kararlar (soru sorulmadan, Şevval talimatı): etiket masa ekranında; panoda kişi zaten
  "görünmüyor" + `lost` bildirimiyle görünür. 130/130 test + tarayıcı uçtan uca.

#### 2.14 ✅ SUNUCUDAN_ISTENENLER.md + Faz 2 teslimi
- Netleştirilmiş §9 API listesi (Muhittin'e). Ekran görüntüleri + tasarım gerekçe notu.
- **Kabul ölçütü (Faz 2 tamamı):** akış mock ile uçtan uca oynanabilir; ekran görüntüleri + not + `SUNUCUDAN_ISTENENLER.md` teslim edildi.
- **Yapıldı (30.09.2026):** `SUNUCUDAN_ISTENENLER.md` (mock'un gerçek davranışından; kişi≠kart
  ilkesi, her ucun biçimi, Muhittin'e 4 açık soru). `docs/faz2/FAZ2_TESLIM.md` + 14 ekran
  görüntüsü — tek bir uçtan uca kabul senaryosundan (pano "Kişi ata" → CSV → yaklaştır →
  onay → geri al → kart değişimi → düzenle → kayıp kart → iade → stok). Kapanışta
  düzeltilenler: pano "Kişi ata" köprüsü bağlandı (Faz 1'de boştu), "5–10 cm" metni
  kaldırıldı + koruma testi, `/api/assign` 404 gövdesi. 136/136 test.

### ✅ Faz 3 — Kurulum / eşik ekranı (TAMAMLANDI 30.09.2026)
**Amaç:** Brief §4.3 + §8: teknik kişinin etkinlik öncesi eşiği ayarladığı, sinyalleri ve
kart sağlığını gördüğü ayrı "Kurulum" sayfası. Veri `/state` (SSE) + `/api/cards`; yeni
sunucu ucu gerekmez. dBm ve yön farkı burada gösterilebilir; **metre yine yok.** Grafik
bağımlılıksız SVG (Faz 1 ağ görünümüyle aynı yaklaşım).

**Şevval kararları (30.09.2026):** (1) Grafikte eşik üstü bölge **nötr ton** (yeşil değil —
eşik üstü ≠ birlikte; yeşil yalnız "birlikte"). (2) Kart sağlığında **paket hızı yok** (sözleşme
değişmez; son duyulma + pil). (3) Faz 3 **sorgulamadan bitirilir**; kararlar PLAN'a not düşülür,
Faz 4 başlamadan sorulur.

#### 3.1 ✅ Kurulum sayfası iskeleti + yönlendirme
- `#/kurulum` rotası, üst sekmede "Kurulum". Panodaki eşik rozeti buraya götürür (Faz 1.2 köprüsü).
- Düzen: üstte eşik, ortada grafik, altta çift tablosu; yanda/altta kart sağlığı. Tablet düzeni.
- Alıcı bağlı değil / sunucuya bağlanılamıyor bantları (Faz 1 bileşenleri yeniden kullanılır).
- **Doğrulama:** üç ekran arası geçiş; panodaki eşik rozeti Kurulum'u açar.
- **Yapıldı:** `#/kurulum` + sekme; eşik rozeti bağlandı; `HataBantlari` → `components/` (pano + kurulum ortak); iki sütun, ≤900 px tek sütun.

#### 3.2 ✅ Eşik kaydırıcısı
- -95…-35 dBm, anlık değer büyük yazıyla; bırakınca ~250 ms sonra `POST /control threshold`
  (sürüklerken gönderilmez). Sunucudan gelen `threshold` ile senkron; gönderiliyor/kaydedildi/hata durumu.
- Klavye ile ±1 dBm (erişilebilirlik).
- **Doğrulama:** kaydırınca tek istek gider, panodaki eşik değeri değişir; hata olursa eski değere döner.
- **Yapıldı:** `api/esik.js` (sınır, 250 ms gecikmeli tek gönderim, sunucu reddi `false` da hata) + testleri; `EsikAyari`: büyük değer, ±1, "şu an N çift eşik üstünde", kaydediliyor/kaydedildi/hata. Tarayıcıda: 5 tuş → 1 istek, sürükleme → 1 istek, ağ hatası ve 400'de eski değere dönüş.

#### 3.3 ✅ Çift tablosu
- Her duyulan çift (`signals`): iki kişi (renk + rol şekli + ad), `ab` ve `ba` ayrı, `value`, ölçüm sayısı `n`
  (seyrekse işaret), durum: **birlikte** / **başlıyor…** (above ∧ ¬together) / **bitiyor…** (¬above ∧ together) /
  eşik altı. Ara durumlar mevcut alanlardan türetilir (§9-7'ye gerek yok).
- Sakin sıralama (çift sırası zıplamaz); iki yön arasında büyük fark varsa "yön farkı" işareti.
- **Doğrulama:** mock'ta dört durum da görünür; `ab/ba` null ise "—".
- **Yapıldı:** `api/sinyal.js` (durum türetme, yön farkı ≥8 dB ⇄, seyrek n<5, küçük kart no solda — kişiler yer değişince ab/ba da çevrilir) + testleri; ortak `components/KisiRozeti` (renk + rol şekli + ad + kart no). Tarayıcıda dört durum görüldü (1×: birlikte/başlıyor; 10×: bitiyor/eşik altı), sıra hiç bozulmadı.

#### 3.4 ✅ Canlı sinyal grafiği
- `history` (son 90 sn): her çift bir çizgi (iki kişinin rengi), eşik yatay kesikli çizgi, eşik üstü
  bölge hafif **nötr** tonlu (yeşil değil), çizgi sonunda doğrudan etiket ("3 · 4"), üzerine gelince değer. Eşik kaydırılırken
  çizgi anında yer değiştirir. Çok çift varsa en güçlü N çift + "tümü" seçeneği.
- **Doğrulama:** grafik canlı akar, eşik çizgisi kaydırıcıyla oynar, hover değeri doğru.
- **Yapıldı:** `api/grafik.js` (seri seçimi, sabit eksen -95…-35, etiket çakışma önleme, anlık değerler) + testleri; `SinyalGrafigi` bağımlılıksız SVG, kabın gerçek px genişliğinde (ResizeObserver) çizilir — yazılar her ekranda okunur; iki renkli çizgi (iki kişi), nötr eşik bölgesi, "3 · 4" uç etiketleri, çapraz çizgi + ipucu; varsayılan en güçlü 6 çift + "Tümünü göster". Kaydırıcının taslak değeri ekran düzeyine taşındı: eşik çizgisi sürüklerken anında oynar.

#### 3.5 ✅ Perspektif (kişi seçimi)
- Bir kişi seçilince grafik ve tablo yalnız onun çiftlerini gösterir ("perspektif" düğmeleri / kişi seçici).
- **Doğrulama:** seçim yalnız ilgili çiftleri bırakır; temizleyince hepsi döner.
- **Yapıldı:** `PerspektifSecici` (şu an çifti duyulan kişiler) + tablodaki kişi adına tıklama; grafik ve tablo birlikte süzülür, başlık sayısı süzülmüş sayıyı gösterir.

#### 3.6 ✅ Kalibrasyon sihirbazı
- Çift seç (tablodan) → 1) iki kart yüz yüze → "Kaydet" (10 sn ortanca) → 2) sırt sırta ya da 2–3 adım
  uzakta → "Kaydet" → 3) "Eşiği ortaya koy": ikisinin ortası önerilir, onayla → 3.2'deki gönderim.
- Görsel anlatım: iki insan simgesi yüz yüze / sırt sırta (SVG, gömülü).
- Mock'a yalnız demo için "çifti yüz yüze / sırt sırta tut" ucu (`/api/yaklastir` gibi, gerçek sunucuda yok).
- **Doğrulama:** mock'ta iki ölçüm alınır, önerilen eşik ortada, onaylanınca eşik değişir.
- **Yapıldı:** `api/kalibrasyon.js` (ortadaki öneri, fark <6 dB ve ters ölçüm uyarısı, 10 sn geri sayım) + testleri; `KalibrasyonSihirbazi` + gömülü SVG simgeler (yüz yüze / sırt sırta, mesafe ölçüsü yok); ölçek üzerinde sırt sırta / yüz yüze / öneri / şu an işaretleri; onay doğrudan eşik gönderir. Mock: yalnız demo için `POST /api/demo/tut {a,b,mod}` (istek işleyicide rnd() yok). `api/http.js` ortak JSON katmanı (MasaApi + yeni KurulumApi). Tarayıcıda: -53 / -79 → öneri -66 → sunucu eşiği -66.

#### 3.7 ✅ Kart sağlığı tablosu
- Her kart: en son duyulma, pil, "sorunlu" etiketi (duyulmuyor / pil düşük); paket hızı yok (karar 2);
  atanmışsa kişi adı. Sorunlular üstte, gerisi numaraya göre.
- **Doğrulama:** kayıp kart senaryosunda kart "sorunlu" olur, düzelince kalkar.
- **Yapıldı:** `api/kartSagligi.js` (kayıp ≥60 sn — masadaki ölçütle aynı sabit; görünmüyor >30 sn; pil <%20) + testleri; `KartSagligi` (/api/cards 3 sn yoklama, kişi /state'ten kart no ile; sorunlular üstte; durum sütunu dar ekranda da görünür). Mock: 23'ün katı kartların pili zayıf (demo). `DUSUK_PIL` tek kaynak (Faz 2 şeridi de kullanır). Tarayıcıda: pil düşük üstte, kayıp kart üste çıkıp düzelince kalktı.

#### 3.8 ✅ Faz 3 teslimi
- `SUNUCUDAN_ISTENENLER.md` güncellemesi (3.6 demo ucu yalnız mock), ekran görüntüleri,
  `docs/faz3/FAZ3_TESLIM.md`.
- **Kabul ölçütü (Faz 3 tamamı):** eşik kaydırıcı + grafik + tablo + sihirbaz + kart sağlığı mock ile uçtan
  uca çalışır; §8 maddelerinin hepsi karşılanır; not + ekran görüntüleri teslim edildi.
- **Yapıldı:** `docs/faz3/FAZ3_TESLIM.md` + 10 ekran görüntüsü (tek kabul senaryosundan; 1× sinyal, 10× kayıp kart); `SUNUCUDAN_ISTENENLER.md` §5 (Kurulum: yeni uç gerekmez, `pending` gerekmez, paket hızı yok, Muhittin'e soru 5). Faz 2 kabul senaryosu yeniden koşuldu — gerileme yok. Kapanışta: çift tablosunda durum sütunu öne (telefonda kaydırmadan görünür), kart sağlığında kesilen hücre yok, yan sütun 3:2. 160/160 test.

### ✅ Faz 4 — Kişi detay paneli (derin) + etkinlik sonrası rapor (TAMAMLANDI 30.09.2026)
**Amaç:** Brief §4.4 (rapor), §7 (kişi ayrıntı paneli), §9-6/§9-9. Şevval talimatı: **sorgulamadan
bitir, bitince haber ver.** Kararlar PLAN'a not düşülür.

**Ana karar:** Rapor `/state`'ten değil **görüşme kayıtlarından** (`/api/sessions`, kişi bazlı) ve kayıt
defterinden (`/api/people`) üretilir — kartı iade edilip ayrılanlar da raporda kalır (Faz 2 sözü).
`start/end` etkinlik saniyesi (`/state.elapsed` ile aynı ölçek), `a/b` = `kisiId`, sürmekte olan
görüşmede `end: null`. Saat gösterimi: etkinlik başlangıcı = şimdiki saat − `elapsed`.

#### 4.1 ✅ Mock: `GET /api/sessions`
- Birlikte başlayınca kayıt açılır, bitince (ya da kart iade/değişiminde) kapanır; kişi bazlı
  (kart değişse de aynı kişi), atanmamış kartın kayıtları kişi atanınca ona geçer; sıfırla temizler.
- **Doğrulama:** mock testi — kayıt açılır/kapanır, iade sonrası kalır, çift toplamı kenar süresiyle tutarlı.
- **Yapıldı:** `oturumAc/oturumKapat`; başladığı tik de sayıldığı için `start = simSn − DT` (kenar süresiyle birebir); kayıtsız kart kimliği `kart:N`, kişi atanınca `kenarlariTasi` kayıtları da taşır. `mock-server/oturum.test.js` (3× kararlı).

#### 4.2 ✅ api: oturum/rapor yardımcıları + RaporApi
- `RaporApi` (people + sessions, ortak http katmanı). Saf fonksiyonlar: oturum süresi, saat yazısı,
  kişi toplamları, çift toplamları, girişimci → ulaştığı yatırımcılar, en uzun görüşmeler.
- **Doğrulama:** birim testleri (ayrılan kişi dahil, sürmekte olan görüşme dahil).
- **Yapıldı:** `api/rapor.js` (raporHesapla, kisiOturumlari, etkinlikSaati, raporAdi…) + 6 test; `api/raporApi.js`; kişi rengi dönüşümü `renkler.katilimciRengiUyarla` (masa + rapor ortak).

#### 4.3 ✅ Kişi ayrıntı paneli (derin)
- Faz 1 panelinin altına **görüşme zaman çizelgesi** (bugün, zaman ekseninde çubuklar, karşı kişi etiketi,
  sürmekte olan açık uçlu), **kart bilgisi** (pil vb.) ve **"Kartı değiştir" / "Kartı iade al" kısayolları**
  → masa ekranı o kişi/kart hazır açılır.
- **Doğrulama:** panelde çizelge görünür; kısayollar masayı doğru adımda açar.
- **Yapıldı:** `components/ZamanCizelgesi` (ortak eksen, sürmekte olan açık uçlu + yeşil); panelde pil + kısayollar (`#/kart-ver?degistir=N` → kart değişimi 2. adım, `?iade=N` → o kişinin iade onayı, kayıtsız kartta "Bu karta kişi ata"); `usePanelVerisi` (panel açıkken 5 sn yoklama); kişi eşlemesi kart no → kayıt defteri. Faz 1 paneli bozulmadı.

#### 4.4 ✅ Rapor sayfası
- `#/rapor`: etkinlik başlığı + özet sayılar; kişi tablosu (toplam süre, kaç kişi, kaç karşı rol,
  ayrıldı/kartta); girişimci → ulaştığı yatırımcılar (hiç ulaşamayanlar vurgulu); en uzun görüşmeler;
  kim kimle toplam. Yazdırma/PDF dostu (`@media print`, "Yazdır / PDF" düğmesi).
- **Doğrulama:** ayrılan kişi raporda; sayılar oturumlarla tutarlı; yazdırma görünümü temiz.
- **Yapıldı:** `#/rapor` + sekme; bölümler `RaporBolumleri.jsx`; rapor anlık görüntü (açılışta + "Yenile"); `@media print` (menü/düğmeler gizli, satır bölünmez, token renkler); Chromium PDF çıktısı üretildi (A4). Katılımcı tablosu yalnız kayıtlılar (özetle aynı sayı); kayıtsız kartın görüşmeleri çift / en uzun tablolarında.

#### 4.5 ✅ CSV dışa aktarma
- Rapordan iki dosya: kişiler, görüşmeler. Türkçe Excel uyumlu (UTF-8 BOM, `;`). Tarayıcıda üretilir
  (sunucu beklenmez); `GET /api/report.csv` SUNUCUDAN_ISTENENLER'de isteğe bağlı kalır.
- **Doğrulama:** indirilen dosya Excel ayrıştırmasıyla doğru sütunları verir; Türkçe harfler bozulmaz.
- **Yapıldı:** `api/csvDisa.js` (BOM, `;`, CRLF, tırnak, virgüllü dakika, dosya adında tarih) + geri okuma testleri; rapor sayfasında "Katılımcılar (CSV)" ve "Görüşmeler (CSV)". Tarayıcıda gerçek indirme: 25 kişi = kayıt defteri, 78 görüşme = sunucu.

#### 4.6 ✅ Faz 4 teslimi
- `SUNUCUDAN_ISTENENLER.md` güncellemesi (sessions biçimi), ekran görüntüleri, `docs/faz4/FAZ4_TESLIM.md`.
- **Kabul ölçütü:** panel çizelgesi + kısayollar + rapor + yazdırma + CSV mock ile uçtan uca; not + görüntüler.
- **Yapıldı:** `docs/faz4/FAZ4_TESLIM.md` + 6 ekran görüntüsü + `ornek_rapor.pdf` + 2 örnek CSV (tek kabul senaryosundan); `SUNUCUDAN_ISTENENLER.md` §6 (sessions biçimi kesin; report.csv isteğe bağlı). Faz 2 ve Faz 3 kabul senaryoları yeniden koşuldu — gerileme yok. 179/179 test.

### ✅ Faz 5 — Cilalar (TAMAMLANDI 30.09.2026; onay: "faz 5 devam et bitince haber ver")
**Amaç:** Brief §4.5 (sunum modu), §10 (koyu/açık tema, doğrulanmış palet), §12-5 (100+ kişi).
Şevval talimatı: **sorgulamadan bitir, bitince haber ver.** Kararlar PLAN'a not düşülür.

#### 5.1 ✅ Kişi renkleri token'a bağlı + palet yeniden adımlama
- `sunucuRengi` hex yerine `var(--kisi-*)` döner → kişi rengi temayla birlikte değişir, kişiyi takip eder.
- Palet dataviz doğrulayıcısıyla yeniden adımlanır (PLAN §4 bulgusu): açık ve koyu yüzey ayrı.
- **Doğrulama:** `kontrast.test.js` iki tema için: tüm çiftler normal görüşte OKLab ΔE ≥15, renk
  körlüğünde sıra komşuları ≥8, yüzeyde ≥3:1, kroma ≥0.10, "birlikte" yeşilinden ≥15.
- **Yapıldı:** `renkler.js` → `PALET` (token adları), `KISI_RENK_ADLARI`; yeni palet açık: en kötü çift normal ΔE 17.5,
  renk körlüğünde tüm çiftler ≥8.1 (doğrulayıcı `--pairs all` bile geçiyor); koyu: normal ΔE ≥15.5, komşular ≥13.6
  (tüm çiftlerde 6.8 — uyarı bandı, kimlik zaten şekil + ad ile). Gri de ölçüme dahil. Test yardımcıları
  `theme/tokenOku.js`, `theme/renkOlcum.js`. Kalan sabit renkler (`rgba`) token'a çevrildi.

#### 5.2 ✅ Koyu tema + tema seçici
- `tokens.css`: `:root[data-tema="koyu"]` değer seti (yalnız ekranda; yazdırma her zaman açık).
- Menüde "Açık / Koyu" seçici; seçim cihazda saklanır, ilk boyamadan önce uygulanır. Varsayılan açık (PLAN §1).
- **Doğrulama:** tüm ekranlar koyu temada ekran görüntüsüyle; kontrast testleri iki temada yeşil.
- **Yapıldı:** `api/useTema.js` (`uyg.tema`, `kayitliTemayiUygula` main.jsx'te render'dan önce), `components/TemaSecici`;
  sıcak koyu kahve yüzeyler, durum renkleri koyu zeminde ≥4.5:1. Tarayıcıda: seçim yenilemede korunuyor; pano, masa,
  kurulum, rapor koyu temada kontrol edildi.

#### 5.3 ✅ Sunum modu (`?clean=1`)
- Salon ekranı: menü, liste, bildirim yok; ağ görünümü tam ekran, 2–3 m'den okunur etiketler,
  saat + birkaç büyük sayı. İsimli / isimsiz (`&isimsiz=1`). Köşede, üzerine gelince beliren sakin araç çubuğu.
- **Doğrulama:** tarayıcıda 1920×1080 ekran görüntüsü; isimsizde hiçbir ad yok.
- **Yapıldı:** `screens/Sunum/SunumEkrani` (`?clean=1`, `&isimsiz=1` adreste kalır → salon ekranı yenilense de aynı);
  `AgGorunumu` ortak bileşene taşındı (`components/`), `sunum` (geniş viewBox 1700, ekrana sığar, tıklanmaz) ve
  `isimsiz` seçenekleri; etiketlere zemin renginde hale (çizgi üstünde okunur, panoda da). Alt şerit panodaki
  `ozetKutulari` ile aynı sayılar + şekil/yeşil çizgi anahtarı. Menüde "Sunum modu ↗" (yeni sekme). Tarayıcıda:
  1920×1080 ve 1280×720'de kaydırma yok, isimsizde sayfa metninde ad yok, yenilemede korunuyor, "Sunumdan çık" panoya döner.

#### 5.4 ✅ 100+ kişi performansı
- Mock `--kisi=120` ile ölçüm (render süresi, tik başına iş); darboğazlara hedefli iyileştirme.
- **Doğrulama:** ölçüm önce/sonra; 120 kişide ağ ve liste okunur, taşma yok.
- **Yapıldı:** Kart no 1–99 sınırı (brief §3) yüzünden aynı anda en çok 97 kartlı kişi → mock `--kisi` 97'de kırpılıyor
  (önce çöküyordu); "100+" çelişkisi Muhittin'e Soru 6. Ölçüm üretim derlemesinde, 4× yavaşlatılmış işlemciyle
  (ucuz tablet), 15 sn: pano %15 → %12 meşgul, 39 → 55 fps; sunum 16 → 57 fps; kurulum %27 → %13, 34 → 40 fps.
  Değişiklikler: sunumda kalabalık rol yan yana sütunlara bölünür (`agGenislik`, `sutunBasi`; etiket 7 → 19 px);
  >15 çift birlikteyken yeşil akış animasyonu durur (her kare tüm SVG boyanıyordu); sunumda akış hiç yok, geçmiş
  çizgiler soluk; Kurulum'da >100 çiftte tablo 2 sn'de bir tazelenir (`useSeyrek` + memo), kalibrasyon seçenekleri
  yalnız çift listesi değişince çizilir. Pano ağı tek sütun kaldı (sayfa kaydırılabiliyor).

#### 5.5 ✅ Faz 5 teslimi
- Ekran görüntüleri + `docs/faz5/FAZ5_TESLIM.md`; önceki fazların kabul senaryoları yeniden.
- **Yapıldı:** `docs/faz5/FAZ5_TESLIM.md` + 12 görüntü (palet karşılaştırması dahil) + koyu temadan alınmış örnek PDF;
  Faz 5 kabul senaryosu 15/15; Faz 2 (11/11), Faz 3 (16/16), Faz 4 (13/13) yeniden koşuldu — gerileme yok. 194/194 test.

> Brief §12'nin beş önceliği bitti. Sonraki iş için (gerçek sunucuya bağlanma, açık sorular) Şevval'e sorulacak.

### ✅ Düzeltme turu — uçtan uca tarama bulguları (TAMAMLANDI 30.09.2026) (onay 30.09.2026: "önerdiğin planla ilerle")
Tarama: 3 kod incelemesi + tarayıcıda ekran × tema × genişlik + kopma/klavye. Onaylanan kapsam: A (hatalar),
B (gerçek sunucuya hazırlık), D (erişilebilirlik/kullanım), E (küçükler). **C (brief eksikleri: karşı rol sayısı,
sıralama/yalnız kaldı/misafir filtresi, bildirim geçmişi, alıcı kopunca soluklaşma) karar bekliyor — yapılmaz.**

- **T1** Akış ve mock sağlamlığı: SSE `\r\n` satır sonları (A1); mock tek hatalı istekte çökmesin, alan tipleri ve
  kart no (1–99) doğrulansın (A2); sıfırlamada kart 14 ve "yaklaştır" artığı (A6).
- **T2** Rapor gerçekten anlık görüntü: `elapsed`/`clock` görüntüyle birlikte saklanır (A3); tarihsiz başlık, çift "Kişi" başlığı.
- **T3** Masa: kopunca bant + son veri korunur (A4); kart no 1–99 doğrulaması (A5); demo düğmeleri yalnız mock'ta (B7);
  sunucu adresi tek yerde (B8); ≥100 kartlar listelerde yok (B9); "'da" eki; yıldız kontrolü; filtre/mod saklanır;
  seçili "Kart ver"e tekrar basmak işi silmez.
- **T4** Pano/Kurulum: panel Escape + odak (D14); ağ düğümleri ekran okuyucuda, Tab yükü yok (D15); telefonda bildirime
  dokununca kişiler sekmesi (D16); eşik bırakma güvenceleri (D17); kayıp kart duyurusu (D19); rol şekli (D20);
  kalibrasyon seçimi kaybolmaz; perspektif saklanır; 375 px küçükleri.
- **T5** Doğrulama (test + tarayıcı + önceki kabul senaryoları), belgeler, PR.
- **Yapıldı:** T1–T4 dört commit; 202/202 test (yeni: CRLF akış, mock sağlamlığı, kart no, bulunma eki, demo tespiti).
  Tarayıcıda her düzeltme ayrı doğrulandı; Faz 2 (11/11), 3 (16/16), 4 (13/13), 5 (15/15) kabul senaryoları yeniden geçti.
  Not: Faz 4 teslim notu raporu "anlık görüntü" diyordu, gerçekte değildi — T2'de düzeltildi. Masa "Kart bekliyor"
  filtresini kalıcı yapmak denendi, geri alındı: CSV sonrası açık kalınca kartı olan kişi aranamıyordu (Faz 2 gerileme
  testi yakaladı). Ayrıntı: `docs/duzeltme-turu/NOT.md`.

### ✅ Kod incelemesi turu (TAMAMLANDI 02.10.2026; onay: "sırayla yap")
Uçtan uca kod incelemesi (dal ↔ `main`) 10 doğrulanmış bulgu verdi. Sırayla:
- **R1** Gerçek sunucu: gövdesiz başarılı yanıt (204/boş 200) hata sayılmasın (`http.js`); 100+ dinleyici cihazlar
  `people` dışında `signals`/`history`/`edges`/`live` içinden de tek yerde ayıklansın (`client.js durumIsle`).
- **R2** Mock + arayüz: anlaşma geçmişi ve "yalnız kaldı" süresi karta değil kişiye bağlı; kayıp kart senaryosu boş
  listede çökmesin; kalibrasyon demosu önceki çifti bıraksın; bildirim anahtarı tekil olsun.
- **R3** Performans: ağ yerleşimi yalnız rol/sıra değişince hesaplansın; rapor ekranı canlı akışı dinlemesin (ölçümlü).
- **R4** Görünen ad kuralı tek yerde (iki farklı `gorunenAd` vardı).
- **R5** Doğrulama (test + Faz 2–5 kabul), belge, PR.
- **Yapıldı (R1–R4, dört commit):**
  - R1: `http.js` gövdesiz 2xx → `null` (hata değil); `client.js durumIsle` dinleyici cihazları `edges/live/signals/history`'den de ayıklar. Testler eski kodda kırmızıydı.
  - R2: mock'ta `anlasmalar` ve `yalnizSn` kişi kimliğiyle; `kenarlariTasi` anlaşmayı da taşır; kayıp kart senaryosu boş listede `null` kalır; kalibrasyon demosu önceki çifti bırakır; bildirim anahtarı `durumIsle`'de türetilir (`anahtar`: t+tür+kişiler+sıra). `mock-server/inceleme.test.js` (2 test, eski mock'ta kırmızı). PLAN §4 "yinelenen anahtar" kapandı.
  - R3: `AgGorunumu` yerleşimi kadro imzasıyla memo + `Dugum` memo; `RaporEkrani` `usePano` yerine `RaporApi.durumGetir()` (tek `/state`). Ölçüm (97 kişi, 4× yavaş, 15 sn): pano uzun görev 20 → 6, düzen+stil %12,2 → %8,0, 52 → 56 fps; rapor betik %2,6 → %0,4.
  - R4: `api/ad.js` (`tamAd`, `kisaAd`, iki veri biçimi); `durum.gorunenAd`/`rapor.raporAdi` = `tamAd`; `sinyal.gorunenAd` kaldırıldı; ağ etiketi ve masa listeleri ortak kuralı kullanır.
  - R5: 210/210 test; Faz 2 (11/11), 3 (16/16), 4 (13/13), 5 (15/15) kabul senaryoları yeniden geçti; PR güncellendi.

### ✅ C turu — brief §7 eksikleri (TAMAMLANDI 02.10.2026; onay: "C maddelerini de yap, hepsini sırayla")
Tarama bulgularının karar bekleyen dört maddesi. Brief'te "nasıl" yazmayan yerlerde karar aşağıda, sorgulanmadan
uygulanıyor (Şevval talimatı); itiraz olursa tek sabit/düğme değişir.

- **C1** Kişi satırında karşı rol sayısı (brief §7.2 "kaç karşı rol kişisiyle görüştüğü"). Karar: toplam sürenin altında
  ikinci satır, "2 yatırımcı" / "3 girişimci"; misafirde yok (karşı rolü yok); 0 ise "0 yatırımcı" (filtreyle tutarlı).
- **C2** Sıralama + filtreler (brief §7 "sıralama (en uzun görüşen, en yalnız)", "filtre (rol, durum, …)"). Kararlar:
  - Sıralama seçici (grup içinde): **Durum** (varsayılan, bugünkü), **En uzun görüşen** (`min` azalan), **En yalnız**
    (`min` artan, eşitlikte `invPeers` artan), **Yıldız** (`tier` azalan — §4.2 "özellikle önemli yatırımcılar").
    Eşitlikte her zaman sunucu sırası (kararlı). Süreye göre sıralamada satır yalnız biri diğerini gerçekten geçince yer
    değiştirir; FLIP yumuşatır (sakin hareket). Seçim `localStorage`'da (brief §11).
  - **"Yalnız kaldı"** filtresi = şu an boşta olan **yatırımcılar** (kart duyuluyor, kimseyle değil). "Ne kadardır"
    sunucuda yok (`idleSinceS` → SUNUCUDAN_ISTENENLER'e istek); gelince satıra "boşta · 4 dk'dır" eklenebilir.
  - **"Misafir"** filtre düğmesi (mantık zaten vardı).
- **C3** Bildirim akışı (PLAN 1.7 "tümünü göster" sözü). Karar: varsayılan son 20 (sakin), **"Tümünü göster (N)"** ile
  hepsi; **önem süzgeci** Tümü / Ciddi / Uyarı / Olumlu (kart kayboldu bildirimi anlaşma bildirimlerinin altında
  kaybolmasın). Süzgeç `localStorage`'da. Öğeler memo (97 kişide yüzlerce bildirim 2 Hz'de yeniden çizilmesin).
- **C4** Alıcı kopunca (brief §2 "eski veriyi canlıymış gibi gösterme", §11 "son veri soluk"): bant zaten vardı; artık
  pano, kurulum ve sunum içeriği sunucu kopmasındaki gibi solar (`veriCanli = bağlı ∧ alıcı taze`).
- **C5** Doğrulama (birim + tarayıcı + Faz 2–5 kabul), PLAN, SUNUCUDAN_ISTENENLER, PR.
- **Yapıldı (C1–C5, beş commit):** `durum.karsiRolYazisi`, `durum.siralaKisiler(people, ölçüt)` + `SIRALAMALAR`,
  `filtre.js` (`guest`, `yalniz`), `api/bildirim.js` (süz/say/görünen), `durum.veriCanli`; `FiltreCubugu` sırala seçici,
  `BildirimAkisi` süzgeç + "Tümünü göster" + memo öğe; üç ekranda alıcı kopmasında soluk. 223/223 test. Tarayıcıda C
  senaryosu 22/22 (sıralamalar sunucu verisiyle karşılaştırıldı; süzgeç ve sıralama yenilemede korunuyor; alıcı
  kopunca pano/kurulum/sunum soluk, gelince canlı; 600 px taşma yok; koyu tema). Faz 2 (11/11), 3 (16/16), 4 (13/13),
  5 (15/15) yeniden geçti. Not: Faz 5 kabul betiğindeki "kalabalık kurulum" kontrolü mock henüz 100 çift
  biriktirmemişken düşüyordu (zamanlama); betik artık bekliyor. `SUNUCUDAN_ISTENENLER.md` §9: `idleSinceS` isteği.

### ✅ Duyarlı tasarım turu — telefon / tablet / bilgisayar (TAMAMLANDI 02.10.2026; onay: "responsive olmalı, telefondan tabletten pc'den açacak")
Brief §7 "mobil/tablet düzeni" ve §11 "ucuz tablette akıcı" diyordu; şimdiye kadar hedef 600 px ve üstüydü. Bu turda
gerçek cihaz genişlikleri hedeflendi: **360 / 390 / 430 (telefon), 600, 768 / 820 (tablet dikey), 1024 (tablet yatay),
1180 / 1280 / 1440 (bilgisayar) + 740×360 yatay telefon**, 8 ekran durumu (pano, pano + panel, masa 3 durum, kurulum,
rapor, sunum). Tarama ölçütleri: yatay taşma, ekran dışına çıkan öğe, dokunma hedefi < 36 px, yazı < 12 px.

**Tarama (önce):** hiçbir genişlikte yatay taşma yok. Sorunlar: menü 360'ta üç satıra dağılıyor; filtre çipleri dört
satır; kişi satırında ad kesiliyor (sol sütuna 133 px kalıyor); kişi paneli %92 genişlikte, arkada işe yaramaz şerit;
**panelin "Bugün kiminle" listesinde süre alt satıra düşüp bölünüyor (T4'te eklenen rol şekli grid'de 4. sütun oldu — her
genişlikte hata)**; rapor tabloları kaydırmak yerine hücreleri sarıp 8 000 px uzuyor; sunumda ağ görünmez küçüklükte;
küçük dokunma hedefleri (menü bağlantısı 20 px, tema 28, eşik/sıfırla 30, filtre çipleri 28, kurulum ad düğmeleri 24);
10–11 px yazılar (durum ikonu, zaman çizelgesi).

**Kararlar (kırılma noktaları tek yerde, `theme/tokens.css` başında):**
- ≤480 dar telefon · ≤600 telefon · 601–900 tablet dikey ve yatay telefon · 901–1100 tablet yatay / küçük laptop · >1100 masaüstü.
- **Dokunma hedefi:** ≤1024 px'te (tablet + telefon) tüm düğme/bağlantı/seçiciler en az 36 px, birincil olanlar 40–44 px.
- **Menü (≤600):** dört sekme eşit genişlikte tek sıra (44 px), altında sunum bağlantısı + tema.
- **Pano (≤600):** boşluklar küçülür; filtre çipleri tek sıra yatay kaydırmalı (dikey yer yemesin); çubuk sabit (sticky)
  değil; ≤480'de ad kesilmek yerine sarar. **Kişi paneli** telefonda tam ekran (100 dvh), Escape/Kapat ile döner.
- **Rapor (≤700):** tablolar kaydırma kabında (`rp-kaydir`), en az 560 px, **ilk sütun (kişi) kaydırırken sabit**; yazdırma etkilenmez.
- **Sunum (≤900):** sayfa kaydırılabilir, ağ kendi oranında; dokunmatikte araç çubuğu her zaman görünür (`hover: none`).
- `viewport-fit=cover` + güvenli alan dolguları; `100vh` yerine `100dvh` (adres çubuğu); hiç yeni bağımlılık yok.
- **D2** doğrulama: aynı tarama "sonra", Faz 2–5 kabul; `docs/duyarli/` görüntüler + not.
- **Yapıldı (D1–D2, iki commit):** yalnız CSS + iki küçük JSX (rapor tabloları `rp-kaydir` kabında; panel liste grid'i).
  Dosyalar: `App.css`, `tokens.css` (kırılma noktaları notu, güvenli alan), `TemaSecici.css`, `UstSerit.css`,
  `PanoEkrani.css`, `KisiListesi.css`, `BildirimAkisi.css`, `DetayPaneli.css`, `ZamanCizelgesi.css`, `RaporEkrani.css`,
  `RaporBolumleri.jsx`, `SunumEkrani.css`, `AgGorunumu.css`, `KurulumEkrani.css`, `KartVerEkrani.css`, `index.html`.
  **Tarama (sonra):** 8 durum × 10 genişlik — taşma yok, 36 px altı dokunma hedefi yok, 12 px altı yazı yok, konsol temiz
  (tek işaret: bilerek yatay kaydırılan çip satırı). 223/223 test. Faz 2 (11/11), 3 (16/16), 4 (13/13), 5 (15/15)
  yeniden geçti. Görüntüler ve not: `docs/duyarli/` (17 görüntü: telefon 390, tablet 768/1024, bilgisayar 1280/1440,
  salon 1920, yatay telefon). Not: Faz 2 kabul betiği, belge görüntüleri önce alınınca "kayıp kart" penceresini (180–300.
  sn) kaçırıp düştü; taze mock'la hemen koşulunca geçti — betik mock başlar başlamaz koşulmalı (devir notuna yazıldı).

---

## 3. PROJE YAPISI (güncel, 30.09.2026)

```
SaasBridge/
├─ UI_TASARIM_BRIEF.md        # gereksinim belgesi (Muhittin) — her şeyin kaynağı
├─ PLAN.md                    # bu dosya: kurallar, kararlar, fazlar, devir notu
├─ SUNUCUDAN_ISTENENLER.md    # Muhittin'e: istenen uçlar, veri biçimleri, açık sorular
├─ dev.js                     # npm run dev: mock (8002) + Vite birlikte
├─ vite.config.js             # geliştirmede /state /events /control /api → 8002 proxy
├─ mock-server/
│  ├─ mock.js                 # tek dosya, bağımlılıksız Node SSE sunucusu (pano.py ikizi + /api uçları)
│  └─ *.test.js               # mock davranış testleri (her biri kendi portunda)
├─ src/
│  ├─ main.jsx · App.jsx      # kök; hash yönlendirme, menü, tema; ?clean=1 → sunum modu
│  ├─ api/                    # sunucuyla konuşan TEK katman + saf yardımcılar (+ *.test.js)
│  │  ├─ client.js            # SSE + durum deposu; SUNUCU_ADRESI (tek adres)
│  │  ├─ http.js              # ortak JSON istek katmanı, demo tespiti
│  │  ├─ masaApi.js · kurulumApi.js · raporApi.js   # ekran başına uç sarmalayıcıları
│  │  ├─ usePano.js · useKartlar.js · usePanelVerisi.js · useRota.js · useTema.js · useKalici.js · useSeyrek.js · useDemo.js
│  │  └─ durum · format · filtre · renkler · kartNo · masaYardim · csvOku · csvDisa · sinyal · esik · grafik ·
│  │     kalibrasyon · kartSagligi · rapor · agYerlesim   # saf hesaplar (JSX'te hesap yok)
│  ├─ theme/
│  │  ├─ tokens.css           # tüm renk/boşluk/yazı token'ları; açık + [data-tema="koyu"]
│  │  └─ kontrast.test.js · metreYok.test.js · tokenOku.js · renkOlcum.js   # iki tema kontrast/palet denetimi
│  ├─ components/             # ortak: AgGorunumu, KisiRozeti (+RolSekli), ZamanCizelgesi, HataBantlari, TemaSecici
│  └─ screens/
│     ├─ Pano/                # Faz 1 (+4 ayrıntı paneli)
│     ├─ KartVer/             # Faz 2
│     ├─ Kurulum/             # Faz 3
│     ├─ Rapor/               # Faz 4
│     └─ Sunum/               # Faz 5 (?clean=1)
├─ docs/faz1..faz5/ · docs/duzeltme-turu/ · docs/duyarli/   # teslim notları + ekran görüntüleri + örnek çıktılar
├─ index.html · package.json
└─ dist/                      # npm run build çıktısı (git'te yok; sunucu bunu statik verir)
```

---

## 4. AÇIK SORULAR / BEKLEYENLER

- [ ] Gerçek sunucu ayrı repoda yazılıyor (`saasBridgeBackend`); Muhittin'in mevcut kodu gelirse oraya referans olarak
      alınır. `saasBridgeBackend/PLAN.md` Bölüm 16.1'deki Soru 7–11 Muhittin'e iletilecek (`SUNUCUDAN_ISTENENLER.md`'ye
      henüz taşınmadı).
- [ ] `pano/pano.html` ekran görüntüleri görülemedi — referans gerekirse istenecek.
- [ ] Bildirim tıklaması dışında ek bildirim özelliği YOK (brief §5.2: ses,
      telefon bildirimi vb. kapsam dışı).

**Uçtan uca taramada (30.09.2026) bulunan, karar bekleyen brief eksikleri (C):**
- [x] ~~Kişi satırında "kaç karşı rol kişisiyle görüştü" gösterilmiyor~~ → C1 (02.10.2026).
- [x] ~~Sıralama seçeneği ve "yalnız kaldı" / "Misafir" filtreleri yok~~ → C2. Kalan: "ne kadardır yalnız" için
      sunucudan `idleSinceS` (SUNUCUDAN_ISTENENLER §9).
- [x] ~~Bildirim akışı 20'de kesiliyor~~ → C3 ("Tümünü göster" + önem süzgeci).
- [x] ~~Alıcı koptuğunda veri soluklaşmıyor~~ → C4.

**5.4 sırasında fark edilen:**
- [ ] **"100+ kişi" ile kart no 1–99 çelişiyor** → `SUNUCUDAN_ISTENENLER.md` Soru 6 (Muhittin).
- [ ] Kurulum'da ~500 çiftte tablo tazelemesi 4× yavaş işlemcide ~330 ms takılıyor (2 sn'de bir). Etkinlik öncesi
      teknik ekran olduğu için bırakıldı; gerekirse sanal liste (yalnız görünen satırları çizmek) ayrı iş.

**3.4 sırasında fark edilen (onay bekliyor):**
- [x] ~~**Kişi paleti renk ayrımı doğrulamasından geçmiyor**~~ → Faz 5.1'de iki tema için yeniden adımlandı. (dataviz doğrulayıcısı, OKLab, açık
      zemin `#fffdf8`): mercan `#bf4545` ↔ turuncu `#c25022` normal görüşte bile ΔE 4.8 (<15);
      hardal ↔ turuncu renk körlüğünde ΔE 1.7; petrol ve gri düşük canlılık. Faz 1'deki test
      CIELAB ölçütüyle geçiyordu. Etkisi sınırlı: 7 renk 25+ kişiye dağıldığı için kimlik her
      ekranda zaten renk + şekil + ad (grafikte "3 · 4" etiketi) ile veriliyor. Öneri: Faz 5
      (tema) ile birlikte paleti doğrulayıcıdan geçen tonlarla yeniden adımlamak.

**2.10 sırasında fark edilen, kapsam dışı bırakılanlar (onay bekliyor):**
- [x] ~~**Masa ekranlarında renk dönüşümü yok**~~ → düzeltildi (Faz 2 bitirme talimatı):
      `masaApi.js` kişi rengini `sunucuRengi` ile panodakiyle aynı açık palete çevirir;
      masada yeşil yok, kişi her ekranda aynı renk.
- [ ] **Atama geçmişi mock'ta yok:** 2.1'de "zaman damgalı geçmişe yazılır" denmişti ama
      yazılmıyor. Geri al şimdilik masanın kendi son atamasıyla (istemci) çalışır.
      Sunucu tarafı geçmiş → 2.14 `SUNUCUDAN_ISTENENLER.md`.
- [x] ~~**"Ayrıldı" ayrı durum değil**~~ → 2.12'de `ayrildi` alanı eklendi (onaylı).
      `SUNUCUDAN_ISTENENLER.md`'ye (2.14) yazılacak: `/api/people` `ayrildi`,
      `/api/unassign` `ayrildi` bayrağı, `/api/people/import` yanıt biçimi.
- [x] ~~**Kenarlar kart no ile anahtarlı**~~ → 2.11'de düzeltildi (kenarlar kişiye bağlı).
- [ ] **Kart değişiminde "Geri al"** yeni kartı boşa çıkarır, eski kartı geri vermez;
      kişi kartsız kalır (ekranda bu söylenir). Eski kartı geri vermek istenirse ayrıca karar.
- [x] ~~**Bildirim akışı yinelenen React anahtarı**~~ → kod incelemesi R2'de `durumIsle` tekil `anahtar` türetir.
