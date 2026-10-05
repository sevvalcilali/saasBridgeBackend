# B6 — Kalıcılık ve sıfırlama: teslim notu

> 05.10.2026 · dal `b6-kalicilik` · Durum: **bitti — Şevval onayladı (05.10.2026)** (B5+B6 bağımsız incelemesi yapıldı)

- **Ne kalıcı:** kişiler (silinenler işaretli), açık atamalar ve atama geçmişi, görüşme kayıtları, kim kimle kaç dakika,
  bildirimler, anlaşmalar, eşik, etkinlik saati. Tek dosya: `veri/yakinlik.sqlite` (SQLite, WAL). Her tikten ve her masa
  işleminden sonra yalnız değişen satırlar tek işlemde yazılır (büyük etkinlikte tik başına ~1,3 ms).
- **Yeniden açılış:** kaldığı yerden sürer (Şevval kararı: gece yarısını geçse de). Yarıda kalan görüşmeler son yazılan anda
  kapanır; kapalı kalınan süre görüşmeye yazılmaz ama etkinlik saatine eklenir. Kayıtlı eşik `config.toml`'dakini ezer.
- **Yedek:** her açılışta (en yeni 10 tutulur), her "Sıfırla"dan önce ve `--yeni-etkinlik`te `veri/yedek/` altına,
  doğrulanmış kopya. Yedek alınamazsa sıfırlama yapılmaz (500); yeni etkinlikte eski dosya yedeği doğrulanmadan silinmez.
- **Varsayılan:** kalıcılık gerçek alıcıda (seri) hep açık; benzetim mock gibi temiz başlar, `--veri veri` ile denenir.
  Aynı veri dosyasını ikinci bir sunucu açamaz. Yazım bozulursa (disk dolu) yayın sürer, veri bellekte bekler, düzelince yazılır.
- `pytest` 413/413 (B6'da 38 yeni; `kill -9` ile öldürülüp açılan sunucu testi dahil). Kritik kurallar kod bozularak
  sınandı (8/8 yakalandı): yedeksiz sıfırlama, yedekten önce son halin yazılmaması, doğrulamadan silme, yarım yazımın
  "yazıldı" sayılması, silinen kişinin kimliğinin yeniden kullanılması (iki yol), açık görüşmenin açılış anında kapanması,
  kapanışta veri dosyasının bırakılmaması.

## B5+B6 bağımsız incelemesi

Kritik bulgu yok. Üç önemli bulgu düzeltildi (her biri önce kırmızı test):
1. Sıfırlamadan sonra diske yazılamazsa masa "sıfırlandı" görüyor, yeniden başlatmada eski etkinlik geri geliyordu → artık
   500 ve açık ileti; bellek sıfır kalır, düzelince yazılır.
2. Açılış yedeği alınamazsa (disk dolu, klasör yazılamaz) sunucu hiç açılmıyordu → artık günlüğe yazıp açılır. Yeni
   etkinlik ve sıfırlama yedeği yine zorunlu; hata iletisi anlaşılır.
3. (B5) Kişi yanında durduğu yedek kartı kendine alınca "kendisiyle görüşme" kaydı kalıyordu → düşüyor (kenarla tutarlı).

Ertelenen küçükler: yabancı bir SQLite dosyası reddedilmeden önce WAL kipine çevriliyor; kapanıştaki son yazım
başarısızsa yeniden denenmiyor; kapanış adımı ayrı `finally`'de değil (bugün tetiklenemiyor). Karar bekleyen: silinen
kişinin görüşmeleri raporda "kayıtsız" görünüyor (adı diskte duruyor ama hiçbir uç vermiyor; sözleşme sorusu).
