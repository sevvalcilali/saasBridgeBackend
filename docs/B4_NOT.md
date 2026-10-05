# B4 — Kartlar (`GET /api/cards`): teslim notu

> 05.10.2026 · dal `b4-kartlar` · Durum: **kod bitti; inceleme (B3 ile birlikte) ve Şevval'in onayı bekleniyor**

- `GET /api/cards`: alıcının duyduğu bütün kartlar (atanmış, masadaki yedek, iade dönmüş, 100+ dinleyici), numara
  sırasıyla; her kartta `rssiAlici` (alıcının duyduğu güç), `seenAgo`, `atanan` (kisiId), `pil` — en yeni paketten.
- Paketlere `alici_rssi` alanı eklendi (B1'de B4'e bırakılmıştı); eski kayıt izleri okunmaya devam eder (alan boş gelir).
  Benzetimde alıcı kartları mock'taki gibi masadan zayıf duyar; "yaklaştır ve tanı" gerçek kartla denenecek (B8).
- Masanın `/api/cards`'a bağlı kısımları artık veriyle çalışmalı: "boştaki kartlar" şeridi, kayıp kart şeridi, "Bu kart
  şu an … Geri alındı mı?" uyarısı, Kurulum'daki kart sağlığı; masadaki "bağlanılamıyor" bandı kalkmalı. Tarayıcıda
  doğrulama bir sonraki büyük arayüz fazında (B5, rapor) toplu yapılacak.
- `pytest` 359/359 (B4'te 6 yeni); kritik kurallar (kart sahibi, boştaki kartların listede olması, pilin en yeni
  paketten okunması) bilerek bozularak sınandı.

## B3 + B4 bağımsız incelemesi

Kritik bulgu yok; incelemeci 160 rastgele senaryoda (kart verme, iade, silme, rol değişikliği) temel kuralların
bozulmadığını gördü. Düzeltilenler: iade edilen kişisiz kartın ("Kart 14") panoda kalması ve süresinin kartın sonraki
sahibine geçmesi; kartını iade edip yeniden kart alan yatırımcıda eski "yalnız" sayacının yanlış uyarı üretmesi; kart
listesinin kapanmış boş kartları hiç unutmaması (artık 5 dk); kendi kendisiyle anlaşma kaydı; aşırı büyük yıldız değerinde
500. Ertelenen: değişimde kapanan kartın benzetimde iadeyle "dirilmesi" (yalnız benzetim), yanlışlıkla kart 14'ü alan
kişide "Geri al"ın devredilen süreyi geri almaması (mock da aynı). `pytest` 364/364.
