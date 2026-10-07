# Yakınlık Takip Sistemi — Arayüz Tasarım Belgesi

> **Bu belgeyi okuyan yapay zekâya:** Aşağıda çalışan bir donanım + sunucu
> sistemi anlatılıyor. Senden istenen onun **kullanıcı arayüzünü** tasarlamak
> ve kodlamak. Sunucu (Python) hazır ve veriyi aşağıda tarif edilen biçimde
> veriyor. Uymadığın bir yer olursa arayüzü sunucuya uydur. Sunucuda olmayan
> ama arayüzün ihtiyaç duyduğu şeyleri **"Sunucudan istenecekler"** bölümüne
> yaz. Bunları proje sahibi (Muhittin) ekleyecek. Arayüz dili **Türkçe**.
> Anlamadığın bir kavram olursa uydurma, "Kavramlar" bölümüne bak, orada
> yoksa sor.

---

## 1. Ürün tek paragrafta

Bir etkinlikte (yatırımcı–girişimci buluşması gibi) herkesin boynuna küçük
bir **yaka kartı** takılıyor. Kartlar birbirlerinin Bluetooth sinyalini
sürekli ölçüyor. İki kişi yüz yüze ve yakın durduğunda sinyal güçleniyor, sistem de
bunu **"bu iki kişi şu an birlikte"** diye işaretliyor ve **birlikte
geçirdikleri süreyi** sayıyor. Organizatör canlı bir panodan kimin kimle, ne
kadar süredir görüştüğünü, kimin yalnız kaldığını ve hangi görüşmelerin
uzadığını ("potansiyel anlaşma") görüyor.

### Sistem neyi YAPMAZ (tasarımda asla ima etme)

| Yapmaz | Neden önemli |
|---|---|
| **Konuşmayı dinlemez, ses kaydı yoktur** | Mikrofon yok. "Konuşma" kelimesini kullanırken "birlikte" anlamında kullan. |
| **Mesafe (metre) göstermez** | Sinyal gücü metreye güvenilir biçimde çevrilemiyor. Arayüzde **hiçbir yerde metre/cm olmayacak.** Proje sahibinin kesin kararı. |
| **Konum/harita göstermez** | Kimin odanın neresinde olduğu bilinmiyor. Sadece "kim kiminle yakın" biliniyor. Kat planı, ısı haritası gibi şeyler yapma. |
| **Konuşmanın içeriğini/kalitesini bilmez** | Yalnızca "yan yana durdular, şu kadar dakika". |

---

## 2. Sistem nasıl çalışıyor

```
 ┌──────────┐   Bluetooth    ┌──────────┐
 │ Kart  3  │ ◄────────────► │ Kart  4  │     Her kart saniyede birkaç kez
 │ (C3,pil) │                │ (C3,pil) │     "ben buradayım + duyduklarım"
 └────┬─────┘                └────┬─────┘     paketi yayınlar.
      │  "4'ü -52 gücünde duydum"  │
      ▼                            ▼
 ┌─────────────────────────────────────┐
 │ Alıcı (ESP32-S3, bilgisayara USB'li) │  Kartların paketlerini toplar,
 │ aynı zamanda kendisi de "Kart 1"     │  seri porttan bilgisayara aktarır.
 └──────────────────┬──────────────────┘
                    ▼ USB seri
 ┌─────────────────────────────────────┐
 │ server.py  → çift başına "birlikte  │  Sinyali yumuşatır, eşikle
 │              mi?" kararı + süre      │  karşılaştırır, süreyi sayar.
 │ pano/pano.py → kişiler, roller,      │  Kişi bilgisini ekler, kuralları
 │              bildirimler, HTTP API   │  işletir, saniyede 2 kez durum
 └──────────────────┬──────────────────┘  yayınlar.
                    ▼ HTTP + SSE (localhost:8002)
              ┌──────────────┐
              │   ARAYÜZ     │  ← senin yapacağın kısım
              └──────────────┘
```

**Önemli:** İki kartın birlikte olduğunu kartlar kendileri söylüyor. Alıcının
yakında olması gerekmez, sadece paketleri duyacak kadar yakın olması yeter
(bir odayı kapsar). Alıcı da bir kart gibi sayılır ("1" numara).

