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
