# B3 — Karşılama masası: teslim notu

> 05.10.2026 · dal `b3-karsilama-masasi` · Durum: **bitti — Şevval onayladı (05.10.2026)**; bağımsız inceleme B4 ile birlikte (iki fazda bir)

## Ne yapıldı

Karşılama masası (Kart Ver ekranı) gerçek sunucuyla çalışıyor: kişi ekleme ve düzenleme, CSV ile toplu yükleme, kart
verme, geri alma, kart değişimi, başkasındaki kartı alma ve kart iadesi. Benzetimde masa kart verip iade ettikçe sahte
kartlar salona girip çıkıyor (16.3 madde 6 kararı).

| Dosya | Ne |
|---|---|
| `cekirdek/kisi.py` | Kayıt defteri: ekle, düzenle, sil, kart bağla / bırak. Geçersiz rol misafir sayılır, metin olmayan alan yok sayılır, yıldız yalnız yatırımcıda (0–5), renk doğarken atanır ve değişmez, kimlik ve renk sırası silinenle kaymaz |
| `cekirdek/atama.py` | Kart verme, iade, geri al, değişim; zaman damgalı atama geçmişi (sunumu `GET /api/assignments` ile B5'te) |
| `cekirdek/csv_ice.py` | CSV: `;` `,` sekme, Türkçe / harfsiz başlık, tırnak ve `""`, BOM, satır numaralı atlama gerekçeleri, aynı ad + kurum ikinci kez eklenmez |
| `cekirdek/alan.py`, `cekirdek/kenar.py` | Kart el değiştirince açık görüşmeleri kapanır; kimseye verilmemiş kartın ("Kart 14") süreleri ve anlaşmaları karta kişi atanınca o kişiye geçer |
| `giris/benzetim.py` | `kart_ver` / `kart_al`: masadan verilen kart salona girer, iade edilen masaya döner, değişimde bırakılan kart kapanır |
| `motor.py`, `http/api_uclari.py` | `GET/POST /api/people`, `PATCH/DELETE /api/people/{id}`, `POST /api/people/import`, `POST /api/assign`, `POST /api/unassign`; her değişiklik panoda hemen görünür |

## Kabul ölçütleri (PLAN Bölüm 14, B3)

| Ölçüt | Sonuç |
|---|---|
| `pytest` yeşil | ✅ 353/353 (B3'te 84 yeni: kişi 15, atama 14, CSV 12, benzetim +4, uçlar 38, motor +1) |
| Mock'un `api`, `degisim`, `iade`, `iceaktar` (ve `saglamlik`) senaryoları Python'da | ✅ aynı senaryolar çekirdek ve HTTP testlerinde; mock'a özgü `/api/demo` ve `/api/yaklastir` hariç |
| Tarayıcıda masa akışları gerçek sunucuyla | ✅ 10/10: CSV (2 eklendi, 1 satır gerekçeyle atlandı), "Kart bekliyor" listesi, kart verme (panoda hemen), geri al, kart değişimi (uyarı + yeni kart), başkasındaki kartı alma, iade, kişi düzenleme; sayfa hatası yok (`docs/B3_masa_*.png`) |
| Faz 2 kabul akışı 11/11 | ⚠️ kısmen: `/api/cards`'a bağlı maddeler B4'te — "yaklaştır ve tanı", "boştaki kartlar" şeridi, kayıp kart şeridi ve "Bu kart şu an … Geri alındı mı?" uyarısı |

**Masada görünen bant:** `/api/cards` henüz olmadığı için masa ekranında "Sunucuya bağlanılamıyor … atama yapılamaz" bandı
çıkıyor; atama yine de çalışıyor. B4'te kaybolur.

## Neyi neden böyle yaptım

1. **Durum kodları sözleşme belgesine göre (16.3 madde 7).** Sözleşmenin tek kaynağı `SUNUCUDAN_ISTENENLER.md`; o ve mock
   aynı şeyi söylüyor, plan ise farklıydı. Geçersiz rol misafir sayılır (400 değil); adı olmayan ya da metin olmayan kişi 400;
   kişisi olmayan ama alıcının duyduğu kart iade edilebilir (200); hiç bilinmeyen kart 404. Plan Bölüm 8.2 buna göre düzeltildi.
2. **Kişi silinince listeden çıkar, süreleri silinmez** (Soru 4 varsayılanı). Kartı varsa önce iade edilir. Arayüz silmeyi
   kullanmıyor.
3. **Kart başkasındaysa eski sahip "ayrıldı" sayılmaz;** geçmişine "iade" yazılır.
4. **Kart el değiştirince ya da masaya dönünce açık görüşmesi kapanır** (biten görüşme sayılır), eşi serbest kalır.
   Kartın sinyal ölçümleri silinmez: kart açık durmaya devam ediyor.
5. **Kimseye verilmemiş karta kişi atanınca görüşme kesilmez;** o kartla geçen süre ve anlaşma o kişiye geçer.
6. **İstek gövdeleri elle ayrıştırılıyor (plandaki `semalar.py` yok).** Mock'un hoşgörüsü ve sözleşmedeki `400 {ok, hata}`
   gövdesi pydantic'in varsayılanlarıyla uyuşmuyor (16.3 madde 5). Kurallar çekirdekte ve testli.
7. **CSV'de rol ve başlık tanıma mock'tan geniş:** "INVESTOR" gibi büyük harfli İngilizce rol de tanınıyor. Mock Türkçe
   küçük harfe çevirirken bunu "ınvestor" yapıp kaçırıyordu; sözleşme "ı/i farkı gözetmeden" diyor.
8. **Benzetimde değişimle bırakılan kart kapanır** (mock ile aynı: pil bitmiş kart duyulmaz); iade edilen kart masaya döner.

## Yolda bulunan hata

Bir kişi, daha önce görüştüğü kimsesiz kartı kendi kartı olarak alırsa o dakikalar toplam süresine iki kez yazılıyordu.
Düzeltildi; "kişinin süresi = kenar dakikalarının toplamı" kuralı testle kilitli. (Kodu bilerek bozarak sınarken bulundu.)

## Sıradaki

- B4: `GET /api/cards` — masadaki "yaklaştır ve tanı", "boştaki kartlar", kayıp kart şeridi, "bu kart şu an …" uyarısı ve
  Kurulum'daki kart sağlığı. Faz 2'nin kalan maddeleri burada tamamlanır.
- B5: atama geçmişi (`GET /api/assignments`), görüşme kayıtları, rapor.