### "Birlikte" kararı nasıl veriliyor

1. Her kart çifti için iki yönde sinyal gücü ölçülür (A→B ve B→A).
2. Sinyal gücü **dBm** cinsindendir, negatif bir sayıdır: **-40 çok güçlü /
   çok yakın**, **-90 çok zayıf / uzak**. Büyük sayı = yakın.
3. Bu değer bir **eşik** ile karşılaştırılır (şu an **-72 dBm**, arayüzden
   ayarlanıyor). Eşiğin üstü "yakın" demek.
4. **Giriş gecikmesi 5 sn:** Sinyal 5 sn boyunca eşiğin üstünde kalırsa
   görüşme **başlar**. Yanından geçip gidenler sayılmaz.
5. **Çıkış gecikmesi 15 sn:** Sinyal 15 sn boyunca eşiğin altında kalırsa
   görüşme **biter**. Biri kısa süre arkasını dönünce görüşme bölünmez.
6. 12 sn hiç paket gelmezse bağlantı kopmuş sayılır.

**Arayüz için sonuçları:**
- Bir görüşme panoda **~5 sn geç başlar ve ~15 sn geç biter.** Bu normal,
  hata gibi gösterme. İstersen "başlıyor…" / "bitiyor…" gibi ara durumlar
  gösterebilirsin, bunun için sunucudan ek alan istenmesi gerekir (bkz. §9).
- İnsan vücudu sinyali zayıflatıyor: **sırt sırta duran iki kişi
  "birlikte" sayılmaz.** Bu bilerek istenen bir özellik.
- Sinyal eşiğe yakınken görüşme kısa kısa açılıp kapanabilir (titreme).
  Arayüz bunu sakin göstermeli: kartların zıplaması, sürekli yeniden
  sıralanması, yanıp sönmesi olmamalı.

### Donanım gerçekleri (arayüzü etkileyenler)

| Durum | Arayüzde nasıl görünmeli |
|---|---|
| Kartlar pille çalışıyor, pil bitebilir | Kart bir süre duyulmazsa (`seenAgo` büyür) kişi **"görünmüyor"** olur. 60 sn'de "Kart sinyali kesildi" bildirimi düşer. |
| Bazı kartlar diğerlerini daha zayıf duyuyor (donanım farkı) | Eşik panelinde iki yön ayrı gösteriliyor (`ab`, `ba`). Bu teknik ekranda kalmalı, organizatör ekranında gösterme. |
| Alıcı çıkarılırsa/koparsa hiç veri gelmez | `receiverAge` büyür. Büyük ve net bir **"ALICI BAĞLI DEĞİL"** uyarısı göster. Eski veriyi canlıymış gibi gösterme. |
| Kart kimlikleri 1–99 arası | 100 ve üstü dinleyici cihazlardır, kişi değildir. Listede gösterme. |

---

## 3. Kavramlar sözlüğü

| Terim (arayüzde) | Kod/JSON karşılığı | Anlamı |
|---|---|---|
| **Kart** | `id` (string, "10") | Fiziksel yaka kartı. Numarası cihaza kalıcı olarak yazılı. Kartın üstüne bu numaranın etiketi yapıştırılmalı. |
| **Kişi / katılımcı** | `people[]` | Bir karta atanmış insan. Kart ≠ kişi: kart geri verilince başka birine atanabilir. |
| **Rol** | `role`: `investor` / `founder` / `guest` | Yatırımcı / Girişimci / Misafir. |
| **Kurum** | `org` | Yatırımcı için fon adı, girişimci için şirket adı. Girişimcide kurum adı kişi adından önce gösterilir (`withName` bunu uyguluyor). |
| **Yıldız / öncelik** | `tier` (0–5), `stars` ("★★★") | Yatırımcının önemi. Anlaşma süresi ve "yalnız kaldı" uyarısı buna bağlı. |
| **Renk** | `color` ("#3987e5") | Kişiye sabit atanmış renk. **Kişiyi takip eder, sıraya göre değişmez.** Biri çıkınca diğerlerinin rengi değişmez. |
| **Birlikte / görüşme** | `status: "talking"`, `live[]` | Şu an eşik üstünde ve giriş gecikmesini geçmiş çift. |
| **Boşta** | `status: "idle"` | Kartı duyuluyor ama kimseyle birlikte değil. |
| **Görünmüyor** | `status: "away"` | 30 sn'dir kartından ses yok (alan dışı / pil / cebe konmuş). |
| **Eşik** | `threshold` (dBm) | "Birlikte" sayılmak için gereken en düşük sinyal gücü. |
| **Sinyal gücü** | `signals[].value` | Kullanıcıya **"yakınlık gücü"** gibi bir adla göster. Birim olarak "dBm" sadece teknik ekranda kalsın. Metreye çevirme. |
| **Alıcı** | `receiverAge` | Bilgisayara bağlı toplayıcı cihaz. |
| **Karma görüşme** | `invMin`, `mixedMin` | Yatırımcı ile girişimci arasındaki görüşme. Etkinliğin asıl amacı bu. |

