# B5 — Görüşme kayıtları, atama geçmişi, bildirim kimlikleri: teslim notu

> 05.10.2026 · dal `b5-gorusme-rapor` · Durum: **bitti; Şevval'in onayı bekleniyor** (bağımsız inceleme B6 ile birlikte)

- `GET /api/sessions`: görüşme kayıtları `{a, b, start, end}` — kişi kimliği (kişisiz kart `"kart:N"`), etkinlik saniyesi,
  sürüyorsa `end: null`. Kayıt eşiğin aşıldığı ana geri tarihli açılır (bekleme dakikası sayılır): çift başına kayıt
  toplamı kenar dakikasıyla aynı. İade / değişimde açık kayıt kapanır; kişisiz kartın kayıtları karta kişi atanınca o
  kişiye geçer, kart iade edilirse "kayıtsız" kalır (sonraki sahibe geçmez). Sıfırlama temizler.
- `GET /api/assignments`: zaman damgalı atama geçmişi `{t, kisiId, kart, islem}` (ata / iade / geri_al / degisim).
- `alerts[].kisiler`: bildirimdeki kartların kişi kimlikleri, aynı sırayla (Soru 7 önerisi; geriye uyumlu ek alan).
- `pytest` 375/375 (B5'te 11 yeni); kritik kurallar (kaydın bekleme dakikasından başlaması, iadede kapanması, kişisiz
  kartın kaydının kişiye geçmesi) bilerek bozularak sınandı.
- **Tarayıcı (gerçek sunucu, benzetim ×20) 10/10:** kişi panelinde görüşme kayıtları; Rapor verisi, `katilimcilar.csv`
  (26 satır) ve `gorusmeler.csv` (15 satır) indi. B4'ten kalan masa maddeleri de doğrulandı: "bağlanılamıyor" bandı yok,
  boştaki kartlar şeridi (7 kart), kayıp kart şeridi, "Bu kart şu an … Geri alındı mı?" uyarısı, kart el değiştirme
  (kişi kimliğiyle), Kurulum'da kart sağlığı tablosu ("32 kart duyuluyor · sorun yok"). Görüntüler `docs/B5_*.png`
  (rapor 1280 / 768 / 390 px).
