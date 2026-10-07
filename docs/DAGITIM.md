# Dağıtım ve etkinlik günü

Bu belge sunucuyu etkinlik bilgisayarına kurmak ve etkinlik günü çalıştırmak içindir. Gerçek alıcıya bağlanma
(`--kaynak seri`) B8'de eklenecek; o zamana dek komutlar benzetimle denenir.

## 1. Önceden (internet varken, etkinlikten en geç bir gün önce)

1. Repo tek: `…/saasBridgeBackend` (sunucu kökte, web arayüzü `arayuz/` klasöründe).
2. Arayüzü derleyin: `arayuz/` klasöründe `npm ci && npm run build` → `arayuz/dist/`.
3. Kurulum paketlerini indirin. Bunu **etkinlik bilgisayarıyla aynı işletim sisteminde ve Python sürümünde** yapın,
   çünkü paketlerin bir kısmı derlenmiş ve sisteme özel:
   - macOS / Linux: `./araclar/wheelhouse_hazirla.sh`
   - Windows: `araclar\wheelhouse_hazirla.bat`

   Bu adım `wheelhouse/` klasörünü üretir (macOS'ta 21 paket).
4. İki klasörü `wheelhouse/` ile birlikte etkinlik bilgisayarına kopyalayın. Oraya Python 3.11+ kurulu olmalı;
   Windows'ta kurarken "Add to PATH" işaretlenmeli.
5. İlk açılış: `./baslat.sh` (Windows: `baslat.bat`). Paketler internetsiz `wheelhouse/`'tan kurulur, sunucu
   bekçiyle açılır. Prova macOS'ta temiz kopyada yapıldı; Windows'ta **denenmedi**.
6. Tablet ve salon ekranından `http://<bilgisayarın-yerel-ip>:8002` açılıyor mu, deneyin. Aynı Wi-Fi'da olmalılar.
   İşletim sistemi ilk açılışta gelen bağlantılar için izin isterse "izin ver" deyin (Windows: "Özel ağ").

## 2. Yeni etkinliğe başlarken

```bash
./baslat.sh --yeni-etkinlik     # eski veri veri/yedek/ altına taşınır (önce doğrulanır), sunucu boş başlar
```

Bu bayrağı yalnız bir kez verin. Sunucu çökerse bekçi onu bayraksız yeniden açar, böylece veri bir daha taşınmaz.
Kişi listesi masadaki CSV ile yüklenir (Kart Ver → CSV).

## 3. Etkinlik sabahı kontrol listesi

| # | Kontrol | Nasıl |
|---|---|---|
| 1 | Sunucu açık, doğru veriyle | Açılış satırı (`yakinlik.log`'un sonu): `config … (var)`, `arayüz … (var)`, `veri …/veri` |
| 2 | Alıcı takılı ve duyuyor | `http://localhost:8002/api/health` → `receiverAge` 2'den küçük; panoda "ALICI BAĞLI DEĞİL" yok |
| 3 | Veri diske yazılıyor | `/api/health` → `"veri": {"yaziliyor": true}` |
| 4 | Açılış yedeği alındı | `veri/yedek/yakinlik-acilis-<bugün>-….sqlite` var |
| 5 | Canlı akış | Pano canlı (saat ilerliyor); `/api/health` → `istemci` açık ekran sayısı kadar |
| 6 | Masa | Kart Ver → "Boştaki kartlar"da masadaki yedek kartlar görünüyor |
| 7 | Eşik | Kurulum → eşik dünkü / provadaki değer (kalıcıdır) |
| 8 | Kart sağlığı | Kurulum → "Kart sağlığı": duyulmayan ya da görünmeyen kart yok |
| 9 | Arayüz güncel | `arayuz/dist/` son `npm run build`'den |

## 4. Etkinlik sırasında

- **Sunucu çökerse:** bekçi 2 sn içinde yeniden açar. Ekranlar kendiliğinden bağlanır, veri kaldığı yerden sürer.
  Yarıda kalan görüşmeler kapanır; kişiler hâlâ yan yanaysa 1 dk sonra yeni görüşme olarak başlar.
- **Kapatmak:** terminalde Ctrl+C. Son durum diske yazılır.
- **"Sıfırla" (Kurulum):** süreler, görüşmeler, bildirimler ve atama geçmişi silinir. Kişiler, kartları ve eşik kalır.
  Silmeden önce `veri/yedek/yakinlik-sifirlama-….sqlite` alınır; yedek alınamazsa sıfırlama yapılmaz.
- **Günlük:** `yakinlik.log` (5 × 5 MB, döner). Açılış ve kapanış, yazma istekleri (kart verme, iade, sıfırlama …),
  bildirimler ve hatalar burada. Ölçümler yazılmaz.

## 5. Sorun giderme

| Belirti | Sebep ve çözüm |
|---|---|
| `ayar hatası: veri dosyası başka bir sunucu tarafından kullanılıyor` | Önceki sunucu hâlâ açık (başka bir pencerede). Onu kapatın. |
| `address already in use` | Port 8002'yi başka bir program kullanıyor. Onu kapatın ya da `--port 8010` verin; ekranlarda adres de değişir. Bekçi bunu yeniden denemez. |
| `bekçi: … üst üste kapandı; vazgeçildi` | Sunucu her açılışta hemen düşüyor. `yakinlik.log`'daki hatayı okuyun. |
| `/api/health` → `"yaziliyor": false` | Disk dolu ya da `veri/` yazılamıyor. Veri bellekte duruyor; yer açılınca kendiliğinden yazılır. Sunucuyu bu durumdayken **kapatmayın**: kapanırsa son yazımdan sonraki olaylar kaybolur. |
| Panoda "ALICI BAĞLI DEĞİL" | Alıcının USB kablosu (B8). Takılınca birkaç saniyede düzelir; sayaçlar o arada donar. |
| Ekranlarda "Sunucuya bağlanılamıyor" | Sunucu kapalı ya da ağ değişti. Adresi ve Wi-Fi'ı kontrol edin. |

## 6. Yedekten geri dönme

Örneğin yanlışlıkla "Sıfırla"ya basıldıysa:

1. Sunucuyu kapatın (Ctrl+C).
2. `veri/yakinlik.sqlite` dosyasını başka bir ada taşıyın (silmeyin), örneğin `veri/yakinlik-hatali.sqlite`.
3. İstediğiniz yedeği kopyalayın: `veri/yedek/yakinlik-sifirlama-….sqlite` → `veri/yakinlik.sqlite`.
4. `./baslat.sh` ile açın (`--yeni-etkinlik` vermeden).

Yedek dosyaları tek başına tam bir veritabanıdır. Açılış yedeklerinin en yeni 10'u tutulur; sıfırlama ve yeni etkinlik
yedekleri hiç silinmez.

## 7. Windows notları

- `baslat.bat` ve `araclar\wheelhouse_hazirla.bat` **henüz Windows'ta denenmedi**. Hata olursa pencere kapanmadan
  bekler (`pause`), mesaj okunabilir.
- Arayüz dosyalarının türleri (MIME) sunucuda sabit tablodan verilir. Windows kayıt defterindeki yanlış `.js` türü
  sayfayı bozmaz.
- Seri port (B8): Aygıt Yöneticisi'nde alıcının COM numarasına bakın (ör. `COM5`). Aynı anda başka bir program
  (Arduino IDE'nin seri ekranı gibi) portu açık tutmamalı.
- Güç: etkinlik boyunca uyku kapalı; Aygıt Yöneticisi → USB Kök Hub → Güç Yönetimi → "Güç tasarrufu için kapatılmasına
  izin ver" işaretsiz. Windows Update'i etkinlik gününe ertelenmiş olarak ayarlayın.

## 8. Yük ölçümü (B7)

Benzetimde 97 kişi, 3 saat, 5 canlı akış izleyicisi; `araclar/yuk_olc.py`, Apple M serisi dizüstü.

| Etkinlik dakikası | Duyulan çift | Tik (ort / p95), grafik isteyen yok | Ekran başına durum | Kurulum açıkken tik | Kurulum'a giden durum | Bellek |
|---|---|---|---|---|---|---|
| 30 | 173 | 2,2 / 3,1 ms | 56 KB | 7,2 ms | 141 KB | 32 MB |
| 60 | 320 | 4,2 / 5,1 ms | 85 KB | 16,9 ms | 243 KB | 35 MB |
| 120 | 596 | 8,1 / 9,0 ms | 142 KB | 35,3 ms | 436 KB | 40 MB |
| 180 | 850 | 12,1 / 15,1 ms | 197 KB | 54,1 ms | 620 KB | 45 MB |

- Hedef "tik < 50 ms" grafik isteyen ekran yokken 3 saat boyunca sağlanıyor. Kurulum açıkken 3. saatte aşılıyor.
  Kurulum etkinlik öncesinde kullanıldığından bu kabul edildi.
- Sinyal grafiğinin verisi (`history`) yalnız Kurulum'a gider. Pano, Sunum ve Masa `?grafik=0` ile bağlanır; ekran
  başına veri üçte birine iner (Şevval kararı, 05.10.2026; arayüz değişikliği SaasBridge PR #2).
- Bellek duyulan çift sayısıyla büyür. Çift sayısının üst sınırı olduğu (97 kartta en çok 4656) için bellek de sınırlıdır.
- Daha yavaş bir bilgisayarda süreler birkaç katına çıkabilir; tik aralığı 500 ms olduğu için pay geniştir.
