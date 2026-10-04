# saasBridgeBackend — Yakınlık Takip Sistemi Sunucusu

Arayüzün (https://github.com/sevvalcilali/SaasBridge) gerçek sunucusu: alıcıdan gelen kart paketlerini işler,
"birlikte mi?" kararını verir, kişi / kart / atama / görüşme kayıtlarını tutar ve `/state`, `/events` (SSE),
`/control`, `/api/*` uçlarını arayüzle aynı adresten sunar.

- Tek plan belgesi: `PLAN.md` (önce bunu oku) — çalışma kuralları, mimari, veri modeli, sözleşme, kalıcılık, test,
  fazlar, riskler
- Sözleşme belgesi ve davranış referansı (mock): kardeş repo `SaasBridge` → `SUNUCUDAN_ISTENENLER.md`, `mock-server/mock.js`

**Durum (03.10.2026):** plan yazıldı, kod yok; B0 (iskelet) onay bekliyor.

Teknoloji: Python 3.11+, FastAPI + uvicorn, pyserial, SQLite (stdlib).

## Kurulum ve çalıştırma

Gereken: Python 3.11+. Arayüz reposu yan klasörde (`../SaasBridge`) ve derlenmiş olmalı (orada `npm run build`).

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # yalnız çalıştırmak için: requirements.txt
.venv/bin/python -m yakinlik                    # → http://localhost:8002 (ayarlar: config.toml; komut satırı ezer)
.venv/bin/pytest
```
