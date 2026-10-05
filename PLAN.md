# PLAN — Yakınlık Takip Sistemi Sunucusu (`saasBridgeBackend`)

> Bu repo, `SaasBridge` reposundaki arayüzün (Vite + React) **gerçek sunucusudur**: alıcıdan gelen kart paketlerini işler,
> "birlikte mi?" kararını verir, kişi/kart/atama/görüşme kayıtlarını tutar ve arayüze `/state`, `/events`, `/control`,
> `/api/*` uçlarını aynı adresten sunar. Sözleşme ve ürün kuralları arayüz reposunda tanımlıdır; burada **tekrar edilmez,
> bağlanır.**
>
> Bu dosya projenin **tek planıdır**: çalışma kuralları, mimari, veri modeli, sözleşme, kalıcılık, test, fazlar, riskler.
> (Hazırlayan: Şevval (arayüz) · ilk taslak 02.10.2026 · 03.10.2026: eski `BACKEND_PLAN.md` bu dosyayla birleştirildi.)
>
> Kaynaklar (kardeş repo `SaasBridge`): `UI_TASARIM_BRIEF.md` §2, §5, §9 · `SUNUCUDAN_ISTENENLER.md` (sözleşme) ·
> `mock-server/mock.js` (davranışın çalışan referansı) · `mock-server/*.test.js` (sözleşme testleri).
>
> Okuma sırası: **Bölüm 0 (kurallar)** → **Bölüm 8 (sözleşme)** → **Bölüm 14 (fazlar)**.
> Diğer bölümler karar alırken ve uygularken başvurulacak ayrıntıdır.

## ⏩ DEVİR NOTU (05.10.2026)

- **Durum:** B0 (iskelet) bitti ve onaylandı (04.10.2026; teslim notu `docs/B0_NOT.md`). Sunucu
  derlenmiş arayüzü ve `/api/health`'i veriyor; veri uçları yok. B1 (giriş katmanı + sinyal) bitti ve onaylandı (05.10.2026; `docs/B1_NOT.md`). B2 kodu yazıldı — `b2-durum-yayin` dalında,
  inceleme ve onay bekliyor (`docs/B2_NOT.md`): Pano, Kurulum ve Sunum gerçek sunucudan (benzetim) canlı veri alıyor.
  Sıradaki: B3 (karşılama masası; ayrı onay).
- **Çalıştırma:** `./baslat.sh` (ya da `.venv/bin/python -m yakinlik`) → `http://localhost:8002`; testler `.venv/bin/pytest`.
- **Kardeş repo:** https://github.com/sevvalcilali/SaasBridge — arayüz, mock sunucu (`mock-server/mock.js`, davranışın çalışan
  şartnamesi), sözleşme belgesi (`SUNUCUDAN_ISTENENLER.md`), gereksinim belgesi (`UI_TASARIM_BRIEF.md` §2, §5, §9).
- **Yerel düzen (öneri):** iki repo yan yana: `…/SaasBridge` ve `…/saasBridgeBackend`. Sunucu `../SaasBridge/dist`'i servis
  eder; geliştirmede SaasBridge'de `npx vite`, burada `python -m yakinlik --kaynak benzetim`.
- **Donanım var, burada değil.** Kartlar ve alıcı çalışıyor ve ekipçe test edildi (05.10.2026, Şevval). Geliştirme
  ortamında yok: benzetim yalnız geliştirme süresince yerini tutuyor. Yazılım bitince Şevval sistemi verecek, gerçek
  donanıma bağlama B8'de yapılacak.

## Tek sayfada özet

- **Ne yapılacak:** Alıcıdan (ESP32-S3, USB seri) gelen kart paketlerini okuyan, çift başına "birlikte mi?" kararı
  veren, kişi/kart/atama/görüşme kayıtlarını tutan ve arayüze `GET /state`, `GET /events` (SSE, 2 Hz),
  `POST /control` ile `/api/*` uçlarını **aynı adresten** sunan tek bir sunucu süreci.
- **Değişmeyen şey:** Arayüz. Sözleşme `SUNUCUDAN_ISTENENLER.md`'de kilitli; sunucu bitince arayüzde değişecek
  tek şey `src/api/client.js` → `SUNUCU_ADRESI` (o da aynı kaynaktan servis edilirse boş kalır).
- **Teknoloji (karar, Bölüm 3):** Python 3.11+, tek süreç, `asyncio` döngüsü; HTTP için FastAPI + uvicorn; seri için
  `pyserial`; kalıcılık için stdlib `sqlite3` (WAL). Alan mantığı **saf Python modüllerinde**, HTTP ve seri katmanından
  bağımsız; her kural birim testli.
- **Doğrulama:** (1) saf çekirdeğe birim testleri, (2) `mock-server/*.test.js` sözleşme testlerinin gerçek sunucuya
  karşı koşturulması, (3) kayıtlı seri izlerinin tekrar oynatılması, (4) arayüzün Faz 2–5 kabul akışları.
- **Fazlar (Bölüm 14):** B0 iskelet → B1 giriş katmanı + sinyal → B2 `/state` `/events` `/control` eşdeğerliği → B3 kişi
  kayıt defteri + atama + CSV → B4 kartlar → B5 görüşme kayıtları + atama geçmişi → B6 kalıcılık + sıfırlama → B7
  sertleştirme ve dağıtım → B8 donanım ve geçiş günü. Her faz ayrı onayla başlar, kabul ölçütü yazılıdır.
- **Açık kararlar (Bölüm 16):** Muhittin'e Soru 1–11 — hiçbiri B0–B2'yi engellemez. Plan ↔ kod çelişkileri
  (Bölüm 16.3) ise B1.3 ve B2'den önce karara bağlanmalı.

---

## 0. ÇALIŞMA KURALLARI (pazarlıksız)

### 0.1 Onay
1. **Onaysız hiçbir faza başlanmaz.** Her B fazı Şevval "başla" demeden başlamaz; faz bitince sonuç gösterilir, sonraki faz
   için yeniden onay alınır.
2. **Faz kapsamı dışına çıkılmaz.** Akla gelen ek işler bu dosyanın Bölüm 16'sına not düşülür, onayla sıraya girer.
3. **Yıkıcı / geri alınamaz işlemler ayrıca sorulur:** dosya silme, veri sıfırlama, git geçmişi değiştirme,
   **bağımlılık ekleme/çıkarma**, plan/mimari değişikliği.
