# Sunucudan İstenenler — Karşılama Masası (brief §9)

> Muhittin'e · Hazırlayan: Şevval (arayüz) · 30.09.2026 · Faz 2 çıktısı; Faz 3 (Kurulum) ve Faz 4 (görüşme kayıtları, rapor) ve Faz 5 (kalabalık) eklendi
>
> Arayüz bu uçlarla **mock sunucuya karşı** uçtan uca çalışıyor
> (`mock-server/mock.js` — davranışın çalışan referansı). Gerçek sunucu aynı
> sözleşmeyi verdiğinde arayüzde değişecek tek şey `src/api/masaApi.js` içindeki
> adres. Aşağıdaki biçimler mock'un bugün döndürdüğünün aynısıdır.

## Genel

- Tüm uçlar panoyla **aynı kaynaktan** (aynı host:port) verilir; CORS gerekmez.
- Gövdeler JSON (`Content-Type: application/json`); yalnız CSV içe aktarma ham metindir.
- Hata: 4xx + `{"ok": false, "hata": "…"}` (arayüz durum koduna bakar, metni göstermez).
- `rol` değerleri: `investor` | `founder` | `guest`. `yildiz` 0–5, yatırımcı değilse 0.
- `renk`: sunucunun bugünkü paletinden atanır ve **kişi için hiç değişmez**
  (arayüz açık temaya kendisi çevirir).
- Kart numaraları metin: `"14"`. 100 ve üstü dinleyici cihazdır, kişiye atanmaz.

## Temel kavram: Kişi ≠ Kart

Kişi (katılımcı) kalıcı bir kayıttır; kart fiziksel cihazdır. Bir kişiye bir
anda en fazla bir kart atanır. **Süreler ve "kim kimle ne kadar" kenarları kişiye
yazılır, karta değil:**
- Kart değişince (bozuldu, yeni kart) kişinin süreleri yeni kartta **birleşir**.
- İade edilen kart başka birine verilirse eski sahibin süreleri **devredilmez**.
- Kartı iade edilen (ayrılan) kişinin süreleri **silinmez**; yeni kart alırsa geri gelir,
  rapor (Faz 4) bunları kullanır.

`/state` sözleşmesi (brief §5) **değişmiyor**: `people[].id` ve `edges[].a/b` yine
güncel kart numarasıdır. Sunucu kişi bazlı tuttuğu kenarları o anki kartlara
çevirerek yayınlar; kartı olmayan kişinin kenarları `/state`'te görünmez.

## 1. Kişi kayıt defteri

### `GET /api/people` → `Kisi[]`

```json
{
  "kisiId": "k12", "ad": "Ayşe Demir", "rol": "investor", "kurum": "Atlas Ventures",
  "yildiz": 4, "not": "", "renk": "#3987e5", "atananKart": "14", "ayrildi": false,
  "sektor": "Sağlık, Enerji", "asama": "", "tanitim": "", "web": "", "eposta": "ayse@atlas.vc", "paylasim": true
}
```

| Alan | Anlamı |
|---|---|
| `kisiId` | Kalıcı kimlik (kart değişse de aynı) |
| `atananKart` | Şu anki kart ya da `null` |
| `ayrildi` | Kart iadesi yapıldı mı. `atananKart: null` + `ayrildi: false` = **"kart bekliyor"**; `ayrildi: true` = **"ayrıldı"** |
| `sektor` | Girişimcide sektörü; yatırımcıda ilgi alanları (virgüllü). Kişiye özel rapor (2026-10) |
| `asama` | `fikir` \| `mvp` \| `gelir` \| `buyume` ya da boş; yalnız girişimcide (rol değişince boşalır) |
| `tanitim`, `web`, `eposta` | Metin (en çok 200 karakter) |
| `paylasim` | İletişim (web, e-posta) başka katılımcıların raporunda görünebilir mi. **Varsayılan `false`**; yalnız açıkça evet denirse `true` |

### `POST /api/people` `{ad, rol, kurum?, yildiz?, not?, sektor?, asama?, tanitim?, web?, eposta?, paylasim?}` → `Kisi`
Kartsız oluşur (`atananKart: null`, `ayrildi: false`), renk o anda atanır. `ad` boşsa 400.

