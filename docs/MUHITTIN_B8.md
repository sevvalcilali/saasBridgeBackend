# Devir notu: gerçek alıcıyı sunucuya bağlama (B8)

Muhittin için hazırlandı · 07.10.2026 · Sorular: Şevval

## Kısaca sistem

```
kartlar ──► alıcı (ESP32-S3) ──USB seri──► sunucu (bu repo, Python) ──► web arayüzü (aynı adres, arayuz/dist)
                                                                   └──► mobil uygulama (aynı Wi-Fi, /state + /events)
```

Sunucu şu an alıcı yerine bir **benzetimle** (sahte kartlar) çalışıyor. Senin işin yalnız **giriş tarafı**: alıcının
seri porttan gönderdiği satırları sunucunun anladığı `Paket` nesnelerine çevirmek. Paketler doğru gelince "birlikte mi"
kararı, Pano, Rapor ve mobil uygulama **hiç değişmeden** gerçek veriyle çalışır. Web ve mobil için ayrıca bir şey
yapman gerekmez.

## 1. Kurulum ve ilk çalıştırma

Gerekenler: Python 3.11+, Node 20+.

```bash
git clone https://github.com/sevvalcilali/saasBridgeBackend.git
cd saasBridgeBackend
cd arayuz && npm ci && npm run build && cd ..   # web arayüzünü bir kez derle
./baslat.sh                                     # sanal ortamı kurar, benzetimle açar → http://localhost:8002
```

Testler (ikisi de yeşil olmalı):

```bash
.venv/bin/python -m pytest       # sunucu
cd arayuz && npm test            # web arayüzü
```

## 2. İlk iş: seri biçimi yazılı olarak (kod yazmadan önce)

Alıcının paket biçimi bizde hiç belgelenmedi. Lütfen önce şunları gönder:

1. **`docs/SERI_PROTOKOL.md`** — bir satırın tam biçimi ve 2–3 gerçek örnek satır:
   - baud hızı, satır sonu, ayırıcı (JSON mu, virgüllü mü);
   - paketi gönderen kartın numarası;
   - o kartın duyduğu kartlar ve her birinin RSSI'ı (dBm);
   - alıcının o paketi duyduğu RSSI (varsa);
   - zaman damgası var mı, birimi ne;
   - 100 ve üstü numaralı dinleyici cihazlar nasıl görünüyor;
   - alıcının USB VID/PID değeri (Windows'ta COM, macOS/Linux'ta `/dev/tty…` bulunsun diye);
   - bozuk ya da yarım satır nasıl görünebilir.
2. **10 dakikalık ham kayıt** (`ham_kayit.txt`): en az 10 kart açıkken, kartlar birkaç kez yaklaşıp uzaklaşırken
   seri porttan gelen satırlar, olduğu gibi.

Bu ikisi gelince ayrıştırıcıyı birlikte yazarız, sen de yazabilirsin.

## 3. Kodda nereye dokunulacak

| Dosya | Ne |
| --- | --- |
| `yakinlik/giris/paket.py` | `Paket(kart, duyulanlar, t, alici_rssi)` — bütün kaynakların ürettiği tek nesne. Değiştirme, yalnız üret. |
| `yakinlik/giris/kaynak.py` | `PaketKaynagi` arayüzü ve `Tik`: her **0,5 sn**'de bir `Tik(t, paketler)` üretilir; paket gelmese de tik üretilir. |
| `yakinlik/giris/seri.py` | **Yeni dosya (senin işin).** pyserial ile ayrı iş parçacığında satır oku → ayrıştır → kuyruğa koy; `tikler()` her 0,5 sn'de kuyruktakileri `Tik` olarak verir. Bozuk satırı atla, sayacını tut (sunucu durmasın). |
| `yakinlik/giris/olustur.py` | `kaynak == "seri"` dalı şu an "henüz yok" hatası veriyor; buraya yeni kaynağı bağla. |
| `yakinlik/giris/benzetim.py`, `kayit.py` | Hazır örnekler: aynı arayüzü nasıl uyguladıklarına bak. |

Çalıştırma (komut satırı ayarları `config.toml`'u ezer):

```bash
./baslat.sh --kaynak seri --seri /dev/ttyUSB0      # Windows: baslat.bat --kaynak seri --seri COM5
./baslat.sh --kaynak seri --seri /dev/ttyUSB0 --kaydet iz.jsonl   # gerçek alıcıyı dosyaya da kaydet
./baslat.sh --kaynak kayit --iz iz.jsonl           # kaydı alıcı olmadan tekrar oynat (test için)
```

Gerçek alıcıyla veri `veri/yakinlik.sqlite`'a yazılır ve sunucu kapanıp açılınca kaldığı yerden sürer.

## 4. Dokunulmaması gerekenler

- **Sözleşme:** `arayuz/SUNUCUDAN_ISTENENLER.md`'deki uçlar ve alan adları (`/state`, `/events`, `/control`, `/api/*`).
  Bunlar değişirse web de mobil de bozulur. Testler bunu yakalar.
- **Karar kuralları:** `yakinlik/cekirdek/` (eşik, 1 dk giriş / 15 sn çıkış, ortanca). Gerçek alıcıda farklı davranması
  gerekiyorsa önce Şevval'le konuşalım.

## 5. "Bitti" sayılması için

- [ ] `docs/SERI_PROTOKOL.md` ve 10 dk ham kayıt repoda.
- [ ] `yakinlik/giris/seri.py` ve testleri (örnek satırlar, bozuk satır, dinleyici cihaz); `pytest` ve `npm test` yeşil.
- [ ] Gerçek alıcıyla `./baslat.sh --kaynak seri …` açılıyor; Pano'da kartlar görünüyor.
- [ ] Kurulum → Kart sağlığı: açık kartların hepsi "✓ iyi"; kapatılan kart 1 dk içinde "duyulmuyor".
- [ ] İki kart 1 dk yan yana kalınca Pano'da "birlikte", ayrılınca 15 sn sonra boşta.
- [ ] Telefonda Kurulum → Sunucu'ya bilgisayarın IP'si yazılınca mobil aynı veriyi gösteriyor.
- [ ] Gerçek alıcıdan alınmış bir `--kaydet` izi repoda (sonraki testler bunun üstüne kurulur).

## 6. Çalışma şekli

- `main`'e doğrudan gönderme yok: yeni dal aç, işini PR olarak gönder, Şevval onaylayınca birleşir.
- Ayrıntılı plan: `PLAN.md` (B8 bölümü ve riskler tablosu). Etkinlik bilgisayarına kurulum: `docs/DAGITIM.md`.
