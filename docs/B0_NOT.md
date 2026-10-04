# B0 — İskelet: teslim notu

> 04.10.2026 · dal `b0-iskelet` · Durum: **bitti — bağımsız incelemeden geçti, Şevval onayladı (04.10.2026)**

## Ne yapıldı

Sunucunun iskeleti: `./baslat.sh` (ya da `python -m yakinlik`) açılıyor, yandaki `SaasBridge/dist` klasöründeki derlenmiş
arayüzü ve `GET /api/health` ucunu aynı adresten sunuyor. Henüz veri yok: `/state`, `/events`, `/control` B2'de gelecek.

| Adım | Dosyalar | Ne |
|---|---|---|
| B0.1 | `pyproject.toml`, `requirements.txt`, `requirements-dev.txt`, `yakinlik/__init__.py`, `README.md` | Paket `yakinlik`, Python ≥3.11. Sürüm `__init__.py`'de, bağımlılıklar `requirements.txt`'te tek yerde; pyproject ikisini oradan okur |
| B0.2 | `yakinlik/ayar.py`, `config.toml` | Öncelik: varsayılanlar < `config.toml` < komut satırı (`--port --kaynak --dist --veri --seri`). `config.toml`'daki her hata (bilinmeyen anahtar, yanlış tür, bozuk dosya) açılışta dosyayı ve anahtarı söyleyen tek satırlık iletiyle durur |
| B0.3 | `yakinlik/saat.py` | `Saat` arayüzü; `GercekSaat` ve yalnız `ilerlet()` ile ilerleyen `SahteSaat` |
| B0.4 + B0.6 | `yakinlik/http/uygulama.py`, `tests/conftest.py`, `tests/http/` | Statik arayüz (tür tablosu elle), `/api/health`, tanımsız `/api/*` → 404 `{ok:false, hata}`, işleyici istisnası → 500; `dist/` dışına çıkan ya da bozuk yollar 404 |
| B0.5 | `yakinlik/__main__.py` | `python -m yakinlik` uvicorn'u başlatır; Ctrl+C çıkış kodu 0 |
| B0.7 | `baslat.sh`, `baslat.bat` | Sanal ortam hazır değilse kurar (`wheelhouse/` varsa çevrimdışı), sunucuyu çalıştırır |

## Kabul ölçütleri (PLAN Bölüm 14, B0)

| Ölçüt | Sonuç |
|---|---|
| `pytest` yeşil | ✅ 70/70 (ayar 27, saat 3, HTTP 33, başlatma 2, `baslat.sh` 5) |
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
4. **`config.toml` sıkı denetlenir.** Bilinmeyen anahtar (`prot = 9000`), yanlış tür (`esik = "-68"`, `port = "8002"`),
   bozuk ya da UTF-8 olmayan dosya açılışta hata verir. Sessizce yok sayılırsa sunucu yanlış ayarla açılır ve hata
   etkinlik sırasında çıkar. Not Defteri'nin dosya başına koyduğu işaret (BOM) kabul edilir.
5. **Bağımlılıklar kurulu sürüme sabitlendi** (`fastapi==0.142.2`, `uvicorn[standard]==0.54.0`, `pyserial==3.5`; geliştirme:
   `pytest==9.1.1`, `pytest-asyncio==1.4.0`, `httpx==0.28.1`). Etkinlik günü çevrimdışı kurulum aynı sonucu versin diye.
6. **FastAPI'nin `/docs`, `/redoc`, `/openapi.json` sayfaları kapalı.** Bu sayfalar internetten dosya ister; etkinlikte
   internet yok. Sözleşmenin tek kaynağı `SUNUCUDAN_ISTENENLER.md`.
7. **Statik dosya yolları dosya sistemine sorulmadan önce elenir.** `..`, mutlak yol, ters eğik çizgi, sürücü harfi ve
   NUL içeren yollar doğrudan 404. Planda yazmıyordu; statik dosya sunan her uçta gerekir (ayrıntı: aşağıda inceleme 1).
8. **Bilinmeyen uzantı `application/octet-stream`**, olmayan dosya düz metin 404. Arayüz `#/…` yönlendirmesi kullandığı için
   "her yolu index.html'e düşür" kuralı yok.
9. **Testler koddan önce yazıldı** (B0.6'nın testleri B0.4'ten önce), ikisi tek commit. Korumalar bilerek bozulup testlerin
   kırmızıya döndüğü görüldü.
10. **Ayrı çalışma kopyası (worktree) yok**, `b0-iskelet` dalı aynı klasörde. Sunucu arayüzü `../SaasBridge/dist` göreli
    yolundan buluyor; başka klasörde bu yol bozulur.
