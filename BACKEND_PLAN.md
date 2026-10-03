# Backend Planı — Yakınlık Takip Sistemi Sunucusu

> Hazırlayan: Şevval (arayüz) · 02.10.2026 · Durum: **taslak, uygulamaya başlanmadı** · 03.10.2026: ayrı repoya (`saasBridgeBackend`) taşındı; uygulama sırası `PLAN.md` Bölüm 2
>
> Bu belge, bugün mock ile uçtan uca çalışan arayüzün (`src/`) ihtiyaç duyduğu **gerçek sunucuyu**
> sıfırdan ya da Muhittin'in `server.py` + `pano.py` ikilisini genişleterek yazmak için yol haritasıdır. Arayüz, mock ve
> sözleşme belgesi kardeş repodadır: https://github.com/sevvalcilali/SaasBridge
> Kaynaklar: `UI_TASARIM_BRIEF.md` §2, §5, §9 · `SUNUCUDAN_ISTENENLER.md` (sözleşme) ·
> `mock-server/mock.js` (davranışın çalışan referansı) · `mock-server/*.test.js` (sözleşme testleri).
>
> Okuma sırası: önce **Bölüm 1 (ilkeler)** ve **Bölüm 8 (sözleşme)**, sonra **Bölüm 14 (fazlar)**.
> Diğer bölümler karar alırken ve uygularken başvurulacak ayrıntıdır.

---

## 0. Tek sayfada özet

- **Ne yapılacak:** Alıcıdan (ESP32-S3, USB seri) gelen kart paketlerini okuyan, çift başına "birlikte mi?" kararı
  veren, kişi/kart/atama/görüşme kayıtlarını tutan ve arayüze `GET /state`, `GET /events` (SSE, 2 Hz),
  `POST /control` ile `/api/*` uçlarını **aynı adresten** sunan tek bir sunucu süreci.
- **Değişmeyen şey:** Arayüz. Sözleşme `SUNUCUDAN_ISTENENLER.md`'de kilitli; sunucu bitince arayüzde değişecek
  tek şey `src/api/client.js` → `SUNUCU_ADRESI` (o da aynı kaynaktan servis edilirse boş kalır).
- **Öneri:** Python 3.11+, tek süreç, `asyncio` döngüsü; HTTP için FastAPI + uvicorn; seri için `pyserial`;
  kalıcılık için stdlib `sqlite3` (WAL). Alan mantığı **saf Python modüllerinde**, HTTP ve seri katmanından
  bağımsız; her kural birim testli. Gerekçe ve alternatifler Bölüm 3'te.
- **Doğrulama:** (1) saf çekirdeğe birim testleri, (2) `mock-server/*.test.js` sözleşme testlerinin gerçek sunucuya
  karşı koşturulması, (3) kayıtlı seri izlerinin tekrar oynatılması, (4) arayüzün Faz 2–5 kabul akışları.
- **Fazlar:** B0 iskelet → B1 seri giriş + sinyal → B2 `/state` `/events` `/control` eşdeğerliği → B3 kişi kayıt
  defteri + atama → B4 kartlar → B5 görüşme kayıtları + atama geçmişi → B6 kalıcılık + sıfırlama → B7 sertleştirme
  ve dağıtım → B8 geçiş günü. Her fazın kabul ölçütü yazılı (Bölüm 14).
- **Açık kararlar:** Muhittin'in Soru 1–6'sı ve 3 yeni soru (Bölüm 16). Hiçbiri B0–B2'yi engellemez.

---

## 1. Hedefler, kapsam ve ilkeler

### 1.1 Hedefler
1. Arayüzün bugün mock'tan aldığı **her şeyi** aynı biçimde vermek (`/state`, `/events`, `/control`, `/api/*`).
2. Gerçek donanımdan (alıcı → USB seri) **canlı** veri işlemek; alıcı yokken de çökmeden yayın yapmak.
3. **Kişi ≠ kart** modelini sunucuda doğru tutmak: süreler, kenarlar, görüşme kayıtları kişiye yazılır.
4. Etkinlik günü güvenilirlik: internet yok, tek dizüstü, saatlerce kesintisiz; süreç düşerse veri kaybı yok.
5. Sözleşmenin **test ile kilitli** olması; ileride kural değişince arayüz kırılmadan fark edilmesi.

### 1.2 Kapsam dışı (YAGNI)
- Kimlik doğrulama / çok kullanıcılı yetki (brief §5: yerel ağ, kimlik doğrulama yok).
- Bulut, çoklu etkinlik, çoklu salon, çoklu alıcı birleştirme (ileride istenirse ayrı karar).
- Ses / telefon bildirimi (brief §5.2 kapsam dışı).
- `GET /api/report.csv` (rapor tarayıcıda üretiliyor, `SUNUCUDAN_ISTENENLER.md` §6) — isteğe bağlı, B7 sonrası.
- Mock'a özgü uçlar: `GET /api/demo`, `POST /api/yaklastir`, `POST /api/demo/tut` **gerçek sunucuda OLMAYACAK**
  (arayüz demo düğmelerini `/api/demo` 404 dönünce gizler).

### 1.3 Pazarlıksız ilkeler
| # | İlke | Neden |
|---|---|---|
| İ1 | **Sözleşme önce.** Alan adları, birimler (dakika/saniye), durum kodları `SUNUCUDAN_ISTENENLER.md` ve brief §5.1 ile birebir | Arayüz bunlara göre yazıldı ve testli |
| İ2 | **Saf çekirdek.** Sinyal işleme, çift kararı, süre birikimi, bildirim kuralları, atama kuralları → giriş/çıkış dışı etkisi olmayan fonksiyonlar/sınıflar; zaman parametre olarak gelir | Birim test; seri/HTTP olmadan koşar; tekrar oynatılabilir |
| İ3 | **Tek yazıcı.** Alan durumunu yalnız olay döngüsü (tek görev) değiştirir; seri okuyucu ve HTTP işleyicileri kuyruğa iş bırakır | Kilit yok, yarış yok, deterministik |
| İ4 | **Kişi ≠ kart.** Kart numarası yalnız fiziksel kimliktir; her süre/kenar/kayıt `kisiId`'ye (kişisiz kart için `"kart:N"`) yazılır; `/state` yayınlanırken o anki karta çevrilir | Kart değişiminde süre birleşir, iade edilen kart başkasına geçince devrolmaz |
| İ5 | **Kaybetme.** Kayıt defteri, atamalar, görüşme kayıtları, eşik diske yazılır; süreç yeniden başlayınca kaldığı yerden sürer. Yalnız `POST /control reset` siler | Etkinlik günü tek şans |
| İ6 | **Alıcı yoksa da yayın.** `/events` her 500 ms tam durumu yollar; `receiverAge` büyür, veri donar ama akış kesilmez | Arayüz 6 sn sessizlikte "bağlanılamıyor" gösterir |
| İ7 | **Bağımlılık az, hepsi yerelde kurulabilir.** Etkinlikte internet yok; kurulum paketleri (`wheelhouse/`) repoda ya da USB'de | Brief §11 |
| İ8 | **Kart numaraları 1–99 kişi, 100+ dinleyici cihaz.** Dinleyiciler `people/edges/live/signals/history`'ye girmez; `/api/cards`'ta görünebilir | Brief §2, `SUNUCUDAN_ISTENENLER.md` §8 |
| İ9 | **Metre/cm yok, konum yok.** Sunucu da dBm dışında mesafe üretmez | Ürün kuralı |

