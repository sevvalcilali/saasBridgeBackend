# saasBridgeBackend — Yakınlık Takip Sistemi Sunucusu

Arayüzün (https://github.com/sevvalcilali/SaasBridge) gerçek sunucusu: alıcıdan gelen kart paketlerini işler,
"birlikte mi?" kararını verir, kişi / kart / atama / görüşme kayıtlarını tutar ve `/state`, `/events` (SSE),
`/control`, `/api/*` uçlarını arayüzle aynı adresten sunar.

- Plan ve çalışma kuralları: `PLAN.md` (önce bunu oku)
- Mimari, veri modeli, sözleşme, kalıcılık, test, riskler: `BACKEND_PLAN.md`
- Sözleşme belgesi ve davranış referansı (mock): kardeş repo `SaasBridge` → `SUNUCUDAN_ISTENENLER.md`, `mock-server/mock.js`

**Durum (03.10.2026):** plan yazıldı, kod yok; B0 (iskelet) onay bekliyor.

Teknoloji: Python 3.11+, FastAPI + uvicorn, pyserial, SQLite (stdlib). Çalıştırma ve kurulum B0 ile gelecek.