### `PATCH /api/people/{kisiId}` `{ad?, rol?, kurum?, yildiz?, not?, sektor?, asama?, tanitim?, web?, eposta?, paylasim?}` → `Kisi`
- Yalnız gönderilen alanlar değişir. **`renk` ve `kisiId` değiştirilemez** (gönderilirse yok sayılır).
- Geçersiz `rol` ve boş `ad` yok sayılır; `yildiz` 0–5'e kırpılır, rol yatırımcı değilse 0.
- Kişinin kartı varsa `/state`'teki adı/rolü/yıldızı hemen güncellenir.
- Olmayan kişi: 404.

### `DELETE /api/people/{kisiId}` → `{ok: true}`
Kartı varsa önce iade edilir. (Arayüz şu an kullanmıyor; kayıt defteri bütünlüğü için.)

### `POST /api/people/import` (gövde: ham CSV, `Content-Type: text/csv; charset=utf-8`)
→ `{"eklenen": 18, "atlanan": [{"satir": 6, "sebep": "rol anlaşılamadı: \"Konuşmacı\""}]}`

- Sütunlar: **ad, soyad, rol, kurum, yıldız** (brief §6.2); isteğe bağlı **sektör** (ilgi alanı), **aşama** (Fikir /
  MVP / Gelir / Büyüme), **tanıtım**, **web**, **e-posta**, **izin** (evet / hayır). Kişinin `ad` alanı = "ad soyad".
- İlk satır başlıksa (ad/soyad/rol/kurum/yıldız; Türkçe harfli ya da harfsiz) sütunlar
  ada göre eşlenir, değilse bu sırayla okunur.
- Ayraç `;` (Türkçe Excel), `,` ya da sekme — ilk satırdan anlaşılır. Tırnaklı alan
  (`"Veri; Köprüsü A.Ş."`, `""` kaçışı) desteklenir. Baştaki UTF-8 BOM atılır.
- Rol: `Yatırımcı/Girişimci/Misafir` (büyük-küçük, ı/i farkı gözetmeden) ya da `investor/founder/guest`.
- Atlanır (satır numarasıyla bildirilir): boş ad, anlaşılmayan rol, **aynı ad + kurum
  zaten kayıtlı**. Boş satırlar sessizce geçilir.
- Eklenenler kartsız ve `ayrildi: false` → masada "kart bekliyor".
- Boş gövde: 400.
- Not: dosya kodlamasını (UTF-8 / Windows-1254) **arayüz** çözer; sunucuya her zaman UTF-8 gelir.

## 2. Atama / iade / değişim

### `POST /api/assign {kisiId, kart}` → `{ok: true}`
- Kart başka birindeyse o atama kapanır (masa önce "Bu kart Ali Kaya'da. Geri alındı mı?"
  diye sorar). O kişi **ayrılmış sayılmaz** (`ayrildi` değişmez).
- Kişinin başka kartı varsa bırakılır (**kart değişimi**); süreler yeni kartta birleşir.
- Kişinin `ayrildi` alanı `false` olur. Kart "boştaki kartlar"dan çıkar.
- Kişi panoda hemen görünür (yeniden başlatma yok).
- Olmayan kişi: 404 `{ok: false}`.

### `POST /api/unassign {kart, ayrildi?}` → `{ok: true}`
- `ayrildi` varsayılan **`true`** = kart iadesi (brief §6.3: kişi "ayrıldı" olur).
- Arayüzün **"Geri al"** düğmesi (son birkaç dakikadaki yanlış atamayı düzeltme)
  `ayrildi: false` gönderir: kişi ayrılmadı, hâlâ kart bekliyor.
- Kart panodan düşer, süreler silinmez. Kart masaya döner: açık kaldığı sürece
  `/api/cards`'ta atanmamış (boştaki) kart olarak görünür.