---

## 2. Mevcut durum ve boşluk analizi

### 2.1 Bugün elde olan
| Parça | Nerede | Durum |
|---|---|---|
| Kart yazılımı (C3) + alıcı (ESP32-S3) | Muhittin | Çalışıyor; paket biçimi bu repoda **belgelenmemiş** (B1 girdisi) |
| `server.py` | Muhittin | Seri okuma, yumuşatma, eşik −72, 5 sn giriş / 15 sn çıkış, 12 sn paket yok = kopuk |
| `pano/pano.py` | Muhittin | Kişi/rol ekleme, bildirim kuralları, `/`, `/state`, `/events`, `/control`; 2 Hz SSE; `localhost:8002` |
| Arayüz | bu repo `src/` | Faz 0–5 bitti, `dist/` statik servis edilir |
| Mock | `mock-server/mock.js` | `/state` + `/events` + `/control` + tüm `/api/*` uçlarının çalışan referansı; 12 test dosyası |

### 2.2 Arayüzün beklediği ama `pano.py`'de olmayanlar
| Uç | Kullanan ekran | Yoksa ne olur |
|---|---|---|
| `GET/POST /api/people`, `PATCH/DELETE /api/people/{kisiId}` | Masa, rapor, kişi paneli | Masa "sunucuya bağlanılamıyor" bandı |
| `POST /api/people/import` (CSV) | Masa | CSV yükleme hata verir |
| `POST /api/assign`, `POST /api/unassign` | Masa, pano "Kişi ata" | Kart verilemez |
| `GET /api/cards` | Masa (yaklaştır-tanı, boştaki kartlar), Kurulum (kart sağlığı) | Kart listesi boş |
| `GET /api/sessions` | Kişi paneli zaman çizelgesi, rapor | "Görüşme kayıtları alınamadı" |
| `GET /api/assignments` (istenen) | — (henüz arayüzde yok) | "Geri al" sayfa yenilenince unutulur |
| `people[].idleSinceS` (istenen) | Pano "Yalnız kaldı" | Süre gösterilmez, sıralanmaz |

### 2.3 `pano.py` davranışında doğrulanması gerekenler (brief §5 ile çelişebilir)
- Atanmamış duyulan kart `people`'a "Kart N" olarak düşüyor → masadaki yedekler panoda hayalet olur (Soru 1).
- `alerts[].people` kart numarası taşıyor → kart değişiminden sonra eski bildirim yanlış kişiyi vurgular (Yeni Soru 7).
- `/events` alıcı yokken yayın yapıyor mu? Statik `.js` dosyaları doğru MIME ile mi geliyor? (B2 kabul ölçütü.)

---

## 3. Teknoloji seçimi

### 3.1 Öneri: Python 3.11+ (tek süreç, asyncio)
| Katman | Seçim | Gerekçe |
|---|---|---|
| Dil / çalışma zamanı | **Python 3.11+** | Mevcut `server.py`/`pano.py` Python; seri ayrıştırma ve kanıtlanmış histerezis mantığı taşınabilir; Muhittin bakım yapabilir |
| Seri port | **`pyserial`** (okuma ayrı thread → `asyncio.Queue`) | Saf Python, Windows/macOS/Linux'ta derleme gerektirmez; çevrimdışı kurulumu kolay |
| HTTP + SSE | **FastAPI + uvicorn** | Tipli şemalar (pydantic) sözleşmeyi koda döker; SSE `StreamingResponse` ile; test için `httpx` |
| Kalıcılık | **`sqlite3` (stdlib), WAL modu** | Tek dosya, yedeklemesi kopyalamak; yazma hacmi düşük (saniyede birkaç satır) |
| Yapılandırma | `.env`/`config.toml` (stdlib `tomllib`) | Port, seri aygıt, eşik varsayılanı, etkinlik adı |
| Test | `pytest`, `pytest-asyncio`, `httpx` | Saf çekirdek + HTTP sözleşme |
| Paketleme | `pyproject.toml`, `pip wheel` → `wheelhouse/`, tek `baslat.(sh|bat)` | Çevrimdışı kurulum |

**Bağımlılık listesi (tamamı):** `fastapi`, `uvicorn[standard]`, `pydantic` (fastapi ile gelir), `pyserial`; geliştirme:
`pytest`, `pytest-asyncio`, `httpx`. Başka bağımlılık **onaysız eklenmez** (PLAN Bölüm 0 kuralı sunucu için de geçerli).

### 3.2 Alternatifler ve ne zaman tercih edilir
| Seçenek | Artı | Eksi | Ne zaman |
|---|---|---|---|
| **A. Python stdlib-only** (`http.server` + `ThreadingHTTPServer`, el yazımı SSE) | Sıfır bağımlılık, `pano.py` zaten böyle | Doğrulama/şema elle; SSE ve eşzamanlılık daha kırılgan; test altyapısı zayıf | Bağımlılık kesinlikle istenmiyorsa |
| **B. Node.js — mock'u gerçek sunucuya evriltmek** | `mock.js` sözleşmenin tamamını zaten uyguluyor ve 12 test dosyası var; `tik()` benzetimi seri girişle değiştirilir; aynı dil, aynı testler | Seri port için `serialport` **yerel (native) modül**: Windows'ta çevrimdışı kurulumu zor; Muhittin'in Python kodu yeniden yazılır | Sunucuyu arayüz ekibi yazacak ve Muhittin bakım yapmayacaksa; seri okuma ayrı küçük bir Python köprüsüyle (TCP/stdin) çözülürse |
| **C. Python + FastAPI (öneri)** | Yukarıda | 3 bağımlılık; uvicorn + pyserial thread köprüsü gerekir | Varsayılan |

**Karar:** C. Muhittin'in donanım bilgisi Python'da; arayüz tarafı Node'dan bağımsız kalır; sözleşme testleri (`mock-server/*.test.js`)
dil fark etmeksizin HTTP üzerinden koşar (Bölüm 12.2). B seçeneği, seri köprüsü ayrı yazılacaksa ciddi bir "hızlı yol"dur;
karar Muhittin'le birlikte verilir (Yeni Soru 9).

---

## 4. Mimari