---

## 4. Kullanıcılar ve ekranlar

Sistemi dört farklı durumda kullanan insanlar var. Her biri için ayrı ekran
ya da mod tasarla:

### 4.1 Karşılama masası: kart atama ⭐ (şu an hiç yok, en önemli yeni ekran)
Etkinlik girişinde görevli, gelen kişiye bir kart verip sisteme kaydeder.
Ayrıntılı akış **§6**'da.

### 4.2 Organizatör canlı panosu (şu an var, yeniden tasarlanacak)
Etkinlik boyunca laptop veya tablette açık kalır. Soruları:
- Şu an kim kimle birlikte, ne zamandır?
- Kim yalnız kaldı (özellikle önemli yatırımcılar)?
- Hangi girişimci hâlâ hiçbir yatırımcıyla görüşmedi?
- Hangi görüşme uzadı (potansiyel anlaşma)?
- Hangi kart kayboldu (pil / alan dışı)?
- Sistem sağlıklı mı (alıcı bağlı mı)?

### 4.3 Kurulum / teknik ekran: eşik ayarı (şu an var, iyileştirilecek)
Etkinlik öncesinde teknik kişi kullanır. İki kartı yüz yüze tutar, sonra sırt
sırta tutar, arada kalan değeri eşik yapar. Canlı sinyal grafiği ve çift
tablosu gerekir. Ayrıca kart sağlığı (pil, en son ne zaman duyuldu)
burada görünmeli.

### 4.4 Etkinlik sonrası rapor (şu an yok)
Kim kimle toplam kaç dakika görüştü, hangi girişimci kaç yatırımcıya
ulaştı, en uzun görüşmeler. Yazdırılabilir / PDF'e uygun olmalı.
Veri `edges[]` ve `people[]` içinde zaten var.

(İsteğe bağlı) **4.5 Büyük ekran / sunum modu:** Salondaki ekranda
katılımcılara gösterilecek, sade ve isimsiz ya da isimli ağ görünümü.
Mevcut panoda `?clean=1` bu işi yapıyor.

---

## 5. Sunucu API'si (şu an çalışan)

