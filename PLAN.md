# PLAN — Yakınlık Takip Sistemi Sunucusu (`saasBridgeBackend`)

> Bu repo, `SaasBridge` reposundaki arayüzün (Vite + React) **gerçek sunucusudur**: alıcıdan gelen kart paketlerini işler,
> "birlikte mi?" kararını verir, kişi/kart/atama/görüşme kayıtlarını tutar ve arayüze `/state`, `/events`, `/control`,
> `/api/*` uçlarını aynı adresten sunar. Sözleşme ve ürün kuralları arayüz reposunda tanımlıdır; burada **tekrar edilmez,
> bağlanır.** Ayrıntılı mimari/gerekçe: `BACKEND_PLAN.md` (bu repo).
>
> Okuma sırası: **Bölüm 0 (kurallar)** → `BACKEND_PLAN.md` Bölüm 1 ve 8 → **Bölüm 2 (Faz B)**.

## ⏩ DEVİR NOTU (03.10.2026)

- **Durum:** Plan yazıldı, **kod yok**. B0 onay bekliyor.
- **Kardeş repo:** https://github.com/sevvalcilali/SaasBridge — arayüz, mock sunucu (`mock-server/mock.js`, davranışın çalışan
  şartnamesi), sözleşme belgesi (`SUNUCUDAN_ISTENENLER.md`), gereksinim belgesi (`UI_TASARIM_BRIEF.md` §2, §5, §9).
- **Yerel düzen (öneri):** iki repo yan yana: `…/SaasBridge` ve `…/saasBridgeBackend`. Sunucu `../SaasBridge/dist`'i servis
  eder; geliştirmede SaasBridge'de `npx vite`, burada `python -m yakinlik --kaynak benzetim`.
- **Donanım yok.** Benzetim kaynağıyla ilerlenir; seri paket biçimi gelince B8.

## 0. ÇALIŞMA KURALLARI (pazarlıksız)

### Onay
1. **Onaysız hiçbir faza başlanmaz.** Her B fazı Şevval "başla" demeden başlamaz; faz bitince sonuç gösterilir, sonraki faz
   için yeniden onay alınır.
2. **Faz kapsamı dışına çıkılmaz.** Akla gelen ek işler bu dosyanın Bölüm 4'üne not düşülür, onayla sıraya girer.
3. **Yıkıcı / geri alınamaz işlemler ayrıca sorulur:** dosya silme, veri sıfırlama, git geçmişi değiştirme,
   **bağımlılık ekleme/çıkarma**, plan/mimari değişikliği.