### 4.1 Katmanlar
```
 USB seri                    ┌────────────────────────────────────────────────────┐
 (alıcı) ──► [1] Giriş ─────►│ [2] Paket ayrıştırma  → Paket{kaynak, duyulanlar[],  │
                              │                          batt, t}                  │
                              └──────────────┬─────────────────────────────────────┘
                                             ▼  asyncio.Queue
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │  OLAY DÖNGÜSÜ (tek yazıcı, 500 ms tik)                                        │
 │  [3] Sinyal işleme   çift başına ölçüm penceresi (10 sn ortanca, 90 sn grafik) │
 │  [4] Çift kararı     eşik · 5 sn giriş · 15 sn çıkış · 12 sn paket yok        │
 │  [5] Alan modeli     kişi · kart · atama · kenar · görüşme kaydı · bildirim    │
 │  [6] Durum üretici   /state nesnesi (kişi→kart çevrimi, birim dönüşümleri)    │
 └───────────┬───────────────────────────────┬───────────────────────────────────┘
             ▼                               ▼
      [7] HTTP + SSE                  [8] Kalıcılık (SQLite)
      /state /events /control         kayıt defteri · atamalar · görüşmeler ·
      /api/*  · dist/ statik          ayarlar · bildirimler · anlık görüntü
```