Adres: `http://localhost:8002` (başka makineden: bilgisayarın IP'si + 8002).
Kimlik doğrulama yok, yerel ağ içinde kullanılıyor.

| Yöntem | Yol | Ne yapar |
|---|---|---|
| `GET` | `/` | Mevcut arayüzü (`pano/pano.html`) verir. Yeni arayüz bunun yerine geçecek. |
| `GET` | `/state` | Anlık durumun tamamı (JSON). Sayfa açılışında bir kez çağır. |
| `GET` | `/events` | **Server-Sent Events.** Saniyede ~2 kez `data: {…durum…}` gönderir. Bağlanır bağlanmaz ilk durumu da yollar. `EventSource` ile dinle, koparsa yeniden bağlan. |
| `POST` | `/control` gövde `{"cmd":"reset"}` | Tüm süreleri, geçmişi ve bildirimleri sıfırlar. (Onay iste!) |
| `POST` | `/control` gövde `{"cmd":"threshold","value":-70}` | Eşiği değiştirir (-100…-20 arası). Kalıcı olarak kaydedilir. Kaydırıcıda her harekette değil, bıraktıktan ~250 ms sonra gönder. |

Her SSE mesajı durumun **tamamını** taşır, parça parça güncelleme yok.
Her mesajda ekranı baştan çiz, ama animasyonları ve seçimleri koru.

### 5.1 Durum nesnesi: alan alan

```jsonc
{
  "people": [                       // rol sırasıyla: yatırımcılar, girişimciler, misafirler
    {
      "id": "10",                   // kart numarası (string)
      "role": "investor",           // investor | founder | guest
      "name": "Ayşe Demir",
      "org": "Atlas Ventures",
      "color": "#3987e5",           // kişinin sabit rengi
      "stars": "★★★", "tier": 3,    // yıldız (yatırımcı değilse "" ve 0)
      "status": "talking",          // talking | idle | away
      "withName": "Nova Robotik",   // şu an birlikte olduğu kişi(ler), virgülle
      "live": 0.41,                 // şu anki görüşmenin süresi (DAKİKA)
      "min": 12.5,                  // bugün herkesle toplam (DAKİKA)
      "invMin": 9.0,                // karşı rolle toplam (DAKİKA)
      "invPeers": 2,                // karşı rolden kaç farklı kişiyle görüştü
      "seenAgo": 0.1                // kartı en son kaç SANİYE önce duyuldu (null = hiç)
    }
  ],
  "live":  [ {"a":"10","b":"11","real":true,"rssi":-41.3} ],   // şu an birlikte olan çiftler
  "edges": [ {"a":"10","b":"11","min":0.41} ],                  // bugün birlikte geçen toplam DAKİKA, çift başına
  "alerts": [                       // en eski en başta, sadece eklenir
    {
      "t": 1790576569.2, "clock": "09:22",
      "kind": "deal",               // deal | repeat | idle_investor | lost | no_investor
      "severity": "deal",           // deal | warn | serious
      "title": "Potansiyel anlaşma",
      "detail": "Ayşe Demir (★★★) ile Nova Robotik 8 dakikadır birlikte.",
      "people": ["10","11"]
    }
  ],
  "stats": {
    "done": 3,          // biten görüşme sayısı
    "livePairs": 1,     // şu an birlikte çift sayısı
    "mixedMin": 21.4,   // yatırımcı–girişimci toplam dakika
    "deals": 1,         // "potansiyel anlaşma" sayısı
    "reached": 1,       // en az bir yatırımcıyla görüşmüş girişimci sayısı
    "founders": 2       // toplam girişimci
  },
  "receiverAge": 0.1,   // alıcıdan son satır kaç SANİYE önce geldi (null = hiç). >5 ise sorun var.
  "elapsed": 24.7,      // etkinlik başlangıcından beri SANİYE
  "event": {
    "name": "Canlı Demo", "sub": "Yakınlık kartları · gerçek veri",
    "date": "28.09.2026 · Demo odası",
    "progress": null    // 0..1 etkinlik ilerlemesi (süre tanımlı değilse null)
  },
  "clock": "09:22:53",
  "threshold": -72.0,   // şu anki eşik (dBm)

  // ---- teknik / eşik ekranı için ----
  "signals": [          // şu an duyulan her çift, son 10 sn ortancası
    {"a":"10","b":"11",
     "ab":-46.0,        // 10'un 11'i duyduğu güç (null = bu yönde veri yok)
     "ba":-50.0,        // 11'in 10'u duyduğu güç
     "value":-48.0,     // ikisinin ortası: eşikle karşılaştırılan değer budur
     "n":10,            // son 10 sn'deki ölçüm sayısı (düşükse veri seyrek)
     "above":true,      // value >= threshold
     "together":true}   // şu an "birlikte" sayılıyor mu (gecikmelerden sonra)
  ],
  "history": {          // grafik için, son 90 sn, 2 sn'lik ortancalar
    "10-11": [[24.7,-67.0],[24.2,-66.5], ...]   // [kaç sn önce, değer], en eski başta
  },
  "chartSeconds": 90,
  "rules": {"dealAfterS": null}   // masa testi için "anlaşma" süresi saniye olarak zorlanmışsa
}
```

**Dikkat edilecekler:**
- `above: true` ama `together: false` → eşiği geçmiş, 5 sn giriş gecikmesini
  bekliyor (ya da tersi: düşmüş, 15 sn çıkış gecikmesini bekliyor).
  Bu fark teknik ekranda gösterilmeye değer.
- Süreler karışık birimlerde gelir: `live`, `min`, `invMin`, `edges.min`
  **dakika**; `seenAgo`, `receiverAge`, `elapsed` **saniye**. Kullanıcıya
  "3 dk 20 sn", "az önce" gibi insan diliyle göster.
- Listede olmayan bir kart duyulursa sunucu onu kendiliğinden
  `"name":"Kart 14"`, `role:"guest"` olarak ekler. Arayüz bunu
  **"atanmamış kart"** olarak öne çıkarmalı ve "Kişi ata" düğmesi
  göstermeli.

### 5.2 Bildirim türleri (kurallar sunucuda)

| `kind` | Ne zaman | Önem |
|---|---|---|
| `deal` | Yatırımcı + girişimci, yatırımcının yıldızına göre belirlenen süre boyunca kesintisiz birlikte (şu an ★★★ = 8 dk, ★★★★ = 11 dk) | olumlu, en önemli |
| `repeat` | Anlaşma çıkmış bir çift aynı gün tekrar bir araya geldi | olumlu |
| `idle_investor` | ★★★ ve üstü yatırımcı 6 dk'dır kimseyle değil | uyarı |
| `no_investor` | Belirli bir dakikaya gelindi, bazı girişimciler hiç yatırımcıyla görüşmedi (şu an kapalı) | uyarı |
| `lost` | Kart 60 sn'dir duyulmuyor | ciddi |

Proje sahibi şu an bildirimleri geliştirmiyor. Bildirimlerin görünmesi
yeterli, ek özellik (ses, telefona gönderme vb.) şimdilik yok.

---

## 6. Kart atama akışı (tasarlanacak ana özellik)

### 6.1 Bugün nasıl yapılıyor (kötü)
Kişiler `pano/katilimcilar.json` dosyasına elle yazılıyor ve sunucu
yeniden başlatılıyor:

```json
{
  "etkinlik": { "ad": "Canlı Demo", "alt": "…", "tarih": null, "mekan": "Demo odası",
                "baslangic": null, "sure_dk": null },
  "esik_dbm": -61,
  "kurallar": { "anlasma_dk": {"3": 8, "2": 11}, "yalniz_dk": 6,
                "yalniz_min_yildiz": 3, "ulasamadi_dk": null, "kart_kayip_sn": 60 },
  "kisiler": [
    {"kart": 10, "ad": "3", "rol": "investor", "kurum": "", "yildiz": 3, "not": "…"},
    {"kart": 11, "ad": "4", "rol": "founder",  "kurum": "", "not": "…"}
  ]
}
```
(`renk` alanı da verilebilir. Verilmezse listedeki sıraya göre paletten atanır.)

### 6.2 İstenen akış: karşılama masası

Görevli bir tablette/laptopta **"Kart ver"** ekranını açar:

1. **Kişiyi seç ya da yeni kişi oluştur.**
   - Önceden kayıtlı katılımcı listesinden ada göre arama (etkinlik öncesi
     CSV/Excel ile toplu yükleme olabilmeli: ad, soyad, rol, kurum, yıldız).
   - Listede yoksa hızlı form: **Ad**, **Rol** (Yatırımcı / Girişimci /
     Misafir; büyük düğmeler), **Kurum**, rol yatırımcıysa **Yıldız (1–5)**,
     **Not** (isteğe bağlı).
2. **Kartı seç.** İki yol birlikte sunulmalı:
   - **(a) Yaklaştır ve tanı (önerilen):** Ekranda "Kartı alıcıya
     yaklaştırın" yazar. Görevli kartı alıcı cihaza 5–10 cm yaklaştırır.
     Alıcının duyduğu sinyali belirgin şekilde en güçlü olan kart ekranda
     otomatik belirir: "**Kart 14** bulundu ✓". Aynı anda iki kart yakınsa
     "İki kart algılandı, birini uzaklaştırın" der. *(Sunucu tarafı henüz
     yok, bkz. §9 madde 3. Ama veri alıcıda zaten var.)*
   - **(b) Numarayı yaz:** Kartın üstündeki etikette yazan numara elle girilir.
     Sadece şu an duyulan kartlar önerilir (yeşil nokta = "şu an açık").
3. **Kontrol et.** Seçilen kartın durumu gösterilir:
   - açık mı / en son ne zaman duyuldu,
   - pil seviyesi (varsa; bkz. §9),
   - **zaten birine atanmış mı?** Atanmışsa: "Bu kart şu an *Ali Kaya*'da.
     Geri alındı mı?" diye sor. Evet derse eski atama kapanır.
4. **Onayla.** "Ayşe Demir → Kart 14" özet kartı, kişinin rengiyle.
   Onaydan sonra kişi panoda hemen görünür, yeniden başlatma gerekmez.
5. **Sıradaki kişi.** Ekran hemen sıfırlanır, sıra hızlı akmalı.
   Hedef: kişi başına 15 saniyenin altında.

### 6.3 Diğer atama işlemleri

| İşlem | Beklenen davranış |
|---|---|
| **Kart iadesi** (kişi erken çıktı / etkinlik bitti) | Kişi "ayrıldı" olur, kart boşa çıkar. **Geçmiş süreleri silinmez**, raporda kalır. |
| **Kart değişimi** (pil bitti, yeni kart verildi) | Kişi aynı kalır, kartı değişir. Süreler kişide birleşmeli (eski kart + yeni kart). |
| **Yanlış atama düzeltme** | Son birkaç dakikada yapılan atama geri alınabilmeli ("Geri al"). |
| **Kişi bilgisi düzenleme** | Ad/kurum/yıldız/rol etkinlik sırasında değişebilir. Renk değişmez. |
| **Kayıp kart** | `lost` bildirimi → kişinin satırında "Kartı kontrol et" etiketi. Görevli kişiyi bulunca "pil değiştirildi"/"kart değiştirildi" seçebilsin. |
| **Toplu ön yükleme** | Etkinlik öncesi CSV yüklenir, kartlar kapıda atanır. Kartı olmayan kişiler listede "kart bekliyor" olarak görünür. |

### 6.4 Tasarım notları: atama ekranı
- Dokunmatik ve ayakta kullanım: büyük hedefler, az yazı, klavye en son çare.
- Rol seçimi renkle değil **şekil + yazı** ile ayırt edilmeli (mevcut
  panoda: yatırımcı = daire, girişimci = köşesi yuvarlak kare, misafir = baklava).
- Kişinin rengi atama anında belirir ve etkinlik boyunca değişmez.
- Atanmamış ama açık kartlar (masadaki yedekler) ayrı bir "boştaki kartlar"
  şeridinde görünsün, stok takibi için.

---

## 7. Organizatör panosunda olması gerekenler

Mevcut panoda şunlar var. Yeniden tasarla ama işlevleri kaybetme:

1. **Üst şerit:** etkinlik adı, tarih/mekân, saat, eşik değeri +
   "Eşik ayarı" düğmesi, **ALICI BAĞLI / BAĞLI DEĞİL** etiketi, Sıfırla
   (onaylı).
2. **Kişi listesi** (sol): rol grupları (Yatırımcılar / Girişimciler),
   her satırda renk işareti, ad (girişimcide şirket adı öne), yıldız, durum
   ("Nova Robotik ile · 3 dk" / "boşta" / "görünmüyor · 2 dk önce"),
   bugünkü toplam süre, kaç karşı rol kişisiyle görüştüğü.
   Birlikte olanın satırı yeşil vurgulanır.
3. **Ağ görünümü** (orta): her kişi bir düğüm (kişinin rengiyle dolu, rol
   şekliyle), bugün birlikte vakit geçirmiş çiftler arasında çizgi
   (kalınlık = toplam süre), şu an birlikte olan çiftler yeşil ve canlı.
   **Düğümlerin konumu fiziksel konum değildir.** Bunu belli et, düğümler
   sabit dursun, zıplamasın.
4. **Bildirim akışı** (sağ): en yeni en üstte, türüne göre ikon + renk,
   tıklanınca ilgili kişiler vurgulanır.
5. **Alt şerit:** özet sayılar (`stats`) ve etkinlik ilerleme çubuğu.

İyileştirme beklenen yerler:
- **Mobil/tablet düzeni** şu an bozuk (dar ekranda taşıyor).
- Kişi sayısı 50–200'e çıkınca ne olacak? Arama, filtre (rol, durum,
  "hiç görüşmemiş"), sıralama (en uzun görüşen, en yalnız) gerekli.
  Ağ görünümü kalabalıkta okunmaz hale gelir, düşünülmesi lazım.
