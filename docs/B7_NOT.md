# B7 — Sertleştirme ve dağıtım: teslim notu

> 05.10.2026 · dal `b7-sertlestirme` · Durum: **bitti — Şevval onayladı (05.10.2026)** (bağımsız inceleme B8 ile birlikte)

- **Yük (97 kişi, 3 saat, 5 ekran):** 3. saatte tik başına 54 ms ve ekran başına 620 KB'tı; ~%60'ı yalnız Kurulum'un
  kullandığı sinyal grafiği. Şevval kararıyla grafik artık yalnız isteyen ekrana gidiyor (`?grafik=0`; isteyen yoksa
  hiç hesaplanmıyor): 3. saatte 12 ms ve 197 KB. Arayüz değişikliği: SaasBridge PR #2. Tablo: `docs/DAGITIM.md` §8.
- **Bekçi** (`python -m yakinlik.bekci`, `baslat.sh` / `.bat` bunu çalıştırır): sunucu çökerse 2 sn'de yeniden açar.
  Ctrl+C'de, ayar hatasında, port doluyken ve üst üste hızlı çöküşte durur; `--yeni-etkinlik`i tekrarlamaz; kendisi
  kapatılınca sunucuyu da kapatır.
- **Girdi sınırları ve günlük:** gövde 1 MB'ı aşarsa 413; ad, kurum ve not 200 karakterde kırpılır. `yakinlik.log`
  (5 × 5 MB) açılış satırına config, arayüz ve veri yollarını, yazma isteklerini ve bildirimleri yazar.
  `/api/health` artık alıcı yaşını, izleyici sayısını ve diske yazımın durumunu veriyor.
- **Çevrimdışı kurulum:** `araclar/wheelhouse_hazirla.sh` (+ `.bat`). macOS'ta temiz kopyada `./baslat.sh` paketleri
  yalnız `wheelhouse/`'tan kurdu ve açıldı. Windows betikleri düzeltildi (`py` yoksa `python`, hatada `pause`,
  `.gitattributes`) ama **Windows'ta denenmedi**. Etkinlik günü kontrol listesi ve yedekten dönme: `docs/DAGITIM.md`.
- B6'dan kalan küçükler kapandı: yabancı veritabanı dosyasına dokunulmadan reddediliyor; kapanış adımı motor hatasında
  da çalışıyor; kapanışta yazılamayan veri günlükte açıkça yazıyor.
- `pytest` 435/435 (B7'de 22 yeni). Kritik kurallar kod bozularak sınandı (4/4 yakalandı): bekçinin `--yeni-etkinlik`i
  tekrarlaması, parça parça gelen büyük gövdenin geçmesi, bekçi kapanınca sunucunun sahipsiz kalması, açılamayan
  sunucunun sonsuz yeniden başlatılması.
