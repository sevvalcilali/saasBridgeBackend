# saasBridgeBackend — Yakınlık Takip Sistemi (sunucu + web arayüzü)

Tek repo (07.10.2026'dan beri): **sunucu** (Python, kök klasör) ve **web arayüzü** (React + Vite, `arayuz/`).
Sunucu alıcıdan gelen kart paketlerini işler, "birlikte mi?" kararını verir, kişi / kart / atama / görüşme kayıtlarını
tutar ve `/state`, `/events` (SSE), `/control`, `/api/*` uçlarını derlenmiş arayüzle (`arayuz/dist`) aynı adresten sunar.
Arayüzün geçmişi korunarak eklendi (eski repo: https://github.com/sevvalcilali/SaasBridge). Mobil uygulama ayrı repoda:
https://github.com/sevvalcilali/saasBridgeMobil.

- Tek plan belgesi: `PLAN.md` (önce bunu oku) — çalışma kuralları, mimari, veri modeli, sözleşme, kalıcılık, test,
  fazlar, riskler
- Sözleşme belgesi ve davranış referansı (mock): `arayuz/SUNUCUDAN_ISTENENLER.md`, `arayuz/mock-server/mock.js`

**Durum (05.10.2026):**

- B0 (iskelet) ve B1 (benzetim, kayıt / oynatma, sinyal hesapları) bitti ve onaylandı: `docs/B0_NOT.md`, `docs/B1_NOT.md`.
- B2 (canlı durum: `/state`, `/events`, `/control`) bitti ve onaylandı: Pano, Kurulum ve Sunum benzetimle canlı veri
  alıyor (`docs/B2_NOT.md`).
- B3 (karşılama masası: kişiler, CSV, kart verme / iade / değişim) bitti ve onaylandı (`docs/B3_NOT.md`). Kart listesi
  (`/api/cards`) B4'te geldi (`docs/B4_NOT.md`); görüşme kayıtları, atama geçmişi ve rapor B5'te (`docs/B5_NOT.md`).
- B6 (kalıcılık + sıfırlama): veri SQLite'ta, sunucu yeniden açılınca kaldığı yerden sürer (`docs/B6_NOT.md`).
- B7 (sertleştirme + dağıtım): bekçi, girdi sınırları, günlük, çevrimdışı kurulum, yük ölçümü (`docs/B7_NOT.md`).
  Etkinlik bilgisayarına kurulum ve etkinlik günü kontrol listesi: **`docs/DAGITIM.md`**.
- Donanım (kartlar + alıcı) var ve test edildi; gerçek alıcıya bağlama B8'de. Muhittin için devir notu: **`docs/MUHITTIN_B8.md`**.

Teknoloji: Python 3.11+, FastAPI + uvicorn, pyserial, SQLite (stdlib).

## Kurulum ve çalıştırma

Gereken: Python 3.11+ ve Node 20+. Arayüz bir kez derlenir (sunucu `arayuz/dist`'i sunar):

```bash
cd arayuz && npm ci && npm run build && cd ..
```

Testler: sunucu `.venv/bin/python -m pytest`, arayüz `cd arayuz && npm test`. Arayüz geliştirme: `cd arayuz && npx vite`
(sunucu 8002'de açıkken, Vite istekleri ona yönlendirir).

```bash
./baslat.sh                  # sanal ortam hazır değilse kurar, sunucuyu başlatır → http://localhost:8002
                             # (Windows: baslat.bat — henüz Windows'ta denenmedi)
./baslat.sh --port 8010      # argümanlar sunucuya geçer: --port --kaynak --dist --veri --seri
./baslat.sh --hizlandir 10   # benzetim: --kisi 40 --hizlandir 10 --kopma 0 --anlasma-sn 30; kayıt: --kaydet iz.jsonl / --kaynak kayit --iz iz.jsonl
```

**Veri ve yedekler.** Gerçek alıcıyla (`--kaynak seri`) her şey `veri/yakinlik.sqlite` dosyasına yazılır: kişiler, kartlar,
görüşmeler, bildirimler, eşik. Sunucu kapanıp açılınca kaldığı yerden sürer (gece yarısını geçse de). Her açılışta ve her
"Sıfırla"dan önce `veri/yedek/` altına kopya alınır. Benzetim varsayılan olarak hiçbir şey saklamaz; denemek için `--veri veri`.

```bash
./baslat.sh --yeni-etkinlik  # yeni etkinlik: eski veri veri/yedek/ altına taşınır, sunucu boş başlar
```

`baslat.sh` sunucuyu **bekçiyle** çalıştırır: sunucu çökerse 2 sn içinde yeniden açılır (Ctrl+C ile kapanır). Günlük:
`yakinlik.log`. Etkinlikte internet yoksa paketler önceden `./araclar/wheelhouse_hazirla.sh` ile indirilir (`docs/DAGITIM.md`).

Elle kurulum ve testler:

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # yalnız çalıştırmak için: requirements.txt
.venv/bin/python -m yakinlik                    # → http://localhost:8002 (ayarlar: config.toml; komut satırı ezer)
.venv/bin/pytest
```
