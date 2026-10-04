# saasBridgeBackend — Yakınlık Takip Sistemi Sunucusu

Arayüzün (https://github.com/sevvalcilali/SaasBridge) gerçek sunucusu: alıcıdan gelen kart paketlerini işler,
"birlikte mi?" kararını verir, kişi / kart / atama / görüşme kayıtlarını tutar ve `/state`, `/events` (SSE),
`/control`, `/api/*` uçlarını arayüzle aynı adresten sunar.

- Tek plan belgesi: `PLAN.md` (önce bunu oku) — çalışma kuralları, mimari, veri modeli, sözleşme, kalıcılık, test,
  fazlar, riskler
- Sözleşme belgesi ve davranış referansı (mock): kardeş repo `SaasBridge` → `SUNUCUDAN_ISTENENLER.md`, `mock-server/mock.js`

**Durum (04.10.2026):** B0 (iskelet) bitti ve onaylandı: sunucu derlenmiş arayüzü ve `GET /api/health` ucunu sunuyor. `/state`, `/events`,
`/control` B2'de gelecek; o zamana kadar arayüz "Sunucuya bağlanılamıyor" gösterir. Teslim notu: `docs/B0_NOT.md`.
B1 (benzetim, kayıt / oynatma, sinyal hesapları) yazıldı, onay bekliyor: `docs/B1_NOT.md`.

Teknoloji: Python 3.11+, FastAPI + uvicorn, pyserial, SQLite (stdlib).

## Kurulum ve çalıştırma

Gereken: Python 3.11+. Arayüz reposu yan klasörde (`../SaasBridge`) ve derlenmiş olmalı (orada `npm run build`).

```bash
./baslat.sh                  # sanal ortam hazır değilse kurar, sunucuyu başlatır → http://localhost:8002
                             # (Windows: baslat.bat — henüz Windows'ta denenmedi)
./baslat.sh --port 8010      # argümanlar sunucuya geçer: --port --kaynak --dist --veri --seri
```

Elle kurulum ve testler:

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # yalnız çalıştırmak için: requirements.txt
.venv/bin/python -m yakinlik                    # → http://localhost:8002 (ayarlar: config.toml; komut satırı ezer)
.venv/bin/pytest
```