11. **`index.html` `Cache-Control: no-cache` ile gider.** Arayüz yeniden derlenince dosya adları değişir; tarayıcı (özellikle
    tablet) eski `index.html`'i sormadan kullanırsa silinmiş `.js` dosyasını ister ve sayfa boş kalır.
12. **`baslat.sh` "klasör var mı"ya değil "çalışıyor mu"ya bakar.** `.venv` içindeki Python çalışıyor ve sunucunun paketleri
    içe aktarılabiliyorsa dokunmaz; değilse `.venv`'i silip yeniden kurar.

## Bağımsız inceleme

Dalın tamamı, kodu yazmamış ayrı bir incelemeciye verildi. Sonuç: kritik bulgu yok, üç önemli bulgu. Üçü de bu dalda,
önce bulguyu yakalayan test yazılarak düzeltildi.

1. **Statik dosya yolu, denetlenmeden dosya sistemine soruluyordu.** Windows'ta `\\sunucu\paylasim\…` biçimli bir istek,
   sunucunun o adrese oturum açmasına (kimlik bilgisi sızması) ve yanıt gelene kadar kilitlenmesine yol açabilirdi; etkinlik
   Wi-Fi'ındaki her cihaz bunu tetikleyebilirdi. Ayrıca NUL içeren ya da çok uzun yollar 500 veriyordu. Artık böyle yollar
   dosya sistemine hiç sorulmadan 404 dönüyor. (Windows davranışı okunarak çıkarıldı, bu makinede denenemedi.)
2. **`config.toml`'da yanlış türdeki değerler sessizce kabul ediliyor ya da anlaşılmaz hata veriyordu.** Artık her biri
   açılışta "dosya: anahtar şu olmalı, gelen: …" iletisiyle duruyor (madde 4).
3. **Var olan her `.venv` klasörü "kurulu" sayılıyordu.** Kurulum yarıda kesilirse ya da proje klasörü Mac'ten Windows'a
   `.venv` ile kopyalanırsa sunucu anlaşılmaz bir hatayla açılmıyordu. Artık hazır olup olmadığına bakılıyor (madde 12).
   `baslat.sh` gerçek kurulumla da denendi: sağlam `.venv`'e dokunmadı, bozulanı silip yeniden kurdu.

Ayrıca iki test açığı kapatıldı: varsayılan `host`'un `0.0.0.0` olduğu ve tanımsız `/api` ucunun `PATCH` / `DELETE` için de
404 döndüğü artık testle kilitli.

### Ertelenen küçük bulgular

Hiçbiri B0'ın kabulünü etkilemiyor; ilgili fazda ele alınmak üzere buraya yazıldı.

- **`baslat.bat` (B7 Windows provası):** `py` başlatıcısı yoksa `python`'a düşmüyor; hata olunca çift tıklanan pencere
  hemen kapanıyor (`pause` yok); satır sonları için `.gitattributes` yok.
- **B2'de dikkat:** yeni uçlar iki "yakalayıcı" uçtan (`/api/{yol}` ve `/{yol}`) önce kaydedilmeli, yoksa gölgede kalır.
- **Açılış satırı (B2 öncesi):** sunucu hangi `config.toml`'u ve hangi `dist` klasörünü kullandığını yazmıyor. Yanlış
  klasörden çalıştırılırsa `config.toml` bulunmaz ve varsayılanlar sessizce kullanılır (`baslat.sh` doğru klasöre geçtiği
  için etkilenmez).
- `HEAD` istekleri desteklenmiyor (`curl -I /api/health` 404 gösterir; `curl` ile `GET` doğru çalışır).
- `no-cache` başlığı yalnız `/` için; `/index.html` doğrudan istenirse yok.
- Tür tablosunda yalnız plandaki uzantılar var. Arayüze resim, ikon ya da başka yazı tipi eklenirse tablo genişletilmeli.
- Yalnız üst düzey paketler sabit; alt bağımlılıklar çevrimiçi kurulumda değişebilir (B7 `wheelhouse/` ile donar).
  `baslat.sh` Python adaylarını `python3.13`'e kadar deniyor.
- `config.toml`'a "Windows yollarında `/` ya da tek tırnak kullanın" notu eklenebilir.
- **Plan notları:** R5'teki otomatik yeniden başlatma döngüsü ayar hatasında sonsuz döner (B6/B7'de ele alınmalı).
  `uvicorn[standard]` derlenmiş paketler getiriyor; `wheelhouse/` işletim sistemine özel olacak (B7).

## Doğrulanamayanlar

- **`baslat.bat` Windows'ta denenmedi** (bu makine macOS); inceleme düzeltmesi de ona okunarak uygulandı. B7 dağıtım
  provasında denenmeli.
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
