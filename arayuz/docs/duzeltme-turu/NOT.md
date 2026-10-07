# Uçtan Uca Tarama ve Düzeltme Turu · Not

Tarih: 30.09.2026 · Dal: `faz-0-altyapi` (PR #1) · Test: **202/202 yeşil** · Faz 2 (11/11), Faz 3 (16/16), Faz 4 (13/13) ve Faz 5 (15/15) kabul senaryoları yeniden geçti.

## Tarama nasıl yapıldı

- **Kod incelemesi:** üç ayrı inceleme, her biri başka bir alana baktı:
  1. `api/` ve mock,
  2. ekranlar ve bileşenler,
  3. brief ile uygulamanın karşılaştırması.
- **Tarayıcı taraması** (üretim derlemesi):
  - 5 ekran × 2 tema × 4 genişlik (1280 / 900 / 600 / 375),
  - konsol hatası, yatay taşma, erişilebilir adı olmayan öğe ve dış adrese istek araması,
  - sunucu kopması ve klavye denemeleri.
- **Doğrulama:** incelemelerden gelen iddiaların önemlileri elle doğrulandı (tekrar üretildi ya da kodda görüldü).

## Düzeltilenler (onaylı kapsam: A + B + D + E)

| # | Sorun | Düzeltme |
|---|---|---|
| A1 | Akış ayrıştırıcı yalnız `\n\n` tanıyordu; gerçek (Python) sunucu `\r\n` yollarsa pano hiç veri göstermezdi | `\r\n` / `\r` da kabul; parça sınırında bölünen `\r\n` sahte olay üretmez (iki test; eski kodda kırmızıydı) |
| A2 | Mock tek hatalı istekte (`{"ad":5}`) çöküyordu | Hata 500 döner, süreç ayakta; metin alanları tip denetimli |
| A3 | Rapor "anlık görüntü" değildi: süren görüşmeler rapor açıkken ve CSV'de büyüyordu | Görüntüyle birlikte etkinlik saniyesi, saat, başlık ve anlaşma sayısı da donar (tarayıcıda 6 sn sonra birebir aynı) |
| A4 | Masa kopunca sessizce "0 kişi" gösteriyordu | Bant; son liste korunur ve solar; hiç yüklenmediyse açık uyarı; 3 sn'de bir yeniden dener |
| A5 | Kart no olarak 105, 0, "007" kabul ediliyordu | 1–99 doğrulaması (`api/kartNo.js`), "007" → 7; mock da doğrular |
| A6 | Sıfırlama atanmış Kart 14'ü düşürüyordu, "yaklaştır" artığı kalıyordu | İkisi de düzeldi; Kart 14 senaryosu ikinci kopya üretmez |
| B7 | Demo düğmeleri gerçek etkinlikte de görünecekti | Yalnız `GET /api/demo` olan sunucuda (mock) görünür |
| B8 | Sunucu adresi dört yerde ayrı ayrıydı | `client.js` `SUNUCU_ADRESI` tek değer; tüm api katmanları kullanır |
| B9 | 100+ dinleyici cihazlar masa/kurulum kart listelerine düşebilirdi | api katmanında elenir |
| D14 | Kişi paneli Escape ile kapanmıyor, odak panele geçmiyordu | Odak "Kapat"a geçer, Escape kapatır, odak açan satıra döner; düğme 40 px |
| D15 | Ağ düğümleri ekran okuyucuda görünmüyor, ama her biri Tab durağıydı | Pano ağı `role=group`; düğümler Tab durağı değil |
| D16 | Telefonda bildirime dokununca vurgu görünmüyordu | Kişiler sekmesine geçilir |
| D17 | Eşik kaydırıcısı dokunmatik iptalde kaydetmeyebilirdi | İptal ve odak kaybında da kaydeder, aynı değeri iki kez göndermez |
| D18 | "Ayşe Demir'da" | Ünlü uyumlu ek: Demir'de, Koç'ta, Kart 40'ta |
| D19 | Kayıp kart uyarıları ekran okuyucuda dakikada bir tekrar okunuyordu | Yalnız "N kart kontrol bekliyor" sayısı duyurulur |
| D20 | Panelin "Bugün kiminle" listesinde ve zaman çizelgesinde rol şekli yoktu | Eklendi (`RolSekli`) |
| E | Küçükler | Seçili "Kart ver"e tekrar basmak işi silmiyor; masa modu ve Kurulum perspektifi yenilemede korunuyor; boş yıldız ≥3:1; yatırımcı olmayana yıldız gitmiyor; kalibrasyonda seçili çift listeden düşmüyor; rapor başlığı ve "Kişi sayısı" sütunu; paneldeki sonsuz "Yükleniyor…"; 375 px'te durum satırı ve sunum araç çubuğu |

## Denendi, geri alındı

- **Masadaki "Kart bekliyor" filtresini kalıcı yapmak.** CSV yüklemesi bu filtreyi kendiliğinden açıyor. Kalıcı olunca atamadan sonra da açık kalıyordu ve kartı olan kişi (kart değişimi için) aramada bulunamıyordu. Faz 2 gerileme testi yakaladı; filtre eskisi gibi oturumluk kaldı.

## Kendi hatalarım

- **Faz 4 teslim notunda raporu "anlık görüntü" diye yazmıştım, doğru değildi.** Tarama yakaladı, A3'te düzeltildi.
- **Doğrulama betiklerinden biri kendi kabuğunu öldürdü.** Mock'u başlatan metin ile `pkill` deseni aynı komuttaydı. Bu, daha önce koyduğum "süreç öldürme ayrı komutta" kuralının ihlaliydi. Koda etkisi olmadı.

## Karar bekleyenler (C — dokunulmadı)

PLAN §4'e yazıldı:
1. Kişi satırında karşı rol sayısı yok.
2. Sıralama seçeneği ve "yalnız kaldı" / "Misafir" filtreleri yok.
3. Bildirimler 20'de kesiliyor.
4. Alıcı kopunca veri soluklaşmıyor.

Bildirim akışındaki yinelenen anahtar da PLAN §4'te hâlâ açık.