4. **Belirsizlikte uydurma yok.** Brief'te ve sözleşmede cevabı olmayan karar önce Şevval'e (gerekirse Muhittin'e) sorulur.
   Seri paket biçimi bilinmiyor → ayrıştırıcı yazılmaz, arayüz bırakılır.

### Mimari
- `yakinlik/cekirdek/` → **saf**: I/O yok, zaman parametre (`simdi: float`); her kural birim testli.
- `yakinlik/http/` → ince katman: doğrulama (pydantic şema = sözleşme) + çekirdek çağrısı + JSON. İş kuralı yazılmaz.
- `yakinlik/giris/` → `PaketKaynagi` arayüzü; benzetim / kayıt / seri aynı `Paket`'i üretir.
- Alan durumunu **yalnız olay döngüsü** (`motor.py`) değiştirir; HTTP işleyicileri komut kuyruğuna bırakır.
- **Mock çalışan şartnamedir:** aynı girdiye aynı karar. Fark bulunursa önce mock'un neden öyle olduğu anlaşılır, sonra
  `SUNUCUDAN_ISTENENLER.md` güncellenir — asla sessizce sapılmaz.
- Mock'a özgü uçlar (`/api/demo`, `/api/yaklastir`, `/api/demo/tut`) burada **tanımlanmaz** (404).
- **Bağımlılıklar (tamamı):** `fastapi`, `uvicorn[standard]`, `pyserial`; geliştirme: `pytest`, `pytest-asyncio`, `httpx`.
  Başka paket onaysız eklenmez. YAGNI: ihtiyaç doğmadan soyutlama/ayar eklenmez.
- Tek sorumluluk: bir dosya bir iş. Tanımlayıcılar Türkçe ve tutarlı (arayüzle aynı kavram sözlüğü, brief §3);
  sözleşme alan adları (`people`, `seenAgo`, `kisiId`…) **aynen** korunur.

### Ürün kuralları (sunucuya düşen kısmı)
- Kart no **1–99 kişi, 100+ dinleyici cihaz**; dinleyiciler `people/edges/live/signals/history`'ye girmez.
- **Kişi ≠ kart:** süreler, kenarlar, görüşme kayıtları kişiye (`kisiId`, kişisiz kart için `"kart:N"`) yazılır; `/state`
  yayınlanırken o anki karta çevrilir.
- Metre/cm/konum **üretilmez**; dBm dışında mesafe yok.
- Birimler: `live/min/invMin/edges.min` **dakika**; `seenAgo/receiverAge/elapsed` **saniye**. `clock` ve `elapsed` aynı andan.
- Alıcı yokken de `/events` 2 Hz yayın yapar; veri donar, akış kesilmez.
- Tamamen çevrimdışı kurulabilir ve çalışır.

### Doğrulama sırası (her değişiklik)
1. `pytest` tamamen yeşil. 2. SaasBridge'de `npm run build`. 3. Arayüz tarayıcıda **gerçek sunucuyla** denenir
(390 / 768 / 1280). 4. Her adım kendi commit'i; bu dosyada ilgili adım ✅ + kısa "Yapıldı:" notu; faz sonunda `docs/Bn_NOT.md`.

## 1. VERİLMİŞ KARARLAR

| Konu | Karar (03.10.2026, Şevval) | Not |
|---|---|---|
| Dil / çatı | **Python 3.11 + FastAPI + uvicorn + pyserial**, SQLite (stdlib) | `BACKEND_PLAN.md` Bölüm 3; Muhittin'in Python kodu taşınabilir |
| Konum | **Ayrı repo** (`saasBridgeBackend`) | Arayüz reposuyla karışmasın; sözleşme belgesi arayüz reposunda kalır |
| Donanım | **Yok → benzetimle başlanır** | Seri katman arayüz olarak bırakılır, B8'de tamamlanır |
| Sözleşme | `SaasBridge/SUNUCUDAN_ISTENENLER.md` + brief §5.1 **değişmez** | Değişiklik gerekiyorsa üç yerde birlikte: sözleşme belgesi, `http/semalar.py`, `mock.js` |

## 2. FAZLAR

Durum işaretleri: ⬜ onay bekliyor · 🟡 devam ediyor · ✅ bitti ve onaylandı

### ⬜ Faz B — Gerçek sunucu (Python) (planlandı 03.10.2026, onay bekliyor)

**Amaç:** Arayüzün mock'tan aldığı her şeyi gerçek bir sunucudan, aynı sözleşmeyle vermek. Ayrıntılı gerekçe, mimari,
veri modeli, kurallar ve riskler `BACKEND_PLAN.md`'de (bu repoda); **burası uygulama sırası ve kabul ölçütleridir.** Her B fazı
ayrı onayla başlar (Bölüm 0 kuralı), kendi commit'lerini alır, sonunda `docs/Bn_NOT.md` yazılır.

**Verilen kararlar (03.10.2026, Şevval):** Python 3.11 + FastAPI + uvicorn + pyserial; **ayrı repo (bu repo, `saasBridgeBackend`)** —
arayüz `SaasBridge` reposunda kalır; donanım ve seri paket biçimi **yok** → benzetim kaynağıyla başlanır, seri katman
arayüz olarak bırakılır. Bağımlılıklar (tamamı): `fastapi`, `uvicorn[standard]`, `pyserial`; geliştirme: `pytest`,
`pytest-asyncio`, `httpx`. **Başka paket onaysız eklenmez.**

**Sunucu için mimari kuralları (Bölüm 0'ın karşılığı):**
- `yakinlik/cekirdek/` → **saf**: I/O yok, zaman parametre (`simdi: float`), her kural birim testli.
- `yakinlik/http/` → ince katman: doğrulama (pydantic şema = sözleşme) + çekirdek çağrısı + JSON. İş kuralı yazılmaz.
- `yakinlik/giris/` → `PaketKaynagi` arayüzü; benzetim / kayıt / seri aynı `Paket`'i üretir.
- Alan durumunu **yalnız olay döngüsü** (`motor.py`) değiştirir; HTTP işleyicileri komut kuyruğuna bırakır.
- Mock (`SaasBridge/mock-server/mock.js`) **çalışan şartname**: aynı girdiye aynı karar. Fark bulunursa önce mock'un neden öyle
  olduğu anlaşılır, sonra sözleşme belgesi (`SUNUCUDAN_ISTENENLER.md`) güncellenir — asla sessizce sapılmaz.
- Mock'a özgü uçlar (`/api/demo`, `/api/yaklastir`, `/api/demo/tut`) gerçek sunucuda **tanımlanmaz** (404).
- Kart no 1–99 kişi, 100+ dinleyici; metre/cm/konum üretilmez.

**Geliştirme döngüsü:** `python -m yakinlik --kaynak benzetim --port 8002` (bu repo) + `SaasBridge` kökünde `npx vite`
(Vite proxy'si zaten 8002'ye gider). Doğrulama sırası: `pytest` yeşil → `npm run build` → arayüz tarayıcıda gerçek sunucuyla (390/768/1280).

#### B0 ⬜ İskelet (tahmin: 1 gün)
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

#### B1 ⬜ Giriş katmanı + sinyal işleme (tahmin: 2 gün)
- **B1.1** `giris/paket.py`: `Paket{kart: str, duyulanlar: [(kart, rssi)], pil: int|None, t: float}` dataclass; 100+ kart
  işaretlenir ama **atılmaz** (`/api/cards` için). Ayrıştırıcı **yok** (biçim bilinmiyor) — `SeriKaynak` B8'de.
- **B1.2** `giris/kaynak.py`: `PaketKaynagi` arayüzü (`async def paketler() -> AsyncIterator[list[Paket]]`, tik başına liste).
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

#### B2 ⬜ `/state` · `/events` · `/control` eşdeğerliği (tahmin: 3 gün) — pano, kurulum, sunum gerçek sunucuyla
- **B2.1** `cekirdek/cift.py`: eşik karşılaştırması, 5 sn giriş / 15 sn çıkış histerezisi, `together`, `birlikteSn`;
  `cekirdek/kenar.py`: kişi kimliği (`kisiId` ya da `"kart:N"`) ile dakika birikimi (başladığı tik dahil), `invMin`, `invPeers`.
- **B2.2** `cekirdek/bildirim.py`: `deal` (yıldız tablosu, `rules.dealAfterS` zorlaması), `repeat` (kişi çifti), `idle_investor`
  (6 dk, `seenAgo<30`), `lost` (60 sn, tekrar duyulunca sıfırlanır), `no_investor` (kapalı); `clock` + `t`; `people` kart no.
  **`idleSinceS`** burada sayılır.
- **B2.3** `cekirdek/durum.py`: brief §5.1 nesnesi — `people` rol sırası, `status` (talking/idle/away), `withName`, `live` dk,
  `stats`, `event.progress`, `clock` ve `elapsed` **aynı andan**, `threshold`, `signals`, `history`, `chartSeconds`, `rules`.
  100+ cihaz hiçbir koleksiyonda yok. Kartı olmayan kişi yok.
- **B2.4** `motor.py`: 500 ms tik; kuyruktan paketler → sinyal → çift → kenar → bildirim → `durumUret()` **bir kez** →
  JSON **bir kez** → SSE istemcilerine aynı tampon. Alıcı kopukken (paket yok) sayaçlar donar, `seenAgo`/`receiverAge` büyür,
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
  Durum kodları `BACKEND_PLAN.md` Bölüm 8.2. Atama geçmişi listesi (`GET /api/assignments`) burada **kaydedilir**, B5'te sunulur.
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
  `GET /api/sessions` (etkinlik sn, 1 ondalık, `end:null`), `GET /api/assignments`, `alerts[].kisiler` (Yeni Soru 7 —
  geriye uyumlu ek alan).
- **Kabul:** `oturum.test.js` eşdeğeri (çift başına kayıt toplamı ≈ `edges.min` ±1 tik); Faz 4 kabul 13/13 (zaman çizelgesi,
  rapor, iki CSV) gerçek sunucuyla.

#### B6 ⬜ Kalıcılık + sıfırlama (tahmin: 2 gün)
- `depo/sema.sql` + `depo/sqlite.py` (WAL): kişi, atama, oturum, kenar, bildirim, anlaşma, ayar (eşik, başlangıç zamanı,
  etkinlik). Tik sonunda yalnız **değişenler**, tek işlem. Açılışta yükleme; açık oturumlar yeniden başlatmada kapatılır;
  `elapsed` sürer. `reset`: süreler/kenarlar/kayıtlar/bildirimler/atama geçmişi silinir, **kişiler + açık atamalar + eşik kalır**
  (Yeni Soru 8 varsayılanı); reset öncesi otomatik yedek kopyası. Eşik artık **kalıcı** (brief §5).
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

**Sıra ve bağımlılık:** B0 → B1 → B2 zorunlu sıra. B3, B4, B5 B2'den sonra bu sırayla (masa → kartlar → rapor; brief §12
önceliği). B6 B3'ten sonra her an öne alınabilir (kayıt defteri kaybı en pahalı risk). B7 B6'dan sonra. B8 donanım gelince.

---

## 3. PROJE YAPISI (hedef; Faz B ile dolar)

```
saasBridgeBackend/
├─ PLAN.md · BACKEND_PLAN.md · README.md
├─ pyproject.toml · requirements.txt · requirements-dev.txt · config.toml · baslat.sh · baslat.bat
├─ yakinlik/
│  ├─ __main__.py · ayar.py · saat.py · motor.py
│  ├─ giris/      paket.py · kaynak.py · benzetim.py · kayit.py · (seri.py — B8)
│  ├─ cekirdek/   sinyal.py · cift.py · kenar.py · bildirim.py · durum.py · kisi.py · atama.py · oturum.py · csv_ice.py
│  ├─ http/       uygulama.py · durum_uclari.py · api_uclari.py · semalar.py
│  └─ depo/       sema.sql · sqlite.py
├─ tests/         cekirdek/ · http/ · izler/ · conftest.py
├─ docs/          B0_NOT.md … · DAGITIM.md · SERI_PROTOKOL.md
└─ veri/          (git'te yok) etkinlik-*.sqlite · yedek/
```

## 4. AÇIK SORULAR / BEKLEYENLER

- [ ] Muhittin'e sorular: `SaasBridge/SUNUCUDAN_ISTENENLER.md` §4 (Soru 1–4), §5 (Soru 5), §7 (Soru 6) ve `BACKEND_PLAN.md`
      Bölüm 16 (Soru 7–11). Hiçbiri B0–B2'yi engellemez; varsayılanlar `BACKEND_PLAN.md`'de.
- [ ] Seri paket biçimi, alıcı VID/PID, `batt` birimi — B8 öncesi yazılı belge.
- [ ] B2.6 (`SUNUCU=` ile mock testlerini dış sunucuya koşturma) **SaasBridge reposunda** ayrı onayla yapılır.