- Bir kişiye tıklayınca **kişi ayrıntı paneli:** bugün kiminle ne kadar
  (edges'ten), görüşme zaman çizelgesi (bkz. §9), kart bilgisi,
  "kartı değiştir/iade al" kısayolları.

---

## 8. Eşik ayar ekranında olması gerekenler

Şu an bir açılır pencerede duruyor. Ayrı bir "Kurulum" sayfası olabilir.

- **Eşik kaydırıcısı** -95…-35 dBm, anlık değer büyük yazıyla.
- **Canlı grafik:** son 90 sn, her çift bir çizgi (iki kişinin renkleri),
  eşik yatay kesikli çizgi, eşik üstü alan hafif yeşil, çizgi sonlarında
  doğrudan etiket ("3 · 4"), üzerine gelince değer. Bir kişi seçilince
  yalnız onun çiftleri gösterilsin ("perspektif" düğmeleri).
- **Çift tablosu:** iki kişi (renkli), iki yönün değeri ayrı ayrı,
  ortalama, "birlikte sayılır / sayılmaz", ölçüm sayısı.
- **Kalibrasyon sihirbazı** (şu an basit hali var):
  1. İki kartı yüz yüze, konuşma mesafesinde tut → "Kaydet" (10 sn ortanca)
  2. Sırt sırta ya da 2–3 adım uzakta tut → "Kaydet"
  3. "Eşiği ortaya koy" → ikisinin ortası önerilir, onayla.
  Adımlar görsel olarak anlatılmalı (iki insan simgesi yüz yüze / sırt sırta).
- **Kart sağlığı tablosu:** her kart için en son duyulma, paket hızı, pil
  (bkz. §9), "sorunlu" etiketi.
- Burada dBm, yön farkları gibi teknik bilgiler gösterilebilir.
  **Metre yine yok.**

---

## 9. Sunucudan istenecekler (şu an YOK, arayüz için eklenmesi gereken)

Bunları tasarlarken varmış gibi düşün, **sahte veriyle** (mock) çalıştır, ve
bu listeyi netleştirip proje sahibine ver. Önerilen biçimler:

| # | İhtiyaç | Önerilen uç nokta |
|---|---|---|
| 1 | Kişi ekle/düzenle/sil, yeniden başlatmadan | `GET/POST /api/people`, `PATCH/DELETE /api/people/{kisiId}` |
| 2 | Kart atama / iade / değişim (zaman damgalı atama geçmişi) | `POST /api/assign {kisiId, kart}`, `POST /api/unassign {kart}` |
| 3 | "Yaklaştır ve tanı": alıcının her kartı duyduğu güç | `GET /api/cards` → `[{kart, rssiAlici, seenAgo, atanan, pil}]` |
| 4 | Kart pil seviyesi (kart paketinde `batt` alanı var, panoya taşınmıyor) | 3 numarada `pil` alanı |
| 5 | Toplu yükleme | `POST /api/people/import` (CSV) |
| 6 | Görüşme geçmişi (başlangıç–bitiş listesi), zaman çizelgesi ve rapor için | `GET /api/sessions` → `[{a, b, start, end}]` |
| 7 | "Başlıyor…/bitiyor…" ara durumu | `signals[]` içine `pending: "enter"/"exit"` |
| 8 | Etkinlik bilgisi ve kural ayarları (anlaşma süresi, yalnız kalma süresi) | `GET/PATCH /api/event` |
| 9 | Rapor dışa aktarma | `GET /api/report.csv` |

Arayüz ile sunucu arasında bir **veri katmanı** (tek bir `api.js` gibi) kur.
Böylece gerçek uç noktalar geldiğinde sadece o dosya değişir.

---

## 10. Görsel dil ve kurallar

- **Tema:** koyu tema varsayılan (salonda/laptopta uzun süre açık kalıyor).
  Mevcut yüzey `#1a1a19` civarı. Açık tema da olsun (gün ışığında tablet).
- **Kişi renk paleti** (koyu yüzeyde renk körlüğü için doğrulanmış, sırası
  sabit):
  `#3987e5` mavi · `#d95926` turuncu · `#199e70` yeşilimsi · `#c98500`
  hardal · `#d55181` pembe · `#9085e9` mor · `#e66767` mercan. Palet
  biterse `#898781` gri. Açık tema için aynı tonların açık yüzeyde
  doğrulanmış karşılıkları seçilmeli.
  > Not: listedeki `#199e70` yeşile yakın. Yeşil "birlikte" durumuna ayrılmış
  > olduğu için bu renk ya paletten çıkarılsın ya da "birlikte" vurgusu
  > renkten bağımsız bir işaretle (çerçeve, ikon, "birlikte" yazısı)
  > desteklensin. Karar senin, gerekçesini yaz.
- **Yeşil = şu an birlikte.** Başka bir anlam için yeşil kullanma.
- **Durum renkleri ayrılmış:** olumlu (anlaşma), uyarı (yalnız kaldı),
  ciddi (kart kayboldu). Her zaman ikon + yazıyla birlikte, sadece renk
  ile değil.
- **Kimlik asla sadece renkle verilmez:** rengin yanında ad ve rol şekli
  her zaman bulunur.
- **Metin rengi, kişi rengiyle yazılmaz:** kişi rengi yanındaki işarette
  durur, yazılar normal metin renginde kalır.
- **Sakin hareket:** saniyede 2 güncelleme geliyor. Sayılar yumuşak değişsin,
  liste sırası her güncellemede değişmesin (sadece durum değişince, geçişli).
- **Okunabilirlik:** organizatör ekranı 2–3 metreden okunabilmeli (büyük ad,
  büyük durum).
- **Türkçe:** tüm metinler Türkçe, tarih `28.09.2026`, saat `14:05`,
  süre `3 dk 20 sn`.

---

## 11. Teknik kısıtlar ve teslim

- Arayüz, `pano.py`'nin sunduğu aynı adresten (`localhost:8002`) çalışacak.
  Etkinlikte **internet olmayabilir:** CDN'e, uzaktaki fonta, harici bir
  servise bağımlı olma. Tüm dosyalar yerel olsun.
- Tercih: derleme gerektirmeyen düz HTML/CSS/JS, **ya da** derleme adımı
  varsa çıktısı tek bir `dist/` klasörü olsun (sunucu bunu statik
  verecek). Framework serbest, ama ağır olmasın. Ucuz bir tablette de
  akıcı çalışmalı.
- Aynı anda birden fazla ekran açık olabilir (masa tableti + organizatör
  laptopu + salon ekranı). Hepsi aynı SSE akışını dinler.
- Bağlantı koparsa: ekranın üstünde "Sunucuya bağlanılamıyor, yeniden
  deneniyor…" yazsın. Son veri soluk görünsün ama silinmesin.
- Sayfa yenilenince seçili sekme/filtre korunsun (`localStorage`).

### Donanım olmadan geliştirme
- `pano/pano.py --demo --port none` sahte veriyle çalışır (iki kart
  yaklaşıp uzaklaşıyor). Python 3 ve proje klasörü gerekir, proje sahibinden
  iste.
- Ya da §5.1'deki örnek JSON'dan kendi sahte veri üretecini yaz. 20–50
  kişilik, rastgele yaklaşıp ayrılan bir senaryo, kalabalık hali test etmek için
  şart.

### Mevcut arayüz (referans)
`pano/pano.html`: tek dosya, bağımlılık yok. İşlevlerini gör, görselini
körü körüne kopyalama. Ekran görüntüleri: `pano/ss_renkli_pano.png`,
`pano/ss_esik_paneli.png`, `pano/ss_canli_yakinlik.png`.

---

## 12. Öncelik sırası

1. **Organizatör panosu** yeniden tasarımı (mevcut API ile hemen çalışır).
2. **Kart atama ekranı** (önce sahte veriyle, §9'daki uç noktalar gelince bağlanır).
3. **Kurulum/eşik ekranı** (mevcut API ile çalışır).
4. **Kişi ayrıntı paneli + etkinlik sonrası rapor.**
5. Büyük ekran/sunum modu, açık tema, kalabalık (100+ kişi) iyileştirmeleri.

Her aşama sonunda ekran görüntüsü ve kısa bir "neyi neden böyle yaptım"
notu bekleniyor.
