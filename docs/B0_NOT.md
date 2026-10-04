# B0 — İskelet: teslim notu

> 04.10.2026 · dal `b0-iskelet` · Durum: **kod bitti, Şevval'in onayı bekleniyor**

## Ne yapıldı

Sunucunun iskeleti: `python -m yakinlik` (ya da `./baslat.sh`) açılıyor, yandaki `SaasBridge/dist` klasöründeki derlenmiş
arayüzü ve `GET /api/health` ucunu aynı adresten sunuyor. Henüz veri yok: `/state`, `/events`, `/control` B2'de gelecek.

| Adım | Dosyalar | Ne |
|---|---|---|
| B0.1 | `pyproject.toml`, `requirements.txt`, `requirements-dev.txt`, `yakinlik/__init__.py`, `README.md` | Paket `yakinlik`, Python ≥3.11. Sürüm `__init__.py`'de, bağımlılıklar `requirements.txt`'te tek yerde; pyproject ikisini oradan okur |
| B0.2 | `yakinlik/ayar.py`, `config.toml` | Öncelik: varsayılanlar < `config.toml` < komut satırı (`--port --kaynak --dist --veri --seri`) |
| B0.3 | `yakinlik/saat.py` | `Saat` arayüzü; `GercekSaat` ve yalnız `ilerlet()` ile ilerleyen `SahteSaat` |
| B0.4 + B0.6 | `yakinlik/http/uygulama.py`, `tests/conftest.py`, `tests/http/` | Statik arayüz (tür tablosu elle), `/api/health`, tanımsız `/api/*` → 404 `{ok:false, hata}`, işleyici istisnası → 500 |
| B0.5 | `yakinlik/__main__.py` | `python -m yakinlik` uvicorn'u başlatır; Ctrl+C çıkış kodu 0 |
| B0.7 | `baslat.sh`, `baslat.bat` | `.venv` yoksa kurar (`wheelhouse/` varsa çevrimdışı), sunucuyu çalıştırır |

## Kabul ölçütleri (PLAN Bölüm 14, B0)

| Ölçüt | Sonuç |
|---|---|
| `pytest` yeşil | ✅ 33/33 (ayar 8, saat 3, HTTP 20, başlatma 2) |
| SaasBridge'de `npm run build` sonrası tarayıcıda `http://localhost:8002/` arayüz açılıyor, çökmüyor | ✅ 390 / 768 / 1280 genişlikte; yakalanmamış sayfa hatası yok (`docs/B0_ekran_*.png`) |
| `.js` dosyaları doğru MIME | ✅ `text/javascript` (`.css` → `text/css`) |
| `/api/demo` 404 | ✅ 404 `{"ok":false,"hata":"bilinmeyen uç"}`; `POST /api/yaklastir` de 404 |

**Plandan fark:** Plan ekranda "Veri bekleniyor…" yazacağını söylüyordu; görünen metin "Sunucuya bağlanılamıyor, yeniden
deneniyor…". Sebep: `/events` henüz yok (404), arayüz bunu bağlantı hatası sayıyor. Arayüzün doğru davranışı bu; B2'de
`/events` gelince kaybolur.

## Neyi neden böyle yaptım

Planın değer vermediği yerlerde verdiğim kararlar. Yanlışsa hepsi küçük değişiklikle döner.

1. **`host` ayarı eklendi, yalnız `config.toml`'dan.** Varsayılan `0.0.0.0` (PLAN Bölüm 11: tablet ve salon ekranı başka
   cihazdan bağlanır). B0.2'nin bayrak listesinde olmadığı için `--host` yok.