- **Açık görüşmedeki kart iade edilebilir** (görüşmeler ~15 sn geç bittiği için masaya
  gelen kişi çoğu zaman hâlâ "birlikte"dir). Sunucu bu durumda o çifti kapatmalı ve
  eşini serbest bırakmalı. (Mock'ta bu durum sunucuyu çökertiyordu, düzeltildi.)

### İstenen: zaman damgalı atama geçmişi
Brief §9-2'deki "zaman damgalı atama geçmişi" mock'ta yok; arayüz "Geri al"ı şimdilik
masanın kendi hafızasıyla yapıyor (sayfa yenilenirse unutulur). Rapor ve denetim için
her atama/iade/değişimin `{zaman, kisiId, kart, islem}` kaydı tutulmalı. Önerilen:
`GET /api/assignments` → `[{t, kisiId, kart, islem: "ata"|"iade"|"geri_al"|"degisim"}]`.

## 3. Kartlar — `GET /api/cards`

```json
[{"kart": "14", "rssiAlici": -71.4, "seenAgo": 0.6, "atanan": "k12"}]
```

| Alan | Birim / anlamı | Arayüz nerede kullanır |
|---|---|---|
| `rssiAlici` | dBm, alıcının kartı duyduğu güç | Arayüz şu an kullanmıyor (kart numarayla verilir; "yaklaştır ve tanı" kalktı, 07.10.2026) |
| `seenAgo` | **saniye** | ≤8 sn "açık"; atanmış kartta ≥60 sn → **"Kartı kontrol et"** (brief `lost` ile aynı ölçüt) |
| `atanan` | `kisiId` ya da `null` | "zaten atanmış" uyarısı; `null` + açık → **boştaki kartlar** şeridi |

- Liste, alıcının duyduğu **tüm** kartları içermeli: atanmışlar, masadaki yedekler
  (atanmamış), iade edilip masaya dönenler. Arayüz 1–3 sn'de bir yoklar.
- Kart masada **numarayla** verilir (kartın üstündeki etiket); "yaklaştır ve tanı" ve mock'taki `POST /api/yaklastir` kalktı (Şevval kararı 07.10.2026).

## 4. Açık sorular (Muhittin)

1. **Masadaki yedekler panoda "Kart N" olarak görünmemeli.** Brief §5.1'e göre sunucu
   duyduğu atanmamış kartı `people`'a "Kart N" diye ekliyor; masada 20 yedek kart
   açık durursa panoya 20 hayalet kişi düşer. Mock'ta yedekler `/state`'te yok. Öneri:
   atanmamış kart `people`'a yalnız bir görüşmeye girdiğinde (ya da masadan uzaklaşınca)
   eklensin — ya da `people[].atanmamis: true` gelsin, pano karar versin.
2. **Yedek ile kayıtsız dolaşan kart ayırt edilebilir mi?** İkisi de "atanmamış ve açık".
   Masadaki şerit şu an ikisini de "boştaki kart" gösteriyor.
3. **Atama geçmişi** (yukarıda) hangi biçimde tutulacak?
4. `DELETE /api/people/{kisiId}` bir kişinin raporlanmış sürelerini de silsin mi?
   (Arayüz silmeyi sunmuyor; iade yeterli.)

## 5. Kurulum / eşik ekranı (Faz 3) — yeni uç gerekmiyor

Kurulum ekranı bugünkü sözleşmeyle çalışıyor; yalnız aşağıdakilerin **aynen** korunması yeterli:

| Alan / uç | Kullanım |
|---|---|
| `/state.threshold` | Kaydırıcının ve grafikteki eşik çizgisinin değeri |
| `/state.signals[]` (`a, b, ab, ba, value, n, above, together`) | Çift tablosu. `value` = **son 10 sn ortancası** olmalı: kalibrasyon "10 sn tut → o anki `value`" ile ölçüyor |
| `/state.history` (`"a-b": [[saniyeÖnce, dBm], …]`, en eski başta) + `chartSeconds` | Canlı grafik. Anahtar `"küçükNo-büyükNo"`. Yalnız Kurulum ister: diğer ekranlar `/state?grafik=0` ve `/events?grafik=0` ile bağlanır, `history` boş `{}` gelir (parametre yoksa tam durum) |
| `POST /control {"cmd":"threshold","value":-68}` | Kaydırıcı (bırakınca ~250 ms sonra tek istek) ve kalibrasyon onayı. 2xx dışı yanıt hata sayılır, ekran eski değere döner |
| `GET /api/cards` (`seenAgo`, `atanan`) | Kart sağlığı: ≥60 sn "duyulmuyor", >30 sn "görünmüyor" |

- **"Başlıyor… / bitiyor…" için §9-7'deki `pending` alanı gerekmiyor:** `above` ile `together`
  farkından türetiliyor (above ∧ ¬together = başlıyor, ¬above ∧ together = bitiyor).
- **Paket hızı ve pil istenmiyor** (Şevval kararları; pil 07.10.2026 — alıcıdan gerçek pil bilgisi yok): kart sağlığı yalnız son duyulma ile.
- `POST /api/demo/tut {a, b, mod}` **yalnız mock'ta** (kalibrasyonu donanımsız denemek için);
  gerçek sunucuda gerekmez.

**Soru 5 (Muhittin):** Kalibrasyon genelde masadaki **yedek (atanmamış) kartlarla** yapılır.
Bu kartların çiftleri `signals` ve `history`'de görünüyor mu? Görünmüyorsa kalibrasyon
için geçici olarak (ör. Kurulum açıkken) dahil edilmeleri gerekir. Mock'ta şu an yalnız
panodaki kartların çiftleri var.

## 6. Görüşme kayıtları ve rapor (Faz 4)

### `GET /api/sessions` → görüşme kayıtları (brief §9-6)

```json
[{"a": "k12", "b": "k7", "start": 1840.5, "end": 2310.0},
 {"a": "k3", "b": "kart:14", "start": 2400.0, "end": null}]
```

| Alan | Anlamı |
|---|---|
| `a`, `b` | **Kişi kimliği** (`kisiId`), kart değil — kart değişse de aynı kişi. Kişiye atanmamış kart için `"kart:N"`; o karta sonradan kişi atanırsa kayıtları o kişiye geçer |
| `start`, `end` | **Etkinlik saniyesi** (`/state.elapsed` ile aynı ölçek). Sürmekte olan görüşmede `end: null` |

- Kayıt, çift "birlikte" olunca açılır, birlikte bitince kapanır (1 dk giriş / 15 sn çıkış
  gecikmeleri dahil, `/state` ile aynı karar). Giriş dakikası görüşmeye sayılır: kayıt eşiğin aşıldığı ana geri
  tarihlidir ve başladığı tikte o dakika `edges`/`min`'e eklenir (karar 05.10.2026). Kart iade edilince ya da değişince açık kayıt kapanır.
- **Kayıtlar silinmez:** kartı iade edilen (ayrılan) kişinin kayıtları raporda kalır. Yalnız
  `POST /control reset` temizler.
- Çift başına kayıt süreleri toplamı `/state.edges[].min` ile tutarlı olmalı (mock'ta testle kilitli;
  başladığı tik de süreye sayılır).
- Arayüz saati "şimdiki saat − `elapsed` + `start`" diye hesaplıyor; bu yüzden `/state.clock` ve
  `/state.elapsed` aynı andan olmalı.
- Kullanım: kişi ayrıntı panelindeki zaman çizelgesi (5 sn'de bir), rapor sayfası (açılışta +
  "Yenile"), CSV dışa aktarma.

### Rapor dışa aktarma — sunucudan **beklenmiyor**
Rapor ve iki CSV dosyası (katılımcılar, görüşmeler) **tarayıcıda** `/api/people` + `/api/sessions`
verisinden üretiliyor (Türkçe Excel uyumlu: UTF-8 BOM, `;`, ondalıkta virgül). Brief §9-9'daki
`GET /api/report.csv` bu yüzden isteğe bağlı: sunucuda da istenirse biçim `docs/faz4/ornek_*.csv`
ile aynı olsun.

### Hâlâ gerekmeyen / sonraya kalanlar
| # | Uç | Durum |
|---|---|---|
| 7 | `signals[].pending` | Gerekmiyor — `above`/`together` farkından türetiliyor (Faz 3) |
| 8 | `GET/PATCH /api/event` | Faz 4'te gerekmedi; etkinlik bilgisi `/state.event`'ten okunuyor. Kural ayarları (anlaşma / yalnız kalma süresi) ekranı istenirse gerekir |

## 7. Kalabalık, sunum modu ve tema (Faz 5) — yeni uç gerekmiyor

- **Sunum modu** (`?clean=1`, isteğe bağlı `&isimsiz=1`) ve **koyu tema** tamamen arayüzde;
  sunucudan yeni alan beklenmiyor. Sunum adresi `/?clean=1` sunucunun `dist/`'i verdiği aynı
  adresten açılır.
- **Kişi rengi:** sunucu `people[].color`'da brief §10 paletini göndermeye devam etsin; arayüz
  bu değeri temanın doğrulanmış tonuna eşliyor (`#199e70` → petrol). Palet dışı bir renk
  gelirse aynen gösterilir.
- **Yük ölçümü (mock, 97 kişi):** `/state` ~33 KB'tan 20 dakikada ~220 KB'a çıkıyor; neredeyse
  tamamı `signals` + `history` (≈500 çift). Pano bunları kullanmadığı halde her tikte (0,5 sn)
  ayrıştırıyor. Şimdilik sorun değil (4× yavaşlatılmış işlemcide pano %12 meşgul), ama gerçek
  salonda çift sayısı daha da büyürse `history`'nin yalnız Kurulum açıkken gönderilmesi
  düşünülebilir.
  **Gerçekleşti (05.10.2026, backend B7):** gerçek sunucuda 97 kişi, 3. saat: `/state` ~620 KB, ~%60'ı
  `history`. Artık yalnız Kurulum `history` alıyor (`?grafik=0`, yukarıda); isteyen ekran yoksa sunucu onu hesaplamıyor.

**Soru 6 (Muhittin):** Brief §12 "kalabalık (100+ kişi)" diyor, ama kart numaraları 1–99
(100 ve üstü dinleyici cihaz). Aynı anda en çok ~98 kartlı kişi olabiliyor. 100+ kişilik
etkinlikte ne olacak — kart numara aralığı genişleyecek mi (dinleyiciler başka aralığa mı
taşınacak), yoksa "100+" kayıtlı kişi sayısı mı (kart iadesiyle aynı kart gün içinde
birden çok kişiye)? Arayüz iki durumda da çalışıyor; mock `--kisi` 97'de kırpıyor.

## 8. Uçtan uca tarama sonrası netleşenler (30.09.2026)

- **`GET /api/demo` gerçek sunucuda OLMAMALI (404).** Arayüz demo düğmelerini (kalibrasyonda
  "çifti tut") yalnız bu uç varsa gösterir; mock'ta var, gerçek sunucuda yoksa düğmeler gizlenir.
  `/api/demo/tut` de yalnız mock'a ait.
- **Kart numaraları:** `/api/assign` ve `/api/unassign` gövdesindeki `kart` 1–99 arası, baştaki sıfırsız
  dize ("7"). Arayüz "007"yi "7"ye çevirir, 0 ve 100+ numaraları göndermez. Sunucu geçersiz numaraya
  400, bilinmeyen karta 404 dönebilir; arayüz bunu hata olarak gösterir.
- **`/api/cards` 100+ dinleyici cihazları içerebilir.** Arayüz bunları kişi kartı listelerinden eler.
- **SSE satır sonu:** `\n` de `\r\n` de kabul ediliyor (Python sunucuları çoğu zaman `\r\n` yollar).
- **Uçlar henüz yoksa:** Masa "sunucuya bağlanılamıyor" bandı gösterir ve son listeyi korur; kişi paneli
  "görüşme kayıtları alınamadı" der; rapor "rapor verisi alınamadı" der. Pano, `/state` + `/events` ile
  her durumda çalışır.

## 9. "Yalnız kaldı" için istenen alan (C turu, 02.10.2026) — ✅ geldi

> **Durum (06.10.2026):** Gerçek sunucu gönderiyor (`yakinlik/cekirdek/durum.py`); mock da aynı kuralla gönderiyor.
> Herkes için sayılır: kişi birlikteyken ya da görünmezken (`seenAgo` ≥ 30) `0`, 0,1 sn'ye yuvarlı. Kullanan yerler:
> Pano kişi satırı ("boşta · 4 dk'dır") ve canlı gruplardaki "yalnız · X dk" etiketi. Aşağıdaki metin isteğin aslıdır.

Pano'da **"Yalnız kaldı"** filtresi var: şu an boşta olan yatırımcılar. "Ne kadardır yalnız" bilgisi `/state`'te
yok; sunucu `idle_investor` bildirimini 6 dk'da üretiyor ama süreyi vermiyor. İstek (isteğe bağlı, küçük):

| Alan | Nerede | Anlamı |
|---|---|---|
| `people[].idleSinceS` | `/state` | Kişinin kesintisiz kaç **saniyedir** kimseyle birlikte olmadığı (birlikteyken `0`/`null`) |

Gelince satırdaki durum cümlesi "boşta · 4 dk'dır" olur ve "Yalnız kaldı" filtresi süreyle sıralanabilir.
Arayüz bu alanı istemci tarafında saymıyor: sayfa yenilenince sıfırlanır ve yanıltır.

## 10. Uyarı kuralları (06.10.2026) — ✅ gerçek sunucu ve mock

Organizatör her etkinlik için kural kurar (Kart Ver → **Uyarılar**): *"[kim] ile [kiminle] [yan yana gelince | N
dakikadan uzun birlikte kalınca]"*. Koşul sağlanınca bildirim akışına bir **kural uyarısı** düşer, Pano onu ekranın
üstünde açılır pencere olarak gösterir (Sunum ekranında gösterilmez). Kurallar sunucuda saklanır, etkinliğe özeldir;
"Sıfırla"da kalır.