4. **Belirsizlikte uydurma yok.** Brief'te ve sözleşmede cevabı olmayan karar önce Şevval'e (gerekirse Muhittin'e) sorulur.
   Seri paket biçimi bilinmiyor → ayrıştırıcı yazılmaz, arayüz bırakılır.

### 0.2 İlkeler
| # | İlke | Neden |
|---|---|---|
| İ1 | **Sözleşme önce.** Alan adları, birimler (dakika/saniye), durum kodları `SUNUCUDAN_ISTENENLER.md` ve brief §5.1 ile birebir | Arayüz bunlara göre yazıldı ve testli |
| İ2 | **Saf çekirdek** (`yakinlik/cekirdek/`). Sinyal işleme, çift kararı, süre birikimi, bildirim kuralları, atama kuralları → giriş/çıkış dışı etkisi olmayan fonksiyonlar/sınıflar; zaman parametre olarak gelir (`simdi: float`); her kural birim testli | Birim test; seri/HTTP olmadan koşar; tekrar oynatılabilir |
| İ3 | **Tek yazıcı** (`motor.py`). Alan durumunu yalnız olay döngüsü (tek görev) değiştirir; seri okuyucu ve HTTP işleyicileri kuyruğa iş bırakır | Kilit yok, yarış yok, deterministik |
| İ4 | **Kişi ≠ kart.** Kart numarası yalnız fiziksel kimliktir; her süre/kenar/kayıt `kisiId`'ye (kişisiz kart için `"kart:N"`) yazılır; `/state` yayınlanırken o anki karta çevrilir | Kart değişiminde süre birleşir, iade edilen kart başkasına geçince devrolmaz |
| İ5 | **Kaybetme.** Kayıt defteri, atamalar, görüşme kayıtları, eşik diske yazılır; süreç yeniden başlayınca kaldığı yerden sürer. Yalnız `POST /control reset` siler | Etkinlik günü tek şans |
| İ6 | **Alıcı yoksa da yayın.** `/events` her 500 ms tam durumu yollar; `receiverAge` büyür, veri donar ama akış kesilmez | Arayüz 6 sn sessizlikte "bağlanılamıyor" gösterir |
| İ7 | **Bağımlılık az, hepsi yerelde kurulabilir.** Etkinlikte internet yok; kurulum paketleri (`wheelhouse/`) repoda ya da USB'de | Brief §11 |
| İ8 | **Kart numaraları 1–99 kişi, 100+ dinleyici cihaz.** Dinleyiciler `people/edges/live/signals/history`'ye girmez; `/api/cards`'ta görünebilir | Brief §2, `SUNUCUDAN_ISTENENLER.md` §8 |
| İ9 | **Metre/cm yok, konum yok.** Sunucu da dBm dışında mesafe üretmez | Ürün kuralı |

### 0.3 Kod düzeni
- `yakinlik/http/` → ince katman: doğrulama (pydantic şema = sözleşme) + çekirdek çağrısı + JSON. İş kuralı yazılmaz.
- `yakinlik/giris/` → `PaketKaynagi` arayüzü; benzetim / kayıt / seri aynı `Paket`'i üretir.
- **Mock çalışan şartnamedir** (`SaasBridge/mock-server/mock.js`): aynı girdiye aynı karar. Fark bulunursa önce mock'un
  neden öyle olduğu anlaşılır, sonra `SUNUCUDAN_ISTENENLER.md` güncellenir — asla sessizce sapılmaz.
- **Bağımlılıklar** Bölüm 3.2'deki listedir; başka paket onaysız eklenmez. YAGNI: ihtiyaç doğmadan soyutlama/ayar eklenmez.
- Tek sorumluluk: bir dosya bir iş. Tanımlayıcılar Türkçe ve tutarlı (arayüzle aynı kavram sözlüğü, brief §3);
  sözleşme alan adları (`people`, `seenAgo`, `kisiId`…) **aynen** korunur.
- Birimler: `live/min/invMin/edges.min` **dakika**; `seenAgo/receiverAge/elapsed` **saniye**. `clock` ve `elapsed` aynı andan.

### 0.4 Doğrulama sırası (her değişiklik)
1. `pytest` tamamen yeşil. 2. SaasBridge'de `npm run build`. 3. Arayüz tarayıcıda **gerçek sunucuyla** denenir
(390 / 768 / 1280). 4. Her adım kendi commit'i; bu dosyada ilgili adım ✅ + kısa "Yapıldı:" notu; faz sonunda `docs/Bn_NOT.md`.

### 0.5 Tamamlanma tanımı (her faz)
- [ ] Çekirdek değişikliği birim testli; `pytest` yeşil; `ruff`/`mypy` (varsa) temiz.
- [ ] Sözleşme etkileniyorsa `SUNUCUDAN_ISTENENLER.md` ve `http/semalar.py` birlikte güncellendi.
- [ ] Arayüz ilgili ekranı gerçek sunucuya karşı elle denendi (ekran görüntüsü `docs/`).
- [ ] `docs/Bn_NOT.md`: ne yapıldı, neden, ne kaldı.

---

## 1. Hedefler ve kapsam

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

---

## 2. Mevcut durum ve boşluk analizi

### 2.1 Bugün elde olan
| Parça | Nerede | Durum |
|---|---|---|
| Kart yazılımı (C3) + alıcı (ESP32-S3) | Muhittin | Çalışıyor, ekipçe test edildi; paket biçimi **belgelenmemiş** (B8 girdisi) |
| `server.py` | Muhittin | Seri okuma, yumuşatma, eşik −72, 5 sn giriş / 15 sn çıkış, 12 sn paket yok = kopuk |
| `pano/pano.py` | Muhittin | Kişi/rol ekleme, bildirim kuralları, `/`, `/state`, `/events`, `/control`; 2 Hz SSE; `localhost:8002` |
| Arayüz | `SaasBridge` `src/` | Faz 0–5 bitti, `dist/` statik servis edilir |
| Mock | `SaasBridge` `mock-server/mock.js` | `/state` + `/events` + `/control` + tüm `/api/*` uçlarının çalışan referansı; 11 test dosyası |

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
- `alerts[].people` kart numarası taşıyor → kart değişiminden sonra eski bildirim yanlış kişiyi vurgular (Soru 7).
- `/events` alıcı yokken yayın yapıyor mu? Statik `.js` dosyaları doğru MIME ile mi geliyor? (B2 kabul ölçütü.)

---

## 3. Teknoloji seçimi ve verilmiş kararlar

### 3.1 Verilmiş kararlar
| Konu | Karar (03.10.2026, Şevval) | Not |
|---|---|---|
| Dil / çatı | **Python 3.11 + FastAPI + uvicorn + pyserial**, SQLite (stdlib) | Gerekçe Bölüm 3.2–3.3; Muhittin'in Python kodu taşınabilir |
| Konum | **Ayrı repo** (`saasBridgeBackend`) | Arayüz reposuyla karışmasın; sözleşme belgesi arayüz reposunda kalır |
| Donanım | **Var ama geliştirme ortamında yok → benzetimle ilerlenir** | Kartlar ve alıcı çalışıyor ve test edildi (05.10.2026, Şevval); yazılım bitince sistem verilecek, seri katman B8'de bağlanır |
| Sözleşme | `SaasBridge/SUNUCUDAN_ISTENENLER.md` + brief §5.1 **değişmez** | Değişiklik gerekiyorsa üç yerde birlikte: sözleşme belgesi, `http/semalar.py`, `mock.js` |
| Dal düzeni | **Her faz kendi dalında** (`b0-iskelet` gibi), faz sonunda PR; Şevval onaylayınca `main`'e birleşir (04.10.2026) | `main` hep onaylanmış hali gösterir; arayüz reposuna yazma her seferinde ayrı onayla |

### 3.2 Teknoloji yığını: Python 3.11+ (tek süreç, asyncio)
| Katman | Seçim | Gerekçe |
|---|---|---|
| Dil / çalışma zamanı | **Python 3.11+** | Mevcut `server.py`/`pano.py` Python; seri ayrıştırma ve kanıtlanmış histerezis mantığı taşınabilir; Muhittin bakım yapabilir |
| Seri port | **`pyserial`** (okuma ayrı thread → `asyncio.Queue`) | Saf Python, Windows/macOS/Linux'ta derleme gerektirmez; çevrimdışı kurulumu kolay |
| HTTP + SSE | **FastAPI + uvicorn** | Tipli şemalar (pydantic) sözleşmeyi koda döker; SSE `StreamingResponse` ile; test için `httpx` |
| Kalıcılık | **`sqlite3` (stdlib), WAL modu** | Tek dosya, yedeklemesi kopyalamak; yazma hacmi düşük (saniyede birkaç satır) |
| Yapılandırma | `.env`/`config.toml` (stdlib `tomllib`) | Port, seri aygıt, eşik varsayılanı, etkinlik adı |
| Test | `pytest`, `pytest-asyncio`, `httpx` | Saf çekirdek + HTTP sözleşme |
| Paketleme | `pyproject.toml`, `pip wheel` → `wheelhouse/`, tek `baslat.(sh\|bat)` | Çevrimdışı kurulum |

**Bağımlılık listesi (tamamı):** `fastapi`, `uvicorn[standard]`, `pydantic` (fastapi ile gelir), `pyserial`; geliştirme:
`pytest`, `pytest-asyncio`, `httpx`. Başka bağımlılık **onaysız eklenmez**.

### 3.3 Değerlendirilen alternatifler
| Seçenek | Artı | Eksi | Ne zaman |
|---|---|---|---|
| **A. Python stdlib-only** (`http.server` + `ThreadingHTTPServer`, el yazımı SSE) | Sıfır bağımlılık, `pano.py` zaten böyle | Doğrulama/şema elle; SSE ve eşzamanlılık daha kırılgan; test altyapısı zayıf | Bağımlılık kesinlikle istenmiyorsa |
| **B. Node.js — mock'u gerçek sunucuya evriltmek** | `mock.js` sözleşmenin tamamını zaten uyguluyor ve testleri var; `tik()` benzetimi seri girişle değiştirilir; aynı dil, aynı testler | Seri port için `serialport` **yerel (native) modül**: Windows'ta çevrimdışı kurulumu zor; Muhittin'in Python kodu yeniden yazılır | Sunucuyu arayüz ekibi yazacak ve Muhittin bakım yapmayacaksa; seri okuma ayrı küçük bir Python köprüsüyle (TCP/stdin) çözülürse |
| **C. Python + FastAPI (seçilen)** | Bölüm 3.2 | 3 bağımlılık; uvicorn + pyserial thread köprüsü gerekir | Varsayılan |

**Karar (03.10.2026): C.** Muhittin'in donanım bilgisi Python'da; arayüz tarafı Node'dan bağımsız kalır; sözleşme testleri
(`mock-server/*.test.js`) dil fark etmeksizin HTTP üzerinden koşar (Bölüm 12.2). B seçeneği, seri köprüsü ayrı yazılacaksa
ciddi bir "hızlı yol"dur; bakımı kimin yapacağı Muhittin'e sorulacak (Soru 9).

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

- [1]–[2] **Giriş:** `PaketKaynagi` arayüzü. Üç uygulama: `BenzetimKaynak` (mock'un `tik()` dinamiğinin Python'u;
  donanımsız geliştirme), `KayitKaynak` (kaydedilmiş iz dosyasını zamanlamasıyla oynatır — test ve demo), `SeriKaynak`
  (pyserial, ayrı thread — B8). Hepsi aynı `Paket` nesnesini kuyruğa bırakır. Seri satır biçimi **B8'in ilk işi** olarak
  Muhittin'den alınıp `docs/SERI_PROTOKOL.md`'ye yazılır; ayrıştırıcı o belgeye göre birim testlidir.
- [3]–[5] **Çekirdek (saf):** zaman dışarıdan verilir (`simdi: float`), I/O yok. Mock'taki `tik()`/`durumUret()` ile
  **aynı kararları** verir; mock bu yüzden "çalışan şartname"dir.
- [6] **Projeksiyon:** Alan modeli kişi bazlı; `/state` kart bazlı. Çevrim yalnız burada yapılır.
- [7] **HTTP:** ince katman; doğrulama + çekirdek çağrısı + JSON. İş kuralı burada yazılmaz.
- [8] **Kalıcılık:** olay döngüsü içinden, tik sonunda toplu (`executemany`), WAL; okuma uçları bellek modelinden döner.

### 4.2 Proje yapısı (hedef; fazlarla dolar)
```
saasBridgeBackend/
├─ PLAN.md · README.md
├─ pyproject.toml · requirements.txt · requirements-dev.txt · baslat.sh · baslat.bat
├─ config.toml                 # port, seri aygıt, eşik varsayılanı, etkinlik adı/tarihi, veri dosyası yolu
├─ yakinlik/
│  ├─ __main__.py              # python -m yakinlik  (--port --kaynak seri|kayit|benzetim --dist --veri --seri)
│  ├─ ayar.py                  # config.toml + komut satırı
│  ├─ saat.py                  # Saat arayüzü: gerçek ve sahte (test)
│  ├─ motor.py                 # olay döngüsü: kuyruk → çekirdek → yayın → kalıcılık
│  ├─ giris/
│  │  ├─ paket.py              # Paket dataclass (ayrıştırıcı B8'de)
│  │  ├─ kaynak.py             # PaketKaynagi arayüzü
│  │  ├─ benzetim.py           # donanımsız dinamik (mock tik() eşdeğeri)
│  │  ├─ kayit.py              # iz dosyası oynatıcı / kaydedici
│  │  ├─ olustur.py            # ayarlardan kaynak kurar (kaynak_olustur)
│  │  └─ seri.py               # pyserial thread → Queue (B8)
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
│  ├─ http/
│  │  ├─ uygulama.py           # FastAPI app, statik dist/, MIME
│  │  ├─ durum_uclari.py       # /state /events /control
│  │  ├─ api_uclari.py         # /api/people … /api/sessions
│  │  └─ semalar.py            # pydantic istek/yanıt modelleri = sözleşme
│  └─ depo/
│     └─ sema.sql · sqlite.py  # tablolar, WAL, anlık görüntü, yükleme
├─ tests/
│  ├─ conftest.py              # sahte saat, httpx.AsyncClient
│  ├─ cekirdek/…               # saf birim testleri (zaman sabit)
│  ├─ http/…                   # httpx ile sözleşme
│  └─ izler/*.jsonl            # kayıtlı seri izleri (altın dosyalar)
├─ docs/                       # B0_NOT.md … · DAGITIM.md · SERI_PROTOKOL.md
└─ veri/                       # (git'te yok) etkinlik-*.sqlite · yedek/
```

---

## 5. Veri modeli

### 5.1 Varlıklar
| Varlık | Anahtar | Alanlar | Not |
|---|---|---|---|
| **Kişi** (`Katilimci`) | `kisiId` (`"k12"`, kalıcı) | `ad, rol(investor/founder/guest), kurum, yildiz(0–5), not, renk, atananKart\|null, ayrildi, olusturma_t` | `renk` doğumda atanır, **değişmez**; `yildiz` rol yatırımcı değilse 0 |
| **Kart** (`Kart`) | `kart` (`"14"`, 1–99) | `sonDuyulma_t, rssiAlici, pil` | Türetilir: alıcının duyduğu her kart; 100+ dinleyici ayrı kümede |
| **Atama** (`Atama`) | `(kisiId, kart, baslangic_t)` | `bitis_t\|null, islem(ata/iade/geri_al/degisim)` | Zaman damgalı geçmiş (`GET /api/assignments`); açık atama = `bitis_t null` |
| **Kenar** (`Kenar`) | `kimlikCifti` (`"k3\|k7"`, sıralı) | `dakika, karsiRol` | Kişi kimliği; kişisiz kart için `"kart:14"`; `/state.edges` çevrimle üretilir |
| **Görüşme kaydı** (`Oturum`) | `(kimlikA, kimlikB, start)` | `end\|null` (etkinlik saniyesi) | `/api/sessions`; kart iade/değişiminde açık kayıt kapanır |
| **Çift ölçümü** (`CiftDurumu`) | `(kartA, kartB)` küçük-büyük | `olcumler[(t, ab, ba, value)], ustundeSn, altindaSn, together, birlikteSn, anlasmaVerildi, sonDuyulma_t` | Bellekte; diske yazılmaz (yeniden başlatmada giriş/çıkış gecikmesiyle — 60 / 15 sn — kendini toparlar) |
| **Bildirim** (`Bildirim`) | sıra no | `t, clock, kind, severity, title, detail, people[kart], kisiler[kisiId]` | Yalnız eklenir; `kisiler` yeni alan (Soru 7) |
| **Ayarlar** | tek satır | `esik, etkinlikAdi, altBaslik, tarih, baslangic_t, sure_dk\|null, anlasmaSn\|null` | Eşik kalıcı (brief §5) |
| **Kimlik** (`kimlik(kart)`) | — | `atanan kişi varsa kisiId, yoksa "kart:N"` | Tüm süre/kenar/kayıt bu kimliğe yazılır (mock: `kimlik()`) |

### 5.2 Değişmezler (test edilecek)
1. Bir kişinin en fazla **bir** açık ataması vardır; bir kartın en fazla **bir** açık ataması vardır.
2. `ayrildi = true` ⇒ `atananKart = null`. `atananKart ≠ null` ⇒ `ayrildi = false`.
3. Kenar dakikaları `together` tiklerinde artar; görüşmenin başladığı tikte bekleme süresinin tamamı (eşiğin aşıldığı andan
   beri, ≥ 60 sn) eklenir (16.3 madde 1 kararı). Görüşme kaydı (B5) bu yüzden eşiğin aşıldığı andan açılmalı (`t − ustunde_sn`).
4. Çift başına görüşme kaydı sürelerinin toplamı ≈ `edges[].min` (±1 tik).
5. `kart:N` kimliğine yazılmış kayıtlar, N'ye kişi atanınca o kişiye **geçer**; iade edilen kartın süreleri yeni sahibine **geçmez**.
6. Kart değişiminde (kişi A: 14 → 22) A'nın kenarları/kayıtları bölünmez; `/state`'te 22 ile görünür.
7. `/state.people[].id` ve `edges[].a/b`, `live`, `alerts[].people` o anki kart numarasıdır; kartsız kişi `/state`'te yoktur.
8. 100+ numaralı cihaz `people/edges/live/signals/history`'de **asla** yoktur.
9. `clock` ve `elapsed` aynı tikte, aynı andan hesaplanır.
10. `reset`: süreler, kenarlar, kayıtlar, bildirimler, atama geçmişi **silinir**; kayıt defteri (kişiler) ve açık atamalar ile eşik **kalır** (mock `sifirla()` ile aynı; Soru 8 bunu teyit eder).

---

## 6. Zaman modeli

| Saat | Ne | Kullanım |
|---|---|---|
| **Duvar saati** `time.time()` | gerçek zaman | `alerts[].t`, `clock`, `atama.t`, kalıcılık damgaları |
| **Etkinlik saniyesi** `elapsed` | `time.monotonic() − baslangic` (reset'te 0) | `sessions.start/end`, `history` "kaç sn önce", `seenAgo`, `receiverAge` |
| **Tik** | 500 ms sabit; `DT` = tik arası gerçek fark (donmaları telafi etmek için ölçülür, 0.5 varsayılır) | süre birikimi, histerezis sayaçları |

- Alıcı kopukken (`receiverAge > 12`) ölçüm gelmez; sayaçlar **ilerlemez**, `seenAgo`'lar büyür, yayın sürer (İ6).
  12 sn'den kısa paketsiz tikler normal işlenir (gerçek alıcıda bir tik boş geçebilir). Bir kartın "duyulmuyor" süresi
  (`lost`) yalnız alıcı canlıyken sayılır: alıcı yeniden takılınca o tikte henüz gelmemiş kartlar kayıp sayılmaz (B2 incelemesi).
- Süreç yeniden başlarsa `elapsed` diskteki `baslangic_t` üzerinden sürer (etkinlik saati sıfırlanmaz).
- Gerçek kaynakta hızlandırma yok (gerçek zaman); yalnız benzetim kaynağı `--hizlandir` ile zamanı çarpar (B1.3).
  Birim testlerinde zaman **enjekte edilir** (`Saat` arayüzü: `simdi()`, `monotonic()`).

---

## 7. Sinyal işleme ve karar kuralları (mock ile birebir)

| Kural | Değer | Kaynak |
|---|---|---|
| Çift anahtarı | `"küçükNo-büyükNo"` | brief §5.1 |
| Ölçüm | her paketten `ab`, `ba` (biri eksikse `null`), `value` = ikisi varsa ortalama yoksa olan | brief §5.1 |
| Karşılaştırılan değer | son **10 sn** ölçümlerinin **ortancası**; "birlikte" kararı da bu değerle verilir | `SUNUCUDAN_ISTENENLER.md` §5 (kalibrasyon bunu ölçer); Bölüm 16.3 madde 1 kararı |
| Eşik | varsayılan −72 dBm; `/control threshold` −100…−20; **kalıcı** | brief §2, §5 |
| Giriş gecikmesi | **60 sn** kesintisiz üstte → `together = true`. Bekleme süresi görüşmeye sayılır: süre, kenar dakikası ve görüşme kaydı eşiğin aşıldığı andan başlar | **Şevval, 05.10.2026** (brief §2'deki 5 sn yerine: saniyeler çok az veri) |
| Çıkış gecikmesi | 15 sn kesintisiz altta → `together = false`, kayıt kapanır, `stats.done++` | brief §2 |
| `signals[].n` | 10 sn penceresindeki ölçüm sayısı | brief §5.1 |
| `history` | son 90 sn, 2 sn'lik kovaların ortancası, en eski başta, `[snÖnce, dBm]` | brief §5.1 |
| Çift unutma | ne together ne de 30 sn'dir duyulmuş → çift silinir | mock |
| `seenAgo` | kartın son paketinden beri sn | brief §5.1 |
| `receiverAge` | alıcıdan son satırdan beri sn; 12 sn → kopuk | brief §2 |
| `lost` bildirimi | kart 60 sn duyulmadı → `serious`; tekrar duyulunca bayrak sıfırlanır | brief §5.2 |
| `deal` | yatırımcı+girişimci kesintisiz birlikte; süre yatırımcı yıldızına göre: ★★ 11 dk · ★★★ 8 dk · ★★★★ 11 dk · ★★★★★ 8 dk (mock); `rules.dealAfterS` zorlanabilir | brief §5.2/§6.1 — **Soru 10: tablo Muhittin'le teyit** |
| `repeat` | anlaşma çıkmış **kişi çifti** aynı gün yeniden birlikte | brief §5.2 |
| `idle_investor` | ★★★+ yatırımcı 6 dk kimseyle değil ve kartı duyuluyor (`seenAgo < 30`) → `warn`; bir kez. Biriyle eşik üstünde bekliyorsa (görüşme olmadan önceki dakika) uyarı ertelenir: görüşme başlarsa o dakika görüşmeye sayılır, başlamazsa uyarı bekleme bitince düşer | brief §5.2; B2 incelemesi |
| `no_investor` | kapalı (bayrakla açılabilir) | brief §5.2 |
| `idleSinceS` | kişinin kesintisiz boşta kaldığı sn (`idle_investor` sayacının herkese genellenmiş hali) | `SUNUCUDAN_ISTENENLER.md` §9 |
| İade/değişimde açık çift | o çift kapatılır, eşi serbest bırakılır; kenar dakikası korunur | `SUNUCUDAN_ISTENENLER.md` §2 |

Yumuşatma seçimi: `server.py`'deki mevcut yumuşatma korunacaksa **ortanca ile aynı sonucu verdiği** ölçülmeli
(B8'de kayıtlı izle karşılaştırma). Vermiyorsa sözleşme (ortanca) kazanır; kalibrasyon ekranı buna göre yazıldı.

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
| `alerts[].kisiler` | `people` ile aynı sırada `kisiId`'ler | Soru 7 |
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
4. Açık oturumlar (`end_s IS NULL`): yeniden başlatma anında `end_s = elapsed` ile **kapatılır** (gerçekte sürüyorsa giriş gecikmesi — 60 sn — sonra yeni kayıt açılır;
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
  **Ölçüm (B1 incelemesi, 05.10.2026):** benzetimde duyulan çift sayısı etkinlik boyunca büyür (ayrılan çiftler birbirini zayıf
  duymaya devam eder): 97 kartta 1 saatte ~320, 3 saatte ~850. Bu yükte sinyal çekirdeği tik başına ~28 ms; bunun ~23 ms'si
  grafik serisi (her tikte ~38 bin kova; kovalar "şimdi"ye göre olduğu için önbelleğe alınamaz). Motor, bildirimler ve JSON
  eklenince 50 ms aşılabilir → (b) seçeneği B7'ye değil **B2 tasarımına** girdi. Gerçek donanımda salondaki bütün kartlar
  birbirini duyarsa çift sayısı daha da büyük olabilir (97 kartta en çok 4656) — Soru 11 (seri biçim) ile birlikte bakılmalı.
- **Seri hacmi:** 97 kart × saniyede birkaç paket × duyduğu komşular → saniyede birkaç bin ölçüm; ayrıştırma thread'de, çekirdeğe toplu teslim (tik başına liste).

---

## 11. Ağ, güvenlik, dayanıklılık

- Dinleme: varsayılan `0.0.0.0:8002` (masa tableti ve salon ekranı başka cihaz). Ayarla `127.0.0.1`'e kısıtlanabilir.
- Kimlik doğrulama yok (brief §5); ağ etkinlik Wi-Fi'ı. **Yıkıcı işlemler** yalnız `reset` ve `DELETE` — ikisi de loglanır, `reset` öncesi yedek.
- Girdi doğrulama: kart no `^[1-9][0-9]?$`; `rol` enum; metinler 200 karakter kırpılır; CSV 1 MB.
- Hata yalıtımı: bir uçtaki istisna 500 döner, döngüyü **düşürmez** (mock'taki `.catch` eşdeğeri); seri okuma hatası (aygıt çekildi) → kaynak yeniden açmayı 2 sn aralıkla dener, `receiverAge` büyür, yayın sürer.
- Günlük: `yakinlik.log` (döner, 5×5 MB): açılış/kapanış, seri aç/kapa, her `/control` ve `/api` yazma isteği, bildirimler; **ölçümler loglanmaz** (hacim). Ayrıca `--kaydet iz.jsonl` ile ham paket izi kaydı (test altın dosyaları için).
- Sağlık: `GET /api/health` (arayüz kullanmaz; operatör için). B0'da `{ok, surum, kaynak}`; `receiverAge` ve `istemciSayisi`
  alanları isteğe bağlı olarak B7'de eklenir.

---

## 12. Test stratejisi

### 12.1 Saf çekirdek birim testleri (`pytest`)
- Her kural için zaman enjekte edilerek: histerezis (59,5 sn üstte → yok, 60 sn → var; 14,9 altta → sürüyor), ortanca penceresi,
  `lost` 60 sn, `idle_investor` 6 dk, `deal` yıldız tablosu, `repeat` kişi çifti ile (kart değişse de), kenar birleşme/devretmeme,
  `kart:N` devri, `reset` kapsamı, CSV ayrıştırma (`;`/`,`/sekme, BOM, tırnak, Türkçe başlık, yinelenen ad+kurum, satır no).
- Mock'un test dosyaları (`mock-server/oturum.test.js`, `degisim.test.js`, `iade.test.js`, `iceaktar.test.js`, `stok.test.js`,
  `kalibrasyon.test.js`, `saglamlik.test.js`) **senaryo listesi** olarak Python'a taşınır — aynı adlar, aynı beklentiler.

### 12.2 Sözleşme testleri (arayüzün gözünden)
- `mock-server/*.test.js` dosyaları HTTP kara kutu testleridir ama her biri kendi mock'unu başlatır. Küçük bir değişiklikle
  (`SUNUCU=http://localhost:8002 node --test mock-server/`) **dış sunucuya karşı** koşabilir hale getirilir (B2.6 — SaasBridge
  reposunda ayrı iş; benzetim senaryolarına bağlı testler — Kart 14 45. sn, kayıp kart — `BenzetimKaynak` ile koşar, seri ile atlanır).
  Bu yaklaşımın bilinen sorunları: Bölüm 16.3 madde 2–5.
- `tests/http/`: `httpx` ile her uç için 2xx/4xx ve şema; SSE ilk mesaj + 2 Hz kadans (1,5 sn'de ≥2 mesaj); `\r\n`.
- Statik: `/` 200 `text/html`; `/assets/*.js` `text/javascript`.

### 12.3 İz tekrar oynatma (altın dosyalar)
- Gerçek alıcıdan kaydedilmiş 5–10 dk'lık izler (`tests/izler/*.jsonl`: iki kart yaklaşıp uzaklaşıyor; sırt sırta; pil bitişi; alıcı çekilmesi).
- Beklenen çıktı: oturum listesi + kenar dakikaları (`*.beklenen.json`). Çekirdek değişince fark görünür.
- Aynı izle `server.py`'nin eski kararları karşılaştırılır (B8 kabulü: ≥ %95 aynı `together` tikleri ya da farklar açıklanmış).

### 12.4 Arayüz kabul akışları (uçtan uca)
- Arayüzün Faz 2 (11), Faz 3 (16), Faz 4 (13), Faz 5 (15) kabul ölçütleri SaasBridge `docs/faz*/…TESLIM.md`'de. Gerçek sunucu +
  `npm run build` + `dist/` servis edilerek **elle ve Playwright ile** (390 / 768 / 1280 genişlik) geçilir. Bu betikler repoda değil; B8'de yazılır.
- Donanımsız: `--kaynak benzetim` ile aynı akışlar (Kart 14 45. sn, kayıp kart 180–300 sn, alıcı kopması 120. sn — mock ile aynı zamanlama ki arayüz kabul betikleri aynen çalışsın).

### 12.5 Yük
- `--kaynak benzetim --kisi 97` ile 30 dk: tik süresi, JSON boyutu, bellek (hedef: tik < 50 ms, RSS < 300 MB, büyüme yok). 5 SSE istemcisi (masa, pano, salon, kurulum, rapor).

---

## 13. Dağıtım ve çalıştırma

- **Tek komut:** `baslat.sh` / `baslat.bat` → sanal ortam yoksa `wheelhouse/`'tan kur (`pip install --no-index --find-links wheelhouse -r requirements.txt`), `python -m yakinlik --seri COM5|/dev/ttyUSB0 --port 8002 --dist ../SaasBridge/dist`.
- **Seri aygıt bulma:** `--seri auto` → `serial.tools.list_ports` ile ESP32-S3 (VID/PID Muhittin'den) seçilir; bulunamazsa uyarı + alıcısız başlar.
- **Statik:** `dist/` yolu ayarlanabilir; yoksa `/` 200 "arayüz derlenmedi" metni (süreç yine çalışır).
- **Windows notları:** MIME eşlemesi elle (Bölüm 8.1); COM port izni; güç tasarrufu USB'yi uyutmasın (dağıtım notuna yazılır).
- **Çalıştırma kontrol listesi (etkinlik sabahı):** alıcı takılı → `receiverAge < 2` · `/state` 200 · `/events` 2 Hz · `/api/cards` yedekleri gösteriyor · eşik dünkü değer · yedek alındı · `dist/` güncel (`npm run build` tarihi).
- **Sürümleme:** `yakinlik/__init__.py` `__surum__`; `/api/health`'te; `git tag b7-…`.

---

## 14. FAZLAR

Durum işaretleri: ⬜ onay bekliyor · 🟡 devam ediyor · ✅ bitti ve onaylandı

### 🟡 Faz B — Gerçek sunucu (Python) (planlandı 03.10.2026; B0 bitti 04.10.2026, B1 bitti 05.10.2026, sonraki fazlar ayrı onayla)

**Amaç:** Arayüzün mock'tan aldığı her şeyi gerçek bir sunucudan, aynı sözleşmeyle vermek. Gerekçe, mimari, veri modeli ve
kurallar Bölüm 1–13'te; **burası uygulama sırası ve kabul ölçütleridir.** Her B fazı ayrı onayla başlar (Bölüm 0.1), kendi
commit'lerini alır, sonunda `docs/Bn_NOT.md` yazılır. Süreler tek kişi, tam gün içindir.

**Geliştirme döngüsü:** `python -m yakinlik --kaynak benzetim --port 8002` (bu repo) + `SaasBridge` kökünde `npx vite`
(Vite proxy'si zaten 8002'ye gider). Doğrulama sırası Bölüm 0.4.

#### B0 ✅ İskelet (tahmin: 1 gün) — bitti ve onaylandı (04.10.2026)
- **Yapıldı** (ayrıntı ve gerekçeler: `docs/B0_NOT.md`):
  - B0.1 ✅ Sürüm `yakinlik/__init__.py`'de, bağımlılıklar `requirements.txt`'te tek yerde (pyproject oradan okur); paketler
    kurulu sürüme sabitlendi. `.gitignore` zaten yeterliydi, yalnız `*.egg-info/` eklendi.
  - B0.2 ✅ `host` da ayar oldu (varsayılan `0.0.0.0`, yalnız `config.toml`'dan); `veri` / `seri` varsayılanı boş; etkinlik
    varsayılanları mock ile aynı; `config.toml`'da bilinmeyen anahtar hata verir.
  - B0.3 ✅ `GercekSaat` ve yalnız `ilerlet()` ile ilerleyen `SahteSaat`.
  - B0.4 ✅ Ek olarak `dist/` dışına çıkan yollar 404; FastAPI `/docs` sayfaları kapalı (internet ister).
  - B0.5 ✅ Ctrl+C çıkış kodu 0; bozuk `config.toml` "ayar hatası" mesajıyla çıkar.
  - B0.6 ✅ 70 test (ayar 27, saat 3, HTTP 33, başlatma 2, `baslat.sh` 5); testler koddan önce yazıldı.
  - B0.7 ✅ `baslat.sh` temiz kopyada denendi; `baslat.bat` Windows'ta **denenmedi** (B7 provasına kaldı).
  - İnceleme ✅ Dal bağımsız incelemeden geçti: kritik bulgu yok, üç önemli bulgu bu dalda düzeltildi (statik yol
    denetimi, `config.toml` tür denetimi, yarım kalmış `.venv`). Ertelenen küçük bulgular `docs/B0_NOT.md`'de.
  - Kabul ✅ `pytest` 70/70; arayüz 390 / 768 / 1280'de açılıyor ve çökmüyor (`docs/B0_ekran_*.png`); `.js` →
    `text/javascript`; `/api/demo` 404. Ekrandaki metin "Veri bekleniyor…" değil "Sunucuya bağlanılamıyor, yeniden
    deneniyor…": `/events` henüz 404, B2'de düzelir.
- **B0.1** `pyproject.toml` (paket adı `yakinlik`, Python ≥3.11), `requirements.txt` + `requirements-dev.txt`,
  `.gitignore` (`.venv/`, `veri/`, `__pycache__/`), `README.md` (kurulum + çalıştırma, 10 satır).
- **B0.2** `yakinlik/ayar.py`: `config.toml` okuma (stdlib `tomllib`) + komut satırı (`--port --kaynak --dist --veri --seri`);
  varsayılanlar: port 8002, kaynak `benzetim`, dist `../SaasBridge/dist`, eşik −72, etkinlik adı/alt başlık/tarih.
- **B0.3** `yakinlik/saat.py`: `Saat` arayüzü (`simdi()` duvar, `monotonic()`); gerçek ve **sahte** (test) uygulaması.
- **B0.4** `yakinlik/http/uygulama.py`: FastAPI app; `dist/` statik servis; **MIME tablosu elle** (`.js` → `text/javascript`,
  `.css`, `.svg`, `.woff2`, `.json`); `/` ve `/?clean=1` → `index.html`; `dist/` yoksa `/` 200 "arayüz derlenmedi" metni.
  `GET /api/health` → `{ok, surum, kaynak}`. `/api/*` bilinmeyen uç → 404 `{ok:false, hata}`; işleyici istisnası → 500, süreç düşmez.
- **B0.5** `yakinlik/__main__.py`: `python -m yakinlik` uvicorn'u başlatır; `Ctrl+C` temiz kapanış.
- **B0.6** `tests/` iskeleti: `conftest.py` (sahte saat, `httpx.AsyncClient`), ilk testler: `/api/health` 200,
  `/assets/x.js` MIME, `/api/yok` 404 JSON, `/api/demo` 404.
- **B0.7** `baslat.sh` / `baslat.bat`: `.venv` yoksa kur (`pip install -r requirements.txt`; `wheelhouse/` varsa `--no-index`), çalıştır.
- **Doğrulama / kabul:** `pytest` yeşil; SaasBridge'de `npm run build` sonrası `python -m yakinlik` → tarayıcıda `http://localhost:8002/`
  arayüz açılıyor ("Veri bekleniyor…" — henüz `/state` yok, çökmüyor); `.js` dosyaları doğru MIME; `/api/demo` 404.

#### B1 ✅ Giriş katmanı + sinyal işleme (tahmin: 2 gün) — bitti ve onaylandı (05.10.2026)
- **Yapıldı** (ayrıntı ve gerekçeler: `docs/B1_NOT.md`):
  - B1.1 ✅ `Paket` plandaki dört alanla; kişi kartı kuralı arayüzdeki `kisiKartiMi` ile aynı.
  - B1.2 ✅ **Plandan sapma:** kaynak `list[Paket]` yerine `Tik` (tik anı + paketler) akışı üretir; işleme katmanı zamanı
    tikten okur. Boş tikte zaman kaybolmaz; hızlandırma ve kayıttan oynatma canlı koşuyla birebir aynı zamanı taşır.
  - B1.3 ✅ Kadro (25 örnek kişi) benzetimde üretilir ve dışarı açıktır (16.3 madde 6 kararı). Susan kartı başka kartlar
    da duymaz. Yeni bayraklar `--kisi --hizlandir --kopma`; `--tohum` eklenmedi.
  - B1.4 ✅ `--kaydet`, `--kaynak kayit --iz`; `giris/olustur.py` ayarlardan kaynağı kurar. **Bayraklar çalışan sunucuda
    B2'ye kadar etkisiz** (kaynağı motor çalıştıracak).
  - B1.5 ✅ `SinyalDeposu`: değerler yuvarlanmadan tutulur (yuvarlama B2'de yayın katmanında); hem son ölçümü hem
    ortancayı verir (16.3 madde 1 kararı B2'de).
  - İnceleme ✅ Dal bağımsız incelemeden geçti (Opus): bir kritik bulgu (`--kaydet` var olan dosyayı, `--iz` ile aynıysa
    oynatılacak izi siliyordu) ve sekiz önemli bulgu bu dalda düzeltildi. En büyüğü hız: 97 kart / 850 çift yükünde sinyal
    çekirdeği tik başına 66 → 28 ms. Ertelenen küçük bulgular ve B2 notları `docs/B1_NOT.md`'de.
  - Kabul ✅ `pytest` 168/168; 60 sn'de sinyal sayısı 9,07 (mock 8,80; +%3,1), grafik uzunluğu 18,19 (mock 18,41; −%1,2);
    kayıt → oynatma 400 tikte birebir aynı sinyal dizisi.
- **B1.1** `giris/paket.py`: `Paket{kart: str, duyulanlar: [(kart, rssi)], pil: int|None, t: float}` dataclass; 100+ kart
  işaretlenir ama **atılmaz** (`/api/cards` için). Ayrıştırıcı **yok** (biçim bilinmiyor) — `SeriKaynak` B8'de.
- **B1.2** `giris/kaynak.py`: `PaketKaynagi` arayüzü (`def tikler() -> AsyncGenerator[Tik, None]`; `Tik` = tik anı + o tikin
  paketleri — ilk yazımda `list[Paket]` idi, 04.10.2026'da değişti, gerekçe yukarıda).
- **B1.3** `giris/benzetim.py`: mock `tik()` dinamiğinin Python'u — aynı tohumlu RNG değil, **aynı senaryo zamanlaması**:
  Kart 14 → 45. sn, kayıp kart → 180–300. sn, alıcı kopması → 120. sn ve her 360 sn (`--kopma=0` ile kapalı), yedek kartlar
  (6 adet, masada), `--kisi` (≤97), `--hizlandir`. Ad/kurum listeleri mock'tan. Böylece arayüzün Faz 2–5 kabul betikleri
  **aynen** çalışır.
- **B1.4** `giris/kayit.py`: `--kaydet iz.jsonl` ile her tikin paketleri dosyaya; `--kaynak kayit --iz dosya` ile aynı
  zamanlamayla geri oynatma (altın dosya testleri için).
- **B1.5** `cekirdek/sinyal.py` (saf): çift anahtarı `"küçük-büyük"`, ölçüm (`ab`, `ba`, `value`), 10 sn penceresi + ortanca +
  `n`, 90 sn / 2 sn kovalı grafik serisi (en eski başta), 30 sn duyulmayan çiftin unutulması, `seenAgo`, `receiverAge`.
  Testler: pencere sınırları, tek yönlü veri (`null`), kova sıralaması, 100+ eleme.
- **Doğrulama / kabul:** `pytest` yeşil; benzetim 60 sn koşup `signals` sayısı ve `history` uzunluğu mock'la aynı büyüklükte
  (±%10); kayıt → oynatma aynı `signals` dizisini üretir (deterministik).

#### B2 🟡 `/state` · `/events` · `/control` eşdeğerliği (tahmin: 3 gün) — kod bitti (05.10.2026, dal `b2-durum-yayin`), onay bekliyor
- **Yapıldı** (ayrıntı ve gerekçeler: `docs/B2_NOT.md`):
  - B2.1 ✅ Karar: 10 sn ortancası eşiğin üstünde **kesintisiz 60 sn** → birlikte; bekleme görüşmeye sayılır; 15 sn çıkış
    (16.3 madde 1, Şevval 05.10.2026). Duyulmayan çift eşik altında sayılır.
  - B2.2 ✅ `alan.py` (plan listesinde yoktu: tikin saf işlenişi motor'dan ayrı) + `bildirim.py`; `kisi.py` en küçük haliyle
    (benzetim kadrosundan). Aynı kişi çiftine anlaşma bir kez. `idleSinceS` herkes için.
  - B2.3 ✅ `/state` mock'la alan alan aynı; tek ek `people[].idleSinceS`. Atanmamış kart ilk görüşmesinden sonra (R7).
  - B2.4 ✅ Komutlar ayrı kuyruk yerine olay döngüsünde eşzamanlı (tik işleme `await`siz). Kaynak biterse yayın sürer.
    Sıfırlama sahte salonu baştan başlatmaz; sinyal ölçümleri kalır.
  - B2.5 ✅ `/state`, `/events`, `/control`; Ctrl+C'de açık akışlar 1 sn içinde kesilir; kaynak ayarı açılışta denetlenir.
  - B2.6 ⏸️ Arayüz reposunda, ayrı onayla (16.3 madde 2–4 yüzünden kapsamı yeniden düşünülmeli).
  - İnceleme ✅ Bağımsız inceleme (Opus): kritik yok; beş önemli bulgu düzeltildi — motor hata yalıtımı, alıcı geri gelince
    sahte "kart kesildi" yağmuru, seyrek pakette süre kaybı (artık 12 sn kuralı), bekleme dakikasında yanlış "yalnız" uyarısı,
    sınanmayan davranışlar. `config.toml` eşik aralığı eklendi.
  - Kabul ✅ `pytest` 269/269; gerçek süreçle 2 Hz (alıcı kopukken de); tarayıcıda Pano / Kurulum / Sunum 390–768–1280,
    eşik kaydırıcısı geri okunuyor, "ALICI BAĞLI DEĞİL" çıkıyor, "bağlanılamıyor" çıkmıyor. Faz 1/3/5 maddeleri tek tek
    koşulmadı (tarayıcı kabul betikleri B8'de).
  - Yük: 97 kişi, ~170 / ~320 / ~850 duyulan çiftte tik ~10 / ~18 / ~50–54 ms, `/state` ~130 / ~230 / ~530–610 KB
    (Bölüm 10): üç saatlik etkinlik sonunda 50 ms bütçesi aşılıyor.
- **B2.1** `cekirdek/cift.py`: eşik karşılaştırması, 60 sn giriş (16.3 madde 1 kararı) / 15 sn çıkış histerezisi, `together`, `birlikteSn`;
  `cekirdek/kenar.py`: kişi kimliği (`kisiId` ya da `"kart:N"`) ile dakika birikimi (başladığı tik dahil), `invMin`, `invPeers`.
- **B2.2** `cekirdek/bildirim.py`: `deal` (yıldız tablosu, `rules.dealAfterS` zorlaması), `repeat` (kişi çifti), `idle_investor`
  (6 dk, `seenAgo<30`), `lost` (60 sn, tekrar duyulunca sıfırlanır), `no_investor` (kapalı); `clock` + `t`; `people` kart no.
  **`idleSinceS`** burada sayılır.
- **B2.3** `cekirdek/durum.py`: brief §5.1 nesnesi — `people` rol sırası, `status` (talking/idle/away), `withName`, `live` dk,
  `stats`, `event.progress`, `clock` ve `elapsed` **aynı andan**, `threshold`, `signals`, `history`, `chartSeconds`, `rules`.
  100+ cihaz hiçbir koleksiyonda yok. Kartı olmayan kişi yok.
- **B2.4** `motor.py`: 500 ms tik; kuyruktan paketler → sinyal → çift → kenar → bildirim → `durumUret()` **bir kez** →
  JSON **bir kez** → SSE istemcilerine aynı tampon. Alıcı kopukken (12 sn paket yok) sayaçlar donar, `seenAgo`/`receiverAge` büyür,
  **yayın sürer.** Komut kuyruğu (`reset`, `threshold`; sonra `/api/*`).
- **B2.5** `http/durum_uclari.py`: `GET /state` (`no-store`), `GET /events` (ilk mesaj hemen, `\n\n`, `X-Accel-Buffering: no`,
  kopan istemci düşer, yavaş istemci >5 mesaj birikince kapatılır), `POST /control` (`reset` → çekirdek sıfırla; `threshold`
  −100…−20 değilse 400; başarıda 200 `{ok:true}`). Eşik bu fazda bellekte; kalıcılık B6.
- **B2.6** Arayüz tarafı küçük iş (**SaasBridge reposunda, ayrı onay**): `mock-server/*.test.js` dosyalarına `SUNUCU=` ortam değişkeni — verilirse mock başlatmayıp
  o adrese koşarlar (benzetim senaryolarına bağlı olanlar aynı zamanlamayla geçmeli). `package.json`'a `test:sunucu` betiği.
- **Doğrulama / kabul:** `pytest`; `SUNUCU=http://localhost:8002 npm run test:sunucu` → `mock.test.js`, `saglamlik.test.js`,
  `kalibrasyon.test.js` yeşil; tarayıcıda **Pano, Kurulum, Sunum** gerçek sunucuyla (benzetim) 390/768/1280 — Faz 1, 3, 5
  kabul ölçütleri; alıcı kopması penceresinde (120. sn) "ALICI BAĞLI DEĞİL" bandı çıkıyor ve "bağlanılamıyor" **çıkmıyor**
  (yayın 2 Hz sürüyor); 1,5 sn'de ≥2 SSE mesajı; eşik kaydırıcısı değiştirip geri okuyor.

#### B3 ⬜ Kişi kayıt defteri + atama + CSV (tahmin: 3 gün) — karşılama masası gerçek sunucuyla
- `cekirdek/kisi.py` (kayıt, renk ataması brief §10 paleti, doğrulama/kırpma), `cekirdek/atama.py` (ata / iade / geri al /
  değişim; kart başkasındaysa eski atama kapanır, `ayrildi` değişmez; kişinin başka kartı varsa değişim → kenarlar birleşir,
  `kart:N` kayıtları kişiye geçer; iade/değişimde açık çift kapatılır, eşi serbest), `cekirdek/csv_ice.py` (ayraç `; , \t`,
  Türkçe/harfsiz başlık, tırnak + `""`, BOM, yinelenen ad+kurum, satır no), `http/api_uclari.py` + `http/semalar.py`:
  `GET/POST /api/people`, `PATCH/DELETE /api/people/{id}`, `POST /api/people/import`, `POST /api/assign`, `POST /api/unassign`.
  Durum kodları Bölüm 8.2. Atama geçmişi listesi (`GET /api/assignments`) burada **kaydedilir**, B5'te sunulur.
- **Kabul:** `mock-server/{api,degisim,iade,iceaktar}.test.js` senaryoları `tests/`'te yeşil ve `SUNUCU=` ile de yeşil;
  tarayıcıda **Faz 2 kabul akışı 11/11** (kart ver / değiştir / iade / geri al / CSV / kayıp kart) gerçek sunucuyla.

#### B4 ⬜ Kartlar — `GET /api/cards` (tahmin: 1–2 gün)
- Alıcının duyduğu tüm kartlar (atanmış, yedek, iade dönmüş, 100+), `rssiAlici`, `seenAgo`, `pil`, `atanan`; benzetimde
  yedekler masada −80 civarı, "yaklaştır" senaryosu **yok** (mock'un `/api/yaklastir`'ı demo; gerçek kart yaklaştırılır).
  Yedek kartlar `people`'a **girmez** (Soru 1 varsayılanı: yalnız bir görüşmeye girince eklenir).
- **Kabul:** `stok.test.js`, `cards.test.js` senaryoları; Kurulum kart sağlığı tablosu ve masadaki "boştaki kartlar" şeridi
  gerçek sunucuyla; Faz 3 kabul 16/16.

#### B5 ⬜ Görüşme kayıtları + atama geçmişi + bildirim kimlikleri (tahmin: 2 gün) — kişi paneli ve rapor
- `cekirdek/oturum.py` (`together` olunca açılır, bitince kapanır; iade/değişimde kapanır; `kart:N` → kişiye devir),
  `GET /api/sessions` (etkinlik sn, 1 ondalık, `end:null`), `GET /api/assignments`, `alerts[].kisiler` (Soru 7 —
  geriye uyumlu ek alan).
- **Kabul:** `oturum.test.js` eşdeğeri (çift başına kayıt toplamı ≈ `edges.min` ±1 tik); Faz 4 kabul 13/13 (zaman çizelgesi,
  rapor, iki CSV) gerçek sunucuyla.

#### B6 ⬜ Kalıcılık + sıfırlama (tahmin: 2 gün)
- `depo/sema.sql` + `depo/sqlite.py` (WAL): kişi, atama, oturum, kenar, bildirim, anlaşma, ayar (eşik, başlangıç zamanı,
  etkinlik). Tik sonunda yalnız **değişenler**, tek işlem. Açılışta yükleme; açık oturumlar yeniden başlatmada kapatılır;
  `elapsed` sürer. `reset`: süreler/kenarlar/kayıtlar/bildirimler/atama geçmişi silinir, **kişiler + açık atamalar + eşik kalır**
  (Soru 8 varsayılanı); reset öncesi otomatik yedek kopyası. Eşik artık **kalıcı** (brief §5).
- **Kabul:** süreç `kill -9` ile öldürülüp açılınca `/api/people`, `/api/sessions`, `/state.edges`, `threshold` aynı; reset
  sonrası beklenen kümeler boş/dolu; `veri/yedek/` dosyası var.

#### B7 ⬜ Sertleştirme + dağıtım (tahmin: 2 gün)
- Yük: `--kisi 97` 30 dk — tik < 50 ms, JSON boyutu, bellek sabit, 5 SSE istemcisi. Yavaş istemci kesme, gövde sınırı 1 MB /
  413, metin kırpma, günlük (`yakinlik.log`, döner), `wheelhouse/` ile çevrimdışı kurulum provası, Windows MIME/COM notları,
  `docs/DAGITIM.md` (etkinlik sabahı kontrol listesi).
- **Kabul:** yük ölçümleri belgede; temiz makinede `pip install --no-index` başarılı; `baslat.sh` tek komutla açıyor.

#### B8 ⬜ Donanım ve geçiş günü (Muhittin'e bağlı; tahmin: 2–3 gün)
- Seri paket biçimi belgesi (`docs/SERI_PROTOKOL.md`) → `giris/seri.py` (pyserial thread → kuyruk, aygıt çekilince
  2 sn'de bir yeniden açma, `--seri auto` VID/PID) + ayrıştırıcı testleri; gerçek alıcıyla 10 dk iz kaydı → `tests/izler/`;
  `server.py` yumuşatması ile ortanca karşılaştırması; Soru 1–6 + 7–11 cevaplarının uygulanması; Faz 2–5 kabul akışları
  gerçek kartlarla; `SUNUCUDAN_ISTENENLER.md` "gerçekleşti" işaretleri; DEVİR NOTU güncellemesi; PR.
- **Kabul:** tüm ekranlar 390/768/1280'de gerçek veriyle; demo düğmeleri görünmüyor (`/api/demo` 404); gerçek kart masaya
  yaklaştırılınca < 2 sn'de tanınıyor; aygıt çekilince `receiverAge` büyüyor, takılınca < 5 sn'de toparlıyor; iz karşılaştırması
  Bölüm 12.3 ölçütünü sağlıyor; Soru 1–11 cevapları uygulanmış ya da kayıtlı.

**Sıra ve bağımlılık:** B0 → B1 → B2 zorunlu sıra. B3, B4, B5 B2'den sonra bu sırayla (masa → kartlar → rapor; brief §12
önceliği). B6 B3'ten sonra her an öne alınabilir (kayıt defteri kaybı en pahalı risk). B7 B6'dan sonra. B8 donanım gelince.

**Toplam:** ~18–20 iş günü (tek kişi; faz tahminlerinin toplamı). Donanım erişimi yalnız B8'de şart.

---

## 15. Riskler ve azaltma

| # | Risk | Etki | Azaltma |
|---|---|---|---|
| R1 | Seri paket biçimi belgesiz / değişken | B8 bloke | İlk iş: Muhittin'den biçim + 10 dk ham kayıt; ayrıştırıcı toleranslı (bozuk satır atlanır, sayaç tutulur) |
| R2 | `server.py` yumuşatması ile ortanca farklı karar veriyor | Kalibrasyon ekranı yanıltır | B8'de iz karşılaştırması; sözleşme (ortanca) esas, fark Muhittin'le konuşulur |
| R3 | Alıcı USB'de uyuyor / çekiliyor | Veri kesilir | Yeniden açma döngüsü, `receiverAge`, güç ayarı notu; arayüz "ALICI BAĞLI DEĞİL" bandı zaten var |
| R4 | 97 kişi / 500 çiftte JSON 200 KB × 2 Hz × 5 istemci | CPU/ağ | Tek serileştirme, yavaş istemci kesme, `history` yalnız teknik istemciye (ayrı karar) |
| R5 | Süreç çökmesi → gün kaybı | Kritik | B6 kalıcılık; tik sonu yazım; yedek; `baslat.sh` otomatik yeniden başlatma döngüsü (`until python …; do sleep 1; done`) |
| R6 | Windows'ta MIME `text/plain` | Sayfa açılmaz | Açık MIME tablosu (B0 kabulü) |
| R7 | Soru 1 (yedek kartlar panoda hayalet) kararsız kalır | Pano kirlenir | Varsayılan: yedek kart `people`'a **görüşmeye girince** eklenir; karar değişirse `atanmamis` bayrağı (bkz. Bölüm 16.3 madde 8) |
| R8 | "100+ kişi" ile 1–99 kart aralığı (Soru 6) | Kapasite | Sunucu kart aralığını ayardan okur (`KART_EN_BUYUK`); arayüz iki durumda da çalışıyor |
| R9 | Bağımlılık kurulumu etkinlikte internet yok | Kurulum başarısız | `wheelhouse/` repoda/USB'de; B7'de temiz makinede prova |
| R10 | Çift zaman kaynağı (duvar saati değişirse, NTP sıçraması) | `elapsed` kayar | `monotonic` esas; `clock` yalnız gösterim |

---

## 16. AÇIK SORULAR / BEKLEYENLER

### 16.1 Muhittin'e sorular
Hiçbiri B0–B2'yi engellemez; varsayılanlar bu belgededir. Soru 1–6'nın tam metni `SaasBridge/SUNUCUDAN_ISTENENLER.md`
§4 (Soru 1–4), §5 (Soru 5), §7 (Soru 6)'da.

| # | Soru | Öneri / varsayılan |
|---|---|---|
| 1 | Masadaki yedek kartlar panoda "Kart N" olmasın | Yedek kart `people`'a yalnız görüşmeye girince eklenir (R7); gerekirse `people[].atanmamis` |
| 2 | Yedek ile kayıtsız dolaşan kart ayırt edilebilir mi? | — |
| 3 | Atama geçmişi hangi biçimde tutulacak? | Bölüm 8.2 `GET /api/assignments` |
| 4 | `DELETE` kişinin raporlanmış sürelerini de silsin mi? | Silmesin; kişi `silindi` işaretlenir |
| 5 | Kalibrasyonda yedek kart çiftleri `signals/history`'de görünsün mü? | **Görünsün**; atanmamış kartlar da ölçülür, yalnız `people`'a girmez |
| 6 | "100+ kişi" ile 1–99 kart aralığı | Kart aralığı ayardan okunur (R8) |
| 7 | `alerts[].people` kart no; kart değişince eski bildirim yanlış kişiyi vurgular. `alerts[].kisiler` eklensin mi? | Eklensin (geriye uyumlu); arayüz varsa onu kullanır |
| 8 | `reset` kayıt defterini ve açık atamaları korusun mu? | Korusun (mock böyle; masa sabah kurulan listeyi kaybetmesin); eşik de korunur |
| 9 | Teknoloji ve bakım: Python mı, Node (mock evrimi + ayrı seri köprüsü) mi? | **Karar verildi (03.10.2026): Python.** Muhittin'e yalnız "bakımı kim yapacak" sorusu kaldı |
| 10 | `deal` süre tablosu: ★★ 11 · ★★★ 8 · ★★★★ 11 · ★★★★★ 8 (mock) brief §5.2 ile aynı mı? ★ ve yıldızsız için kural var mı? | Tabloyu `ayar`'a taşı, `GET /api/event` ileride |
| 11 | Seri paket biçimi, alıcı VID/PID, `batt` birimi (% mi, mV mi) | B8 öncesi yazılı belge (`docs/SERI_PROTOKOL.md`) |

### 16.2 Bekleyenler
- [ ] Soru 11'in cevabı (seri paket biçimi, VID/PID, `batt` birimi) — B8 öncesi.
- [ ] B2.6 (`SUNUCU=` ile mock testlerini dış sunucuya koşturma) **SaasBridge reposunda** ayrı onayla yapılır.
- [ ] SaasBridge reposunda eski bir `BACKEND_PLAN.md` kopyası duruyor ve o reponun `PLAN.md`'si ona bağlanıyor; silinmesi ya da
      bu dosyaya yönlendirilmesi SaasBridge reposunda ayrı onayla.
- [ ] B0 incelemesinden ertelenen küçük işler (B2 öncesi: açılış satırı ve uçların kayıt sırası; B7: Windows provası,
      `baslat.bat`, `wheelhouse/`): `docs/B0_NOT.md` → "Ertelenen küçük bulgular".
- [ ] B1 incelemesinden kalanlar: kayıt bitince yayın sürüyor ✅ (B2); etkinlik saati = kaynak saati, yeniden başlatmada
      sürmesi B6; `--tohum` B2.6 ile; benzetim tik kadansı (bekle-sonra-çalış kayması) açık. Ayrıntı: `docs/B1_NOT.md`.
- [ ] Arayüz reposu (SaasBridge), ayrı onay: "5 sn" yazan iki metin → 1 dakika (Rapor dipnotu, Kurulum çift tablosu), mock'un
      `GIRIS_SN` → 60, B2.6 (mock testlerini gerçek sunucuya koşturma). `docs/B2_NOT.md` → "Arayüz reposunda yapılması gerekenler".
- [ ] Grafik verisi (`history`) yükü: 3 saatte ~850 çift → tik ~50 ms, `/state` ~528 KB. Öneri: yalnız Kurulum açıkken
      göndermek (Bölüm 10 b; arayüz değişikliği) — karar bekliyor.

### 16.3 Plan ↔ kod çelişkileri (analiz 03.10.2026; karar bekliyor)
Bu plan ile `SaasBridge` kodu (mock ve testleri) karşılaştırılınca çıkanlar. Hiçbiri henüz karara bağlanmadı; planın ilgili
bölümleri değiştirilmedi. Madde 6 karara bağlandı (04.10.2026); diğerleri B2'den önce karara bağlanmalı.

1. **"Birlikte" kararı.** Bölüm 7 son 10 sn ortancası diyor; mock kararı **son ölçümle** veriyor (`mock.js:485`), ortanca yalnız
   `signals[].value` ve `above` için kullanılıyor. Hangisi esas?
   **Karar (05.10.2026, Şevval):** eşikle **10 sn ortancası** karşılaştırılır; ortanca eşiğin üstünde **kesintisiz 1 dakika**
   kalınca "birlikte" denir (1 dakikadan kısa yan yana gelişler sayılmaz). Bekleme dakikası görüşmeye sayılır. Çıkış kuralı
   aynı: 15 sn altta → biter. Arayüzde "5 sn" yazan iki metin (Rapor dipnotu, Kurulum çift tablosu) ve mock'un `GIRIS_SN`'i
   SaasBridge reposunda ayrı onayla güncellenecek.
2. **Mock'a özgü uçlara bağlı testler.** `kalibrasyon.test.js` (tamamı `/api/demo/tut`), `saglamlik.test.js` (`/api/demo` 200
   bekliyor), `cards.test.js` ve `inceleme.test.js` gerçek sunucuda geçemez; B2 ve B4 kabul listeleri buna göre düzeltilmeli.
3. **`SUNUCU=` tek adres yetmez.** 11 test dosyası 14 ayrı mock'u farklı bayraklarla (`--hizlandir`, `--anlasmaSn`, `--tohum`,
   `--kisi`, `--kopma`) ve taze durumla başlatıyor; B2.6'nın kapsamı yeniden tanımlanmalı.
4. **Katı alan kümesi testleri.** `mock.test.js` ve `api.test.js` alan adlarını birebir karşılaştırıyor; `idleSinceS`,
   `alerts[].kisiler`, `atanmamis` eklenince kırılır → mock ve testleri aynı anda güncellenmeli.
5. **FastAPI varsayılanları.** Testler JSON'u `Content-Type` başlığı olmadan yolluyor (pydantic gövde modeli 422 döner);
   doğrulama hatasının varsayılanı 422 `{detail}`, sözleşme 400 `{ok:false, hata}` → elle ayrıştırma ya da özel hata işleyici.
6. **Benzetim ↔ kayıt defteri.** Mock'ta ikisi iç içe (25 kişi kartlı başlar, iade edilen kart sahneden çıkar, eşleşme role
   bakar); burada benzetim yalnız paket kaynağı. Başlangıç kadrosunu kim kurar, kaynak atamayı nasıl öğrenir, kalıcılıkla
   nasıl birlikte yaşar?
   **Karar (04.10.2026, Şevval):** mock'taki düzen. Sunucu benzetim modunda açılınca 25 örnek kişi kartlarıyla hazır gelir
   (kadro benzetimde üretilir, sunucu kayıt defterini onunla kurar); masa kart verip iade ettikçe sahte kartlar salona
   girer / çıkar (sunucu benzetime haber verir); gerçek donanımda bunların hiçbiri devreye girmez. Kalıcılıkla birlikte
   yaşama ayrıntısı B6'da.
7. **Durum kodu sapmaları (Bölüm 8.2 ↔ mock).** Geçersiz `rol` (plan 400; mock `guest` yapıp 200), atanmamış ama bilinen kartın
   iadesi (plan 404; mock 200), `DELETE` (plan `silindi` işareti; mock kaydı siler).
8. **Yedek kart varsayılanı (R7).** Mock'ta yedekler benzetime hiç girmiyor, Kart 14 ise 45. sn'de zamanlayıcıyla ekleniyor;
   "görüşmeye girince eklenir" mock davranışı değil. Gerçekte masada yan yana duran açık yedekler birbirini güçlü duyup
   "birlikte" sayılabilir → Soru 1–2'nin cevabı B4'ten önce gerekli.
   **Not (B1, 05.10.2026):** bu durum benzetimde üretilemiyor: masadaki yedekler paket yollar ama kimseyle ölçülmez (mock ile
   aynı). B4 kabulü için ya gerçek donanım ya da yedeklerin birbirini duyduğu yeni bir benzetim ayarı gerekecek.

---

## 17. Bu belgenin bakımı
- Bu dosya sunucunun **tek planıdır**; sözleşme belgesi (`SaasBridge/SUNUCUDAN_ISTENENLER.md`) sözleşmenin **tek gerçek kaynağı** kalır.
- Her B fazı bittiğinde Bölüm 14'te ilgili başlık ✅ olur ve kısa "Yapıldı:" notu düşülür; DEVİR NOTU güncellenir.
- Sözleşme değişikliği (yeni alan, yeni uç) üç yerde birlikte yapılır: `SUNUCUDAN_ISTENENLER.md`, `http/semalar.py`,
  `mock-server/mock.js` (+test).
