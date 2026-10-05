# saasBridgeBackend — Yakınlık Takip Sistemi Sunucusu

Arayüzün (https://github.com/sevvalcilali/SaasBridge) gerçek sunucusu: alıcıdan gelen kart paketlerini işler,
"birlikte mi?" kararını verir, kişi / kart / atama / görüşme kayıtlarını tutar ve `/state`, `/events` (SSE),
`/control`, `/api/*` uçlarını arayüzle aynı adresten sunar.

- Tek plan belgesi: `PLAN.md` (önce bunu oku) — çalışma kuralları, mimari, veri modeli, sözleşme, kalıcılık, test,
  fazlar, riskler
- Sözleşme belgesi ve davranış referansı (mock): kardeş repo `SaasBridge` → `SUNUCUDAN_ISTENENLER.md`, `mock-server/mock.js`

**Durum (05.10.2026):**

- B0 (iskelet) ve B1 (benzetim, kayıt / oynatma, sinyal hesapları) bitti ve onaylandı: `docs/B0_NOT.md`, `docs/B1_NOT.md`.
- B2 (canlı durum: `/state`, `/events`, `/control`) bitti ve onaylandı: Pano, Kurulum ve Sunum benzetimle canlı veri
  alıyor (`docs/B2_NOT.md`).
- B3 (karşılama masası: kişiler, CSV, kart verme / iade / değişim) yazıldı, onay bekliyor (`docs/B3_NOT.md`). Kart listesi
  (`/api/cards`) B4'te, görüşme kayıtları ve rapor B5'te.
- Donanım (kartlar + alıcı) var ve test edildi; gerçek alıcıya bağlama B8'de.

Teknoloji: Python 3.11+, FastAPI + uvicorn, pyserial, SQLite (stdlib).

## Kurulum ve çalıştırma

Gereken: Python 3.11+. Arayüz reposu yan klasörde (`../SaasBridge`) ve derlenmiş olmalı (orada `npm run build`).

```bash
./baslat.sh                  # sanal ortam hazır değilse kurar, sunucuyu başlatır → http://localhost:8002
                             # (Windows: baslat.bat — henüz Windows'ta denenmedi)
./baslat.sh --port 8010      # argümanlar sunucuya geçer: --port --kaynak --dist --veri --seri
./baslat.sh --hizlandir 10   # benzetim: --kisi 40 --hizlandir 10 --kopma 0 --anlasma-sn 30; kayıt: --kaydet iz.jsonl / --kaynak kayit --iz iz.jsonl
```

Elle kurulum ve testler:

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # yalnız çalıştırmak için: requirements.txt
.venv/bin/python -m yakinlik                    # → http://localhost:8002 (ayarlar: config.toml; komut satırı ezer)
.venv/bin/pytest
```