### `GET /api/rules` → `Kural[]`

```json
{ "kuralId": "r1", "ad": "★4+ yatırımcılar ile girişimciler · 5 dk",
  "kim": { "rol": "investor", "enAzYildiz": 4 }, "kiminle": { "rol": "founder", "enAzYildiz": 0 },
  "dakika": 5, "acik": true }
```

| Alan | Anlamı |
|---|---|
| `kim`, `kiminle` | `{ "kisiler": ["k3", "k7"] }` (belirli kişiler) ya da `{ "rol": investor\|founder\|guest\|herkes, "enAzYildiz": 0–5 }`. Çift iki yönden biriyle uyarsa yeter. Kimseye atanmamış kart hiçbir kurala uymaz |
| `dakika` | `0` = yan yana gelince (sistem bir çifti 1 dk yakınlıkla "birlikte" sayar); `N` = N dakikadan uzun birlikte (0–600) |
| `ad` | Boş gönderilirse kuraldan üretilir (ör. "Ayşe Demir ile Nova Robotik · yan yana"); en çok 80 karakter |
| `acik` | Kapalı kural uyarmaz |

### `POST /api/rules` → `Kural` · `PATCH /api/rules/{kuralId}` (yalnız gönderilen alanlar) → `Kural` · `DELETE` → `{ok: true}`
- Geçersiz kural: 400 `{ok: false, hata}` — hata metni kullanıcıya gösterilir (ör. `"kim: en az bir kişi seçin"`,
  `"kim: bilinmeyen kişi k99"`, `"dakika 0–600 olmalı"`). Olmayan kural: 404.
- Kimlik sıra no'yla (`r1`, `r2` …); silinen kuralın kimliği yeniden kullanılmaz.

### Kural uyarısı (`/state.alerts[]`)
- `kind: "kural"`, `severity: "kural"`, `title` = kuralın adı, `detail` = "X ile Y 5 dakikadır birlikte." ya da "X ile Y
  yan yana geldi.", `people` = iki kartın numarası, ek alan **`kural`** = tetikleyen `kuralId` (diğer bildirimlerde `""`).
- Bir kural bir çiftin bir görüşmesinde **bir kez** uyarır; görüşme bitip yeniden başlarsa tekrar uyarabilir.