- [1]–[2] **Giriş:** `PaketKaynagi` arayüzü. Üç uygulama: `SeriKaynak` (pyserial, ayrı thread), `KayitKaynak`
  (kaydedilmiş iz dosyasını zamanlamasıyla oynatır — test ve demo), `BenzetimKaynak` (mock'un `tik()` dinamiğinin
  Python'u; donanımsız geliştirme). Hepsi aynı `Paket` nesnesini kuyruğa bırakır. Seri satır biçimi **B1'in ilk işi** olarak
  Muhittin'den alınıp `docs/backend/SERI_PROTOKOL.md`'ye yazılır; ayrıştırıcı o belgeye göre birim testlidir.
- [3]–[5] **Çekirdek (saf):** zaman dışarıdan verilir (`simdi: float`), I/O yok. Mock'taki `tik()`/`durumUret()` ile
  **aynı kararları** verir; mock bu yüzden "çalışan şartname"dir.
- [6] **Projeksiyon:** Alan modeli kişi bazlı; `/state` kart bazlı. Çevrim yalnız burada yapılır.
- [7] **HTTP:** ince katman; doğrulama + çekirdek çağrısı + JSON. İş kuralı burada yazılmaz.
- [8] **Kalıcılık:** olay döngüsü içinden, tik sonunda toplu (`executemany`), WAL; okuma uçları bellek modelinden döner.

### 4.2 Modül yerleşimi (öneri)
```
saasBridgeBackend/
├─ pyproject.toml · README.md · baslat.sh · baslat.bat
├─ config.toml                 # port, seri aygıt, eşik varsayılanı, etkinlik adı/tarihi, veri dosyası yolu
├─ yakinlik/
│  ├─ __main__.py              # python -m yakinlik  (argümanlar: --port --seri --kaynak seri|kayit|benzetim --veri)
│  ├─ giris/
│  │  ├─ paket.py              # Paket dataclass + ayrıştırıcı (saf)
│  │  ├─ seri.py               # pyserial thread → Queue
│  │  ├─ kayit.py              # iz dosyası oynatıcı / kaydedici
│  │  └─ benzetim.py           # donanımsız dinamik (mock tik() eşdeğeri)
│  ├─ cekirdek/                # SAF — I/O yok, zaman parametre
│  │  ├─ sinyal.py             # pencere, ortanca, grafik kovaları
│  │  ├─ cift.py               # histerezis, together, birlikteSn
│  │  ├─ kisi.py               # kayıt defteri, renk ataması, doğrulama
│  │  ├─ atama.py              # ata / iade / geri al / değişim + geçmiş
│  │  ├─ oturum.py             # görüşme kayıtları (kişi bazlı)
│  │  ├─ kenar.py              # kişi çifti → dakika; kart değişiminde birleşme
│  │  ├─ bildirim.py           # deal / repeat / idle_investor / lost / no_investor
│  │  ├─ csv_ice.py            # CSV ayrıştırma (ayraç/başlık/tırnak/BOM)
│  │  └─ durum.py              # /state projeksiyonu (kişi→kart, birimler)
│  ├─ motor.py                 # olay döngüsü: kuyruk → çekirdek → yayın → kalıcılık
│  ├─ depo/
│  │  ├─ sema.sql · sqlite.py  # tablolar, WAL, anlık görüntü, yükleme
│  ├─ http/
│  │  ├─ uygulama.py           # FastAPI app, statik dist/, MIME
│  │  ├─ durum_uclari.py       # /state /events /control
│  │  ├─ api_uclari.py         # /api/people … /api/sessions
│  │  └─ semalar.py            # pydantic istek/yanıt modelleri = sözleşme
│  └─ ayar.py                  # config yükleme
└─ tests/
   ├─ cekirdek/…               # saf birim testleri (zaman sabit)
   ├─ http/…                   # httpx ile sözleşme
   ├─ izler/*.jsonl            # kayıtlı seri izleri (altın dosyalar)
   └─ kabul/README.md          # mock-server/*.test.js'i gerçek sunucuya karşı koşturma
```

---

## 5. Veri modeli

### 5.1 Varlıklar
| Varlık | Anahtar | Alanlar | Not |
|---|---|---|---|
| **Kişi** (`Katilimci`) | `kisiId` (`"k12"`, kalıcı) | `ad, rol(investor/founder/guest), kurum, yildiz(0–5), not, renk, atananKart|null, ayrildi, olusturma_t` | `renk` doğumda atanır, **değişmez**; `yildiz` rol yatırımcı değilse 0 |
| **Kart** (`Kart`) | `kart` (`"14"`, 1–99) | `sonDuyulma_t, rssiAlici, pil` | Türetilir: alıcının duyduğu her kart; 100+ dinleyici ayrı kümede |
| **Atama** (`Atama`) | `(kisiId, kart, baslangic_t)` | `bitis_t|null, islem(ata/iade/geri_al/degisim)` | Zaman damgalı geçmiş (`GET /api/assignments`); açık atama = `bitis_t null` |
| **Kenar** (`Kenar`) | `kimlikCifti` (`"k3|k7"`, sıralı) | `dakika, karsiRol` | Kişi kimliği; kişisiz kart için `"kart:14"`; `/state.edges` çevrimle üretilir |
| **Görüşme kaydı** (`Oturum`) | `(kimlikA, kimlikB, start)` | `end|null` (etkinlik saniyesi) | `/api/sessions`; kart iade/değişiminde açık kayıt kapanır |
| **Çift ölçümü** (`CiftDurumu`) | `(kartA, kartB)` küçük-büyük | `olcumler[(t, ab, ba, value)], ustundeSn, altindaSn, together, birlikteSn, anlasmaVerildi, sonDuyulma_t` | Bellekte; diske yazılmaz (yeniden başlatmada 5/15 sn gecikmeyle kendini toparlar) |
| **Bildirim** (`Bildirim`) | sıra no | `t, clock, kind, severity, title, detail, people[kart], kisiler[kisiId]` | Yalnız eklenir; `kisiler` yeni alan (Yeni Soru 7) |
| **Ayarlar** | tek satır | `esik, etkinlikAdi, altBaslik, tarih, baslangic_t, sure_dk|null, anlasmaSn|null` | Eşik kalıcı (brief §5) |
| **Kimlik** (`kimlik(kart)`) | — | `atanan kişi varsa kisiId, yoksa "kart:N"` | Tüm süre/kenar/kayıt bu kimliğe yazılır (mock: `kimlik()`) |

### 5.2 Değişmezler (test edilecek)
1. Bir kişinin en fazla **bir** açık ataması vardır; bir kartın en fazla **bir** açık ataması vardır.
2. `ayrildi = true` ⇒ `atananKart = null`. `atananKart ≠ null` ⇒ `ayrildi = false`.
3. Kenar dakikaları yalnız `together` tiklerinde artar; başladığı tik de sayılır (mock testi `oturum.test.js` ile aynı).
4. Çift başına görüşme kaydı sürelerinin toplamı ≈ `edges[].min` (±1 tik).
5. `kart:N` kimliğine yazılmış kayıtlar, N'ye kişi atanınca o kişiye **geçer**; iade edilen kartın süreleri yeni sahibine **geçmez**.
6. Kart değişiminde (kişi A: 14 → 22) A'nın kenarları/kayıtları bölünmez; `/state`'te 22 ile görünür.
7. `/state.people[].id` ve `edges[].a/b`, `live`, `alerts[].people` o anki kart numarasıdır; kartsız kişi `/state`'te yoktur.
8. 100+ numaralı cihaz `people/edges/live/signals/history`'de **asla** yoktur.
9. `clock` ve `elapsed` aynı tikte, aynı andan hesaplanır.
10. `reset`: süreler, kenarlar, kayıtlar, bildirimler, atama geçmişi **silinir**; kayıt defteri (kişiler) ve açık atamalar ile eşik **kalır** (mock `sifirla()` ile aynı; Yeni Soru 8 bunu teyit eder).

---

## 6. Zaman modeli

| Saat | Ne | Kullanım |
|---|---|---|
| **Duvar saati** `time.time()` | gerçek zaman | `alerts[].t`, `clock`, `atama.t`, kalıcılık damgaları |
| **Etkinlik saniyesi** `elapsed` | `time.monotonic() − baslangic` (reset'te 0) | `sessions.start/end`, `history` "kaç sn önce", `seenAgo`, `receiverAge` |
| **Tik** | 500 ms sabit; `DT` = tik arası gerçek fark (donmaları telafi etmek için ölçülür, 0.5 varsayılır) | süre birikimi, histerezis sayaçları |

- Alıcı kopukken (`receiverAge > 12`) ölçüm gelmez; sayaçlar **ilerlemez**, `seenAgo`'lar büyür, yayın sürer (İ6).
- Süreç yeniden başlarsa `elapsed` diskteki `baslangic_t` üzerinden sürer (etkinlik saati sıfırlanmaz).
- Hızlandırma yok (gerçek zaman); test için zaman **enjekte edilir** (`Saat` arayüzü: `simdi()`, `monotonic()`).

---

## 7. Sinyal işleme ve karar kuralları (mock ile birebir)

| Kural | Değer | Kaynak |
|---|---|---|
| Çift anahtarı | `"küçükNo-büyükNo"` | brief §5.1 |
| Ölçüm | her paketten `ab`, `ba` (biri eksikse `null`), `value` = ikisi varsa ortalama yoksa olan | brief §5.1 |
| Karşılaştırılan değer | son **10 sn** ölçümlerinin **ortancası** | `SUNUCUDAN_ISTENENLER.md` §5 (kalibrasyon bunu ölçer) |
| Eşik | varsayılan −72 dBm; `/control threshold` −100…−20; **kalıcı** | brief §2, §5 |
| Giriş gecikmesi | 5 sn kesintisiz üstte → `together = true`, görüşme kaydı açılır | brief §2 |
| Çıkış gecikmesi | 15 sn kesintisiz altta → `together = false`, kayıt kapanır, `stats.done++` | brief §2 |
| `signals[].n` | 10 sn penceresindeki ölçüm sayısı | brief §5.1 |
| `history` | son 90 sn, 2 sn'lik kovaların ortancası, en eski başta, `[snÖnce, dBm]` | brief §5.1 |
| Çift unutma | ne together ne de 30 sn'dir duyulmuş → çift silinir | mock |
| `seenAgo` | kartın son paketinden beri sn | brief §5.1 |
| `receiverAge` | alıcıdan son satırdan beri sn; 12 sn → kopuk | brief §2 |
| `lost` bildirimi | kart 60 sn duyulmadı → `serious`; tekrar duyulunca bayrak sıfırlanır | brief §5.2 |
| `deal` | yatırımcı+girişimci kesintisiz birlikte; süre yatırımcı yıldızına göre: ★★ 11 dk · ★★★ 8 dk · ★★★★ 11 dk · ★★★★★ 8 dk (mock); `rules.dealAfterS` zorlanabilir | brief §5.2/§6.1 — **Yeni Soru 10: tablo Muhittin'le teyit** |
| `repeat` | anlaşma çıkmış **kişi çifti** aynı gün yeniden birlikte | brief §5.2 |
| `idle_investor` | ★★★+ yatırımcı 6 dk kimseyle değil ve kartı duyuluyor (`seenAgo < 30`) → `warn`; bir kez | brief §5.2 |
| `no_investor` | kapalı (bayrakla açılabilir) | brief §5.2 |
| `idleSinceS` | kişinin kesintisiz boşta kaldığı sn (`idle_investor` sayacının herkese genellenmiş hali) | `SUNUCUDAN_ISTENENLER.md` §9 |
| İade/değişimde açık çift | o çift kapatılır, eşi serbest bırakılır; kenar dakikası korunur | `SUNUCUDAN_ISTENENLER.md` §2 |

Yumuşatma seçimi: `server.py`'deki mevcut yumuşatma korunacaksa **ortanca ile aynı sonucu verdiği** ölçülmeli
(B1'de kayıtlı izle karşılaştırma). Vermiyorsa sözleşme (ortanca) kazanır; kalibrasyon ekranı buna göre yazıldı.

---

## 8. API sözleşmesi

Tam alan listeleri `SUNUCUDAN_ISTENENLER.md`'de; burada **durum kodları, kenar durumlar ve yapılmaması gerekenler**.
Tüm uçlar aynı host:port (CORS yok). Gövdeler JSON, hata `4xx {"ok": false, "hata": "…"}`; arayüz koda bakar, metni göstermez.

### 8.1 Mevcut uçlar (brief §5) — değişmeden
| Uç | Kurallar |
|---|---|
| `GET /` ve statik | `dist/` içeriği; `index.html` için `/`, `/?clean=1`; **`.js` → `text/javascript`**, `.css` → `text/css`, `.svg`, `.woff2` doğru MIME (Windows'ta Python `mimetypes` kayıt defterinden `text/plain` okuyabilir → açıkça eşle) |
| `GET /state` | brief §5.1 nesnesi; `Content-Type: application/json; charset=utf-8`; `Cache-Control: no-store` |
| `GET /events` | `text/event-stream`; bağlanır bağlanmaz ilk durum; sonra her tik (500 ms); satır sonu `\n` ya da `\r\n` (arayüz ikisini de okur); `Cache-Control: no-cache`, `X-Accel-Buffering: no`; kopan istemci sessizce düşürülür; yavaş istemcide tampon birikirse bağlantı kapatılır (arayüz yeniden bağlanır) |
| `POST /control {"cmd":"reset"}` | Bölüm 5.2 madde 10; `200 {"ok":true}` |
| `POST /control {"cmd":"threshold","value":-68}` | −100…−20 dışı ya da sayı değil → 400; başarıda **2xx** ve kalıcı yazım |

### 8.2 `/api/*` uçları
| Uç | 2xx | 4xx | Kenar durumlar |
|---|---|---|---|
| `GET /api/people` | `Kisi[]` | — | Ayrılanlar dahil (rapor kullanır) |
| `POST /api/people` | `201`/`200 Kisi` | boş `ad` 400; geçersiz `rol` 400 | `yildiz` kırpılır; `renk` sunucu atar |
| `PATCH /api/people/{id}` | `Kisi` | 404 | `renk`/`kisiId` yok sayılır; kartı varsa `/state` hemen güncellenir |
| `DELETE /api/people/{id}` | `{ok:true}` | 404 | Kartı varsa önce iade; süreleri silinsin mi → Soru 4 (varsayılan: **silinmez**, kişi `silindi` işaretlenir) |
| `POST /api/people/import` (`text/csv`) | `{eklenen, atlanan[]}` | boş gövde 400 | ayraç `; , \t` ilk satırdan; başlık Türkçe/harfsiz; tırnak+`""`; BOM atılır; yinelenen ad+kurum atlanır; her zaman UTF-8 gelir |
| `POST /api/assign {kisiId, kart}` | `{ok:true}` | 404 kişi yok; 400 kart 1–99 değil / baştaki sıfırlı | Kart başkasındaysa eski atama kapanır (`ayrildi` **değişmez**); kişinin başka kartı varsa değişim (kenarlar birleşir, açık çiftler kapanır); `ayrildi=false`; `kart:N` kayıtları kişiye geçer; geçmişe `ata`/`degisim` yazılır |
| `POST /api/unassign {kart, ayrildi?}` | `{ok:true}` | 400 geçersiz no; 404 kart atanmamış | `ayrildi` varsayılan `true`; `false` = geri al; açık çift kapatılır; süreler **silinmez**; geçmişe `iade`/`geri_al` |
| `GET /api/cards` | `[{kart, rssiAlici, seenAgo, atanan, pil}]` | — | Alıcının duyduğu **tüm** kartlar (atanmış, yedek, iade dönmüş); 100+ dahil olabilir; 1–3 sn'de bir yoklanır → ucuz olmalı |
| `GET /api/sessions` | `[{a, b, start, end}]` | — | kişi kimliği ya da `"kart:N"`; etkinlik saniyesi, 1 ondalık; `end:null` sürüyor |
| `GET /api/assignments` | `[{t, kisiId, kart, islem}]` | — | **Yeni**; arayüz "Geri al"ı buna taşıyacak (ayrı arayüz işi) |
| `GET /api/demo`, `/api/yaklastir`, `/api/demo/tut` | **404** | | Mock'a ait; gerçek sunucuda **tanımlanmaz** |

### 8.3 `/state`'e eklenecek alanlar (geriye uyumlu)
| Alan | Değer | Durum |
|---|---|---|
| `people[].idleSinceS` | kesintisiz boşta sn, birlikteyken `0` | istendi (§9) |
| `alerts[].kisiler` | `people` ile aynı sırada `kisiId`'ler | Yeni Soru 7 |
| `people[].atanmamis` | `true` = kişiye atanmamış kart sahnede | Soru 1'in cevabına göre |

### 8.4 Şema disiplini
- Her istek/yanıt gövdesi `http/semalar.py`'de pydantic modeli; **bilinmeyen alanlar yok sayılır**, eksik zorunlu alan 400.
- Yanıt örnekleri `SUNUCUDAN_ISTENENLER.md`'den **test fikstürü** olarak kopyalanır; sözleşme değişirse iki belge birlikte güncellenir.
- Gövde sınırı 1 MB (CSV için yeterli); üstü 413.

---

## 9. Kalıcılık

### 9.1 Şema (SQLite, WAL)
```sql
CREATE TABLE kisi      (kisi_id TEXT PRIMARY KEY, ad TEXT NOT NULL, rol TEXT NOT NULL, kurum TEXT, yildiz INT,
                        notu TEXT, renk TEXT NOT NULL, ayrildi INT NOT NULL DEFAULT 0, silindi INT NOT NULL DEFAULT 0,
                        olusturma_t REAL NOT NULL);
CREATE TABLE atama     (id INTEGER PRIMARY KEY, kisi_id TEXT NOT NULL, kart TEXT NOT NULL, islem TEXT NOT NULL,
                        t REAL NOT NULL, bitis_t REAL);                      -- açık atama: bitis_t IS NULL
CREATE TABLE oturum    (id INTEGER PRIMARY KEY, kimlik_a TEXT, kimlik_b TEXT, start_s REAL NOT NULL, end_s REAL);
CREATE TABLE kenar     (kimlik_a TEXT, kimlik_b TEXT, dakika REAL NOT NULL, karsi_rol INT, PRIMARY KEY (kimlik_a, kimlik_b));
CREATE TABLE bildirim  (id INTEGER PRIMARY KEY, t REAL, clock TEXT, kind TEXT, severity TEXT, title TEXT, detail TEXT,
                        people TEXT, kisiler TEXT);                           -- JSON dizileri
CREATE TABLE anlasma   (kimlik_a TEXT, kimlik_b TEXT, PRIMARY KEY (kimlik_a, kimlik_b));
CREATE TABLE ayar      (anahtar TEXT PRIMARY KEY, deger TEXT);               -- esik, baslangic_t, etkinlik.*
```
- `kimlik_*` = `kisiId` ya da `"kart:N"`; kart→kişi devri `UPDATE … SET kimlik_a='k12' WHERE kimlik_a='kart:14'`.
- Yazma kadansı: her tik sonunda yalnız **değişen** kenarlar (`executemany`), kapanan/açılan oturumlar, yeni bildirimler;
  tek işlem (`BEGIN … COMMIT`). 500 çiftte bile saniyede < 100 satır.
- Okuma: `GET /api/*` bellek modelinden döner; SQLite yalnız **açılışta yükleme** ve **yazma** içindir.
- Çift ölçüm pencereleri, histerezis sayaçları diske yazılmaz (yeniden başlatmada ≤15 sn'de toparlanır).

### 9.2 Yeniden başlatma
1. Şema varsa yükle; yoksa oluştur. 2. Kişiler + açık atamalar → bellek. 3. Kenarlar, anlaşmalar, bildirimler, oturumlar.
4. Açık oturumlar (`end_s IS NULL`): yeniden başlatma anında `end_s = elapsed` ile **kapatılır** (gerçekte sürüyorsa 5 sn sonra yeni kayıt açılır;
   rapor dürüst kalır). 5. `elapsed` = `monotonic() − (şimdi − baslangic_t)`.

### 9.3 Yedek
- Dosya: `veri/etkinlik-YYYY-MM-DD.sqlite`; `baslat.sh` açılışta `veri/yedek/` altına kopya alır.
- `reset` öncesi otomatik kopya (`…-reset-HHMMSS.sqlite`): yanlışlıkla sıfırlama geri alınabilir.

---

## 10. Eşzamanlılık ve performans

- **Tek olay döngüsü, tek yazıcı (İ3).** Seri thread yalnız kuyruğa `Paket` koyar. HTTP işleyicileri alan durumunu
  değiştiren işleri (`assign`, `unassign`, `people`, `control`) `motor.komut(...)` ile döngüye verir ve `Future` ile sonucu bekler;
  okuma uçları son yayınlanan **dondurulmuş** `/state` anlık görüntüsünü döner (JSON bir kez üretilir, tüm SSE istemcilerine aynı bayt yazılır).
- **SSE yayın:** her tikte `durumUret()` **bir kez**, `json.dumps` **bir kez**; N istemciye aynı tampon. Yavaş istemci: yazma kuyruğu
  > 5 mesaj birikirse bağlantı kapatılır (arayüz yeniden bağlanır, "bağlanılamıyor" 6 sn eşiğine takılmaz).
- **Bütçe (97 kişi, ~500 çift):** mock'ta `/state` 33 KB → 220 KB (20 dk; neredeyse tamamı `signals` + `history`).
  Hedef: tik işleme < 50 ms, JSON < 20 ms. Ölçüm B7'de; aşarsa seçenekler sırayla: (a) `history` yalnız son 90 sn ve 2 sn kovalı (zaten),
  (b) `history`'yi yalnız bir Kurulum istemcisi bağlıyken göndermek (`/events?teknik=1` isteğe bağlı parametre — arayüz değişikliği
  gerektirir, ayrı karar), (c) ölçüm penceresini `collections.deque` ile O(1) tutmak.
- **Seri hacmi:** 97 kart × saniyede birkaç paket × duyduğu komşular → saniyede birkaç bin ölçüm; ayrıştırma thread'de, çekirdeğe toplu teslim (tik başına liste).

---

## 11. Ağ, güvenlik, dayanıklılık

- Dinleme: varsayılan `0.0.0.0:8002` (masa tableti ve salon ekranı başka cihaz). Ayarla `127.0.0.1`'e kısıtlanabilir.
- Kimlik doğrulama yok (brief §5); ağ etkinlik Wi-Fi'ı. **Yıkıcı işlemler** yalnız `reset` ve `DELETE` — ikisi de loglanır, `reset` öncesi yedek.
- Girdi doğrulama: kart no `^[1-9][0-9]?$`; `rol` enum; metinler 200 karakter kırpılır; CSV 1 MB.
- Hata yalıtımı: bir uçtaki istisna 500 döner, döngüyü **düşürmez** (mock'taki `.catch` eşdeğeri); seri okuma hatası (aygıt çekildi) → kaynak yeniden açmayı 2 sn aralıkla dener, `receiverAge` büyür, yayın sürer.
- Günlük: `yakinlik.log` (döner, 5×5 MB): açılış/kapanış, seri aç/kapa, her `/control` ve `/api` yazma isteği, bildirimler; **ölçümler loglanmaz** (hacim). Ayrıca `--kaydet iz.jsonl` ile ham paket izi kaydı (test altın dosyaları için).
- Sağlık: `GET /api/health` → `{ok, receiverAge, istemciSayisi, surum}` (arayüz kullanmaz; operatör için — isteğe bağlı, B7).

---

## 12. Test stratejisi

### 12.1 Saf çekirdek birim testleri (`pytest`)
- Her kural için zaman enjekte edilerek: histerezis (4,9 sn üstte → yok, 5 sn → var; 14,9 altta → sürüyor), ortanca penceresi,
  `lost` 60 sn, `idle_investor` 6 dk, `deal` yıldız tablosu, `repeat` kişi çifti ile (kart değişse de), kenar birleşme/devretmeme,
  `kart:N` devri, `reset` kapsamı, CSV ayrıştırma (`;`/`,`/sekme, BOM, tırnak, Türkçe başlık, yinelenen ad+kurum, satır no).
- Mock'un test dosyaları (`mock-server/oturum.test.js`, `degisim.test.js`, `iade.test.js`, `iceaktar.test.js`, `stok.test.js`,
  `kalibrasyon.test.js`, `saglamlik.test.js`) **senaryo listesi** olarak Python'a taşınır — aynı adlar, aynı beklentiler.

### 12.2 Sözleşme testleri (arayüzün gözünden)
- `mock-server/*.test.js` dosyaları HTTP kara kutu testleridir ama her biri kendi mock'unu başlatır. Küçük bir değişiklikle
  (`SUNUCU=http://localhost:8002 node --test mock-server/`) **dış sunucuya karşı** koşabilir hale getirilir (arayüz tarafında ayrı küçük iş;
  benzetim senaryolarına bağlı testler — Kart 14 45. sn, kayıp kart — `BenzetimKaynak` ile koşar, seri ile atlanır).
- `tests/http/`: `httpx` ile her uç için 2xx/4xx ve şema; SSE ilk mesaj + 2 Hz kadans (1,5 sn'de ≥2 mesaj); `\r\n`.
- Statik: `/` 200 `text/html`; `/assets/*.js` `text/javascript`.

### 12.3 İz tekrar oynatma (altın dosyalar)
- Gerçek alıcıdan kaydedilmiş 5–10 dk'lık izler (`tests/izler/*.jsonl`: iki kart yaklaşıp uzaklaşıyor; sırt sırta; pil bitişi; alıcı çekilmesi).
- Beklenen çıktı: oturum listesi + kenar dakikaları (`*.beklenen.json`). Çekirdek değişince fark görünür.
- Aynı izle `server.py`'nin eski kararları karşılaştırılır (B1 kabulü: ≥ %95 aynı `together` tikleri ya da farklar açıklanmış).

### 12.4 Arayüz kabul akışları (uçtan uca)
- Arayüzün Faz 2 (11), Faz 3 (16), Faz 4 (13), Faz 5 (15) kabul ölçütleri `docs/faz*/…TESLIM.md`'de. Gerçek sunucu + `npm run build`
  + `dist/` servis edilerek **elle ve Playwright ile** (390 / 768 / 1280 genişlik) geçilir. Bu betikler repoda değil; B8'de yazılır.
- Donanımsız: `--kaynak benzetim` ile aynı akışlar (Kart 14 45. sn, kayıp kart 180–300 sn, alıcı kopması 120. sn — mock ile aynı zamanlama ki arayüz kabul betikleri aynen çalışsın).

### 12.5 Yük
- `--kaynak benzetim --kisi 97` ile 30 dk: tik süresi, JSON boyutu, bellek (hedef: tik < 50 ms, RSS < 300 MB, büyüme yok). 5 SSE istemcisi (masa, pano, salon, kurulum, rapor).

---

## 13. Dağıtım ve çalıştırma

- **Tek komut:** `baslat.sh` / `baslat.bat` → sanal ortam yoksa `wheelhouse/`'tan kur (`pip install --no-index --find-links wheelhouse -r requirements.txt`), `python -m yakinlik --seri COM5|/dev/ttyUSB0 --port 8002 --dist ../dist`.
- **Seri aygıt bulma:** `--seri auto` → `serial.tools.list_ports` ile ESP32-S3 (VID/PID Muhittin'den) seçilir; bulunamazsa uyarı + alıcısız başlar.
- **Statik:** `dist/` yolu ayarlanabilir; yoksa `/` 200 "arayüz derlenmedi" metni (süreç yine çalışır).
- **Windows notları:** MIME eşlemesi elle (Bölüm 8.1); COM port izni; güç tasarrufu USB'yi uyutmasın (dağıtım notuna yazılır).
- **Çalıştırma kontrol listesi (etkinlik sabahı):** alıcı takılı → `receiverAge < 2` · `/state` 200 · `/events` 2 Hz · `/api/cards` yedekleri gösteriyor · eşik dünkü değer · yedek alındı · `dist/` güncel (`npm run build` tarihi).
- **Sürümleme:** `yakinlik/__init__.py` `__surum__`; `/api/health`'te; `git tag b7-…`.

---

## 14. Fazlar, teslimler ve kabul ölçütleri

Süreler tek kişi, tam gün içindir; donanım erişimi B1 ve B8'de şarttır. Her faz kendi dalı/commit'i, her fazın sonunda `docs/backend/Bn_NOT.md`.

| Faz | Kapsam | Çıktı | Kabul ölçütü | Süre |
|---|---|---|---|---|
| **B0 İskelet** | Proje yapısı, `config`, `Saat` arayüzü, boş çekirdek, FastAPI app, `dist/` statik, `/api/health`, pytest + httpx kurulu, `wheelhouse/` | `python -m yakinlik --kaynak benzetim` açılır; `/` arayüzü verir | `GET /` 200 ve `.js` doğru MIME; testler koşuyor (boş) | 1 gün |
| **B1 Seri giriş + sinyal** | Seri protokol belgesi (Muhittin), `Paket` ayrıştırıcı, `SeriKaynak`, `KayitKaynak` (+kaydet), `sinyal.py` (10 sn ortanca, 90 sn kovalar), 100+ eleme | Kayıtlı iz dosyaları (`tests/izler/`) | Ayrıştırıcı birim testleri; iz tekrar oynatıldığında `signals[].value` eski `server.py` ile karşılaştırılmış ve fark raporlanmış | 2–3 gün |
| **B2 `/state` `/events` `/control` eşdeğerliği** | `cift.py` histerezis, kenar, `durum.py` projeksiyonu, `stats`, `event`, SSE yayını (alıcı yokken de), `threshold` kalıcı, `reset`; `bildirim.py` 5 tür; `idleSinceS` | Pano + Kurulum + Sunum gerçek sunucuyla çalışır | Brief §5.1 alanlarının tamamı; 2 Hz (1,5 sn'de ≥2 mesaj) alıcı çekiliyken de; `kontrast`/`kurulum` ekranı eşik değiştirip geri okuyor; `pano` 6 sn'de "bağlanılamıyor" göstermiyor; Faz 1/3/5 kabulü `--kaynak benzetim` ile | 3 gün |
| **B3 Kişi kayıt defteri + atama** | `kisi.py`, `atama.py`, `/api/people` (GET/POST/PATCH/DELETE), `/api/people/import`, `/api/assign`, `/api/unassign`, `kimlik()` ile kenar/kayıt devri, açık çift kapatma | Masa ekranı gerçek sunucuyla | `mock-server/{api,degisim,iade,iceaktar}.test.js` senaryoları Python'da yeşil; Faz 2 kabul akışı 11/11 (benzetim) | 3 gün |
| **B4 Kartlar** | `/api/cards` (tüm duyulan kartlar, `rssiAlici`, `seenAgo`, `pil`, `atanan`), yedek kart davranışı (Soru 1 kararı), `people[].atanmamis` (gerekirse) | Masa "yaklaştır ve tanı", boştaki kartlar şeridi, Kurulum kart sağlığı | `stok.test.js` + `cards.test.js` senaryoları; gerçek kart masaya yaklaştırılınca < 2 sn'de tanınıyor | 1–2 gün |
| **B5 Görüşme kayıtları + atama geçmişi** | `oturum.py`, `/api/sessions` (kişi kimliği, etkinlik sn), `/api/assignments`, `alerts[].kisiler` | Kişi paneli zaman çizelgesi, rapor, CSV dışa aktarma | `oturum.test.js` eşdeğeri: çift başına kayıt toplamı ≈ `edges.min`; iade/değişimde açık kayıt kapanıyor; Faz 4 kabul 13/13 | 2 gün |
| **B6 Kalıcılık + sıfırlama** | SQLite şema, WAL, tik sonu toplu yazım, açılışta yükleme, `reset` kapsamı + yedek, açık oturum kapatma | Süreç öldürülüp açılınca kayıt defteri, atamalar, kenarlar, kayıtlar, eşik yerinde | Kill −9 sonrası `/api/people`, `/api/sessions`, `/state.edges` aynı; `reset` sonrası kişiler + açık atamalar + eşik duruyor, geri kalan boş; yedek dosyası var | 2 gün |
| **B7 Sertleştirme + dağıtım** | Yük ölçümü (97 kişi), yavaş SSE istemcisi, seri aygıt çekilip takılma, gövde sınırları, günlük, `baslat.*`, `wheelhouse/`, Windows MIME, dağıtım notu, `/api/health` | `docs/backend/DAGITIM.md` | 30 dk yük: tik < 50 ms, bellek sabit; aygıt çekilince `receiverAge` büyüyor, takılınca < 5 sn'de toparlıyor; `pip install --no-index` temiz makinede başarılı | 2 gün |
| **B8 Geçiş günü** | Gerçek alıcı + gerçek kartlar; `npx vite` → gerçek sunucu; `npm run build` → `dist/` sunucudan; `mock-server` sözleşme testleri `SUNUCU=` ile; Faz 2–5 kabul akışları; arayüzde `SUNUCU_ADRESI` kontrolü; `SUNUCUDAN_ISTENENLER.md` "gerçekleşti" işaretleri | PLAN.md DEVİR NOTU güncel; PR | Tüm ekranlar 390/768/1280'de gerçek veriyle; demo düğmeleri görünmüyor (`/api/demo` 404); Soru 1–6 cevapları uygulanmış ya da kayıtlı | 1–2 gün |

**Toplam:** ~17–21 iş günü (tek kişi). B3–B5 birbirinden bağımsız sıralanabilir; B6 B3'ten sonra her an öne alınabilir (kayıt defteri kaybı en pahalı risk).

### Tamamlanma tanımı (her faz için)
- [ ] Çekirdek değişikliği birim testli; `pytest` yeşil; `ruff`/`mypy` (varsa) temiz.
- [ ] Sözleşme etkileniyorsa `SUNUCUDAN_ISTENENLER.md` ve `http/semalar.py` birlikte güncellendi.
- [ ] Arayüz ilgili ekranı gerçek sunucuya karşı elle denendi (ekran görüntüsü `docs/backend/`).
- [ ] `docs/backend/Bn_NOT.md`: ne yapıldı, neden, ne kaldı.

---

## 15. Riskler ve azaltma

| # | Risk | Etki | Azaltma |
|---|---|---|---|
| R1 | Seri paket biçimi belgesiz / değişken | B1 bloke | İlk iş: Muhittin'den biçim + 10 dk ham kayıt; ayrıştırıcı toleranslı (bozuk satır atlanır, sayaç tutulur) |
| R2 | `server.py` yumuşatması ile ortanca farklı karar veriyor | Kalibrasyon ekranı yanıltır | B1'de iz karşılaştırması; sözleşme (ortanca) esas, fark Muhittin'le konuşulur |
| R3 | Alıcı USB'de uyuyor / çekiliyor | Veri kesilir | Yeniden açma döngüsü, `receiverAge`, güç ayarı notu; arayüz "ALICI BAĞLI DEĞİL" bandı zaten var |
| R4 | 97 kişi / 500 çiftte JSON 200 KB × 2 Hz × 5 istemci | CPU/ağ | Tek serileştirme, yavaş istemci kesme, `history` yalnız teknik istemciye (ayrı karar) |
| R5 | Süreç çökmesi → gün kaybı | Kritik | B6 kalıcılık; tik sonu yazım; yedek; `baslat.sh` otomatik yeniden başlatma döngüsü (`until python …; do sleep 1; done`) |
| R6 | Windows'ta MIME `text/plain` | Sayfa açılmaz | Açık MIME tablosu (B0 kabulü) |
| R7 | Soru 1 (yedek kartlar panoda hayalet) kararsız kalır | Pano kirlenir | Varsayılan: yedek kart `people`'a **görüşmeye girince** eklenir (mock davranışı); karar değişirse `atanmamis` bayrağı |
| R8 | "100+ kişi" ile 1–99 kart aralığı (Soru 6) | Kapasite | Sunucu kart aralığını ayardan okur (`KART_EN_BUYUK`); arayüz iki durumda da çalışıyor |
| R9 | Bağımlılık kurulumu etkinlikte internet yok | Kurulum başarısız | `wheelhouse/` repoda/USB'de; B7'de temiz makinede prova |
| R10 | Çift zaman kaynağı (duvar saati değişirse, NTP sıçraması) | `elapsed` kayar | `monotonic` esas; `clock` yalnız gösterim |

---

## 16. Açık kararlar (Muhittin ile)

Mevcut (`SUNUCUDAN_ISTENENLER.md`): **Soru 1** yedek kartlar panoda "Kart N" olmasın · **Soru 2** yedek ile kayıtsız dolaşan kart ayrımı ·
**Soru 3** atama geçmişi biçimi (öneri: Bölüm 8.2 `GET /api/assignments`) · **Soru 4** `DELETE` süreleri silsin mi (öneri: silmesin, `silindi` işareti) ·
**Soru 5** kalibrasyonda yedek kart çiftleri `signals/history`'de görünsün mü (öneri: **görünsün**, atanmamış kartlar da ölçülür; yalnız `people`'a girmez) ·
**Soru 6** 100+ kişi ile kart aralığı.

Yeni:
| # | Soru | Öneri |
|---|---|---|
| 7 | `alerts[].people` kart no; kart değişince eski bildirim yanlış kişiyi vurgular. `alerts[].kisiler` eklensin mi? | Eklensin (geriye uyumlu); arayüz varsa onu kullanır |
| 8 | `reset` kayıt defterini ve açık atamaları korusun mu? | Korusun (mock böyle; masa sabah kurulan listeyi kaybetmesin); eşik de korunur |
| 9 | Teknoloji: Python (öneri) mi, Node (mock evrimi + ayrı seri köprüsü) mi? Kim bakım yapacak? | Python; Muhittin bakımdaysa kesin |
| 10 | `deal` süre tablosu: ★★ 11 · ★★★ 8 · ★★★★ 11 · ★★★★★ 8 (mock) brief §5.2 ile aynı mı? ★ ve ★★ için kural var mı? | Tabloyu `ayar`'a taşı, `GET /api/event` ileride |
| 11 | Seri paket biçimi, alıcı VID/PID, `batt` birimi (% mi, mV mi) | B1 öncesi yazılı belge |

---

## 17. Bu belgenin bakımı
- Bu plan uygulamaya geçince `sunucu/` ayrı bir klasör/depoda yaşar; sözleşme belgesi (`SUNUCUDAN_ISTENENLER.md`) **tek gerçek kaynak** kalır.
- Her B fazı bittiğinde yukarıdaki tabloda ✅ ve kısa "Yapıldı:" notu; PLAN.md DEVİR NOTU'na "gerçek sunucu: Bn'de" satırı.
- Sözleşme değişikliği (yeni alan, yeni uç) üç yerde aynı commit'te: `SUNUCUDAN_ISTENENLER.md`, `http/semalar.py`, `mock-server/mock.js` (+test).