2. **`veri` ve `seri` varsayılanı boş.** Plan değer vermiyor; `veri`'yi B6, `seri`'yi B8 tanımlayacak.
3. **Etkinlik adı / alt başlık / tarih varsayılanları mock ile aynı** ("Yatırımcı Buluşması", "Yakınlık kartları · sahte
   veri", "28.09.2026 · Demo Salonu"). Benzetimle arayüz mock'takiyle aynı görünsün diye; gerçek etkinlikte
   `config.toml`'dan değiştirilir.
4. **`config.toml`'da bilinmeyen anahtar ve geçersiz `kaynak` hata verir.** Yazım hatası (`prot = 9000`) sessizce yok
   sayılırsa sunucu yanlış ayarla açılır ve kimse fark etmez.
5. **Bağımlılıklar kurulu sürüme sabitlendi** (`fastapi==0.142.2`, `uvicorn[standard]==0.54.0`, `pyserial==3.5`; geliştirme:
   `pytest==9.1.1`, `pytest-asyncio==1.4.0`, `httpx==0.28.1`). Etkinlik günü çevrimdışı kurulum aynı sonucu versin diye.
6. **FastAPI'nin `/docs`, `/redoc`, `/openapi.json` sayfaları kapalı.** Bu sayfalar internetten dosya ister; etkinlikte
   internet yok. Sözleşmenin tek kaynağı `SUNUCUDAN_ISTENENLER.md`.
7. **`dist/` dışına çıkan yollar 404** (`..` ve mutlak yol). Planda yazmıyordu; statik dosya sunan her uçta gerekir.
8. **Bilinmeyen uzantı `application/octet-stream`**, olmayan dosya düz metin 404. Arayüz `#/…` yönlendirmesi kullandığı için
   "her yolu index.html'e düşür" kuralı yok.
9. **Testler koddan önce yazıldı** (B0.6'nın testleri B0.4'ten önce), ikisi tek commit. Korumalar bilerek bozulup testlerin
   kırmızıya döndüğü görüldü (`dist/` dışı koruması, tür tablosu).
10. **Ayrı çalışma kopyası (worktree) yok**, `b0-iskelet` dalı aynı klasörde. Sunucu arayüzü `../SaasBridge/dist` göreli
    yolundan buluyor; başka klasörde bu yol bozulur.
11. **`index.html` `Cache-Control: no-cache` ile gider.** Arayüz yeniden derlenince dosya adları değişir; tarayıcı (özellikle
    tablet) eski `index.html`'i sormadan kullanırsa silinmiş `.js` dosyasını ister ve sayfa boş kalır.

## Doğrulanamayanlar

- **`baslat.bat` Windows'ta denenmedi** (bu makine macOS). `baslat.sh` temiz bir kopyada denendi: Python 3.11'i buldu
  (sistemdeki `python3` 3.9.6), `.venv` kurdu, sunucu açıldı; boş `wheelhouse/` ile kurulum başarısız olunca yarım `.venv`
  silindi. `.bat` B7 dağıtım provasında denenmeli.
- **`0.0.0.0` ile dinleme denenmedi.** Kabul denemesi `127.0.0.1` ile yapıldı; macOS güvenlik duvarı açık ve `0.0.0.0`
  "gelen bağlantılara izin verilsin mi?" penceresi açar. Sunucu varsayılan ayarla ilk çalıştırıldığında bu pencere çıkacak;
  tablet ve salon ekranı bağlanacaksa **İzin Ver** denmeli.
- Varsayılan `../SaasBridge/dist` yolu bu makinede `saasBridge` klasörüne çözülüyor (macOS büyük-küçük harf ayırmıyor).
  Harf duyarlı bir diskte klasör adı `SaasBridge` olmalı ya da `config.toml`'da `dist` düzeltilmeli.

## Ne kaldı / sıradaki

- B1 (giriş katmanı + sinyal işleme) ayrı onay bekliyor.
- B1.3'ten (benzetim kaynağı) önce PLAN Bölüm 16.3 madde 6 karara bağlanmalı: benzetimde başlangıç kadrosunu kim kurar,
  kaynak atamayı nasıl öğrenir.
- Arayüz reposunda `dist/` yeniden derlendi (`npm run build`); kaynak dosyalarına dokunulmadı.
