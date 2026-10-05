# B1 — Giriş katmanı + sinyal işleme: teslim notu

> 04.10.2026 · dal `b1-giris-sinyal` · Durum: **bitti — bağımsız incelemeden geçti, Şevval onayladı (05.10.2026)**

## Ne yapıldı

Sunucunun veri tarafının ilk yarısı: sahte kart verisi üreten benzetim, veriyi dosyaya kaydedip geri oynatma ve sinyal
hesapları. **Ekranda henüz değişiklik yok:** bu parçaları çalışan sunucuya B2'deki motor bağlayacak.

| Adım | Dosyalar | Ne |
|---|---|---|
| B1.1 | `yakinlik/giris/paket.py` | `Paket`: gönderen kart, duyduğu kartlar (kart, dBm), pil, an. 100+ numaralı dinleyici cihaz işaretlenir, atılmaz |
| B1.2 | `yakinlik/giris/kaynak.py` | `PaketKaynagi` arayüzü ve `Tik` (tik anı + o tikin paketleri) |
| B1.3 | `yakinlik/giris/benzetim.py`, `yakinlik/ayar.py` | Mock'un `tik()` dinamiğinin paket üreten hali; 25 örnek kişilik kadro; `--kisi --hizlandir --kopma` |
| B1.4 | `yakinlik/giris/kayit.py`, `yakinlik/giris/olustur.py` | `--kaydet` ile iz kaydı, `--kaynak kayit --iz` ile oynatma; ayarlardan kaynak kurma |
| B1.5 | `yakinlik/cekirdek/sinyal.py` | Çift ölçümü, 10 sn ortancası, 90 sn'lik grafik serisi, son duyulma, unutma |

## Kabul ölçütleri (PLAN Bölüm 14, B1)

| Ölçüt | Sonuç |
|---|---|
| `pytest` yeşil | ✅ 168/168 (B1'de eklenen 98: paket 18, sinyal 22, benzetim 17, kayıt 32, ayar +9) |
| Benzetim 60 sn koşunca `signals` sayısı ve `history` uzunluğu mock'la aynı büyüklükte (±%10) | ✅ sinyal sayısı 9,07 (mock 8,80; +%3,1) · grafik uzunluğu 18,19 (mock 18,41; −%1,2) · penceredeki ölçüm sayısı 19,94 (mock 20,02) |
| Kayıt → oynatma aynı `signals` dizisini üretir | ✅ 400 tik (200 benzetim saniyesi: Kart 14, alıcı kopması, kayıp kart dahil) birebir aynı |

Mock değerleri nasıl ölçüldü: `mock.js`'in geçici bir kopyasında yalnız HTTP kısmı kesildi, kendi `tik()` kodu 300 farklı
tohumla 120 tik koşturuldu. Benzetim de 300 tohumla koşturuldu; karşılaştırma ortalamalar üzerinden ve testte kilitli.

## Neyi neden böyle yaptım

1. **Kaynak `list[Paket]` yerine `Tik` akışı üretiyor (plandan sapma).** Her tik kendi anını taşır; işleme katmanı
   "şimdi"yi kendi saatinden değil tikten okur. Üç sebep: alıcı kopukken (paket yok) zaman bilgisi kaybolmaz;
   `--hizlandir` ayrı bir saat hilesi gerektirmez; kayıttan oynatma, sayılar birebir aynı olduğu için hep aynı sonucu
   verir (ölçüm yaşları tam sınıra denk geliyor: 10,0 sn).
2. **Benzetimdeki sahte kişiler (Şevval'in 04.10.2026 kararı).** 25 örnek kişi mock'taki adlar, kurumlar ve oranlarla
   benzetimde üretiliyor ve `Benzetim.kadro` olarak dışarı açık; sunucu benzetim modunda kayıt defterini bununla kuracak.
   Kart verme / iade / sıfırlama ile benzetimi haberdar eden bağlantılar motorla birlikte B2–B3'te gelecek.
3. **Susan (kayıp) kartı başka kartlar da duymaz.** Mock'ta susan kartın çiftleri zayıf da olsa ölçülmeye devam ediyor;
   paket modelinde bu tutarsız olurdu (kapalı bir kartı kimse duyamaz).
4. **`Paket` plandaki dört alanla sınırlı.** Alıcının kartı duyma gücü (`rssiAlici`, `/api/cards` için) B4'te eklenecek.
5. **Yeni bayraklar çalışan sunucuda B2'ye kadar etkisiz.** `--kisi`, `--hizlandir`, `--kopma`, `--kaydet`, `--iz` okunuyor
   ve `kaynak_olustur(ayar)` ile kaynağa çevriliyor (testli); ama kaynağı çalıştıracak motor B2'de.
6. **Değerler yuvarlanmadan tutuluyor.** `/state`'teki tek ondalığa yuvarlama yayın katmanının işi (B2 `durum.py`).
7. **Ortanca mock'la aynı:** çift sayıda ölçümde iki ortadakinin büyüğü (Python'un hazır ortancası ikisinin ortalamasını alır).
8. **`--tohum` bayrağı yok** (B1.3 listesinde değildi); tohum benzetimin yapıcısında parametre, varsayılanı mock gibi 42.
9. **Kaynak kurma `giris/olustur.py`'de**, `giris/__init__.py`'de değil: çekirdek `Paket`'i içe aktarırken bütün kaynak
   modülleri yüklenmesin.
10. **Mock'tan aynen alınanlar:** alıcı kopukken benzetim dünyası donar; `--kisi` 97'de kırpılır (kart havuzu 2–99, 14 hariç);
    masadaki 6 yedek kart paket yollar ama kimseyle ölçülmez; pil değerleri aynı formülle üretilir.

## Bağımsız inceleme

Dalın tamamı, kodu yazmamış ayrı bir incelemeciye verildi (Fable'ın kullanım sınırı dolduğu için Opus ile). İncelemeci
benzetimi mock'un kendi koduyla 60, 300 ve 900. saniyede karşılaştırdı: fark en çok %2,4 (susan kart kararı yüzünden,
madde 3). Sonuç: bir kritik, sekiz önemli bulgu; hepsi bu dalda, önce bulguyu yakalayan test yazılarak düzeltildi.

1. **Kritik: `--kaydet` dosya siliyordu.** Var olan dosyanın üstüne sessizce yazıyordu; `--iz` ile aynı dosya verilince
   oynatılacak iz sıfırlanıyordu. Artık kaynak kurulurken reddediliyor (aynı dosya, var olan dosya, olmayan klasör); kayıt
   dosyası da var olan dosyanın üstüne yazmayacak biçimde açılıyor.
2. **Hız.** 97 kart / 850 çift yükünde (benzetimde ~3 saat sonra) sinyal çekirdeği tik başına 66 ms harcıyordu; bütçe 50 ms
   ve motor, bildirimler, JSON henüz eklenmedi. Ölçümler artık çift başına zamana göre sıralı tutuluyor, aralıklar ikili
   aramayla bulunuyor: **28 ms** (pencere + unutma 19 → 4 ms). Sonuçlar eski çekirdekle birebir aynı (5 tohum × 30 dakika
   benzetimde karşılaştırıldı). Kalan sürenin çoğu grafik serisi; bu B2 tasarımına not edildi (PLAN Bölüm 10).
3. **İz dosyası okurken alan türleri denetleniyor** (kart metin, dBm sonlu sayı, pil tam sayı, an sayı). Önceden bozuk bir
   iz, hatasını çekirdekte anlaşılmaz bir yerde veriyordu.
4. **Kart numarası tek biçim:** "007" → "7" (arayüzün `kartNoCoz` kuralı); `Paket` kurulurken çevriliyor, aynı kart iki ayrı
   kart sayılmıyor.
5. **Kişi kartı denetimi hiçbir girdide hata vermiyor.** "²" istisna fırlatıyor, Arapça rakamla 12 kart sayılıyordu; seri
   hattan bozuk bayt gelebileceği için (B8) önemli.
6. **Kaynak açılışta denetleniyor:** olmayan iz dosyası, `--kaynak kayit` olmadan verilen `--iz` ve `--hizlandir inf` artık
   sunucu açılırken hata veriyor, ilk tikte (sunucu yayındayken) değil.
7. **Kayıt açıkken kadroya ulaşılamıyordu:** `--kaydet` ile benzetim çalıştırılınca B2 açılışta çökecekti. Artık
   `kaynak.benzetim` her kaynakta var (kayıt kaynağında boş).
8. **Testsiz davranışlar testle kilitlendi:** hızlandırılmış zamanda kopmanın en az dört tik sürmesi, yatırımcı ile
   girişimcinin birbirini daha çok bulması, görüşmelerin 2–14 dakika sürmesi, kayıt sırasında her tikin diske yazılması,
   boş satırların atlanması. Önceki "ayrılan çiftler var" testi aslında susan kartın zorla ayrılan çiftleriyle geçiyordu;
   düzeltildi.
9. **`Tik.t`'nin açıklaması daraltıldı:** ölçüm saati. Etkinlik saatiyle (yeniden başlatmada sürmesi gereken `elapsed`)
   ilişkisi B2'de kararlaştırılacak.

Ayrıca geç gelen eski bir ölçüm artık en yeni değeri bozmuyor ve çifti erken sildirmiyor (hızlandırmanın doğal sonucu).

**Yöntem notu:** Testlerin kodu gerçekten yakaladığını, kodu bilerek bozup testin kırmızıya döndüğünü görerek sınıyorum.
Bu turda bir sonuç yanıltıcı çıktı: dosya boyutunu değiştirmeyen bir bozma aynı saniyede geri alınınca Python önbellekteki
eski derlemeyi kullanmaya devam etti. Denetimler artık önbellek kapalıyken yapılıyor ve son durum öyle yeniden doğrulandı.

### Ertelenen küçük bulgular

- Çökme sonrası yarım kalan son satır, izin tamamını okunamaz yapıyor (satır numaralı hata verir; satır elle silinebilir).
- Paketin anı "şimdi"den ilerideyse görülme yaşı eksi çıkıyor (0'a kırpılabilir).
- Benzetim kaynağı her tikten sonra sabit 0,5 sn bekliyor; işlem süresi kadar kayar. Kadansı B2'de motor sahiplenmeli.
- `--kaydet` 97 kartta saatte ~330 MB yazar; yardım metninde uyarı yok (altın dosyalar 5–10 dakikalık).
- `--kisi`, `--hizlandir`, `--kopma` `config.toml`'a yazılamıyor (B0.2 kararı; benzetimi gün boyu çalıştıran için istenebilir).

## B2 için notlar

- **Karar bekleyen:** "birlikte" kararı ortancayla mı, son ölçümle mi verilecek (PLAN 16.3 madde 1)? `SinyalDeposu`
  ikisini de veriyor (`value` ve `son`).
- **Veri gelmeyen çift:** susan kartın çifti, son (güçlü) ölçümüyle 10 sn daha sinyallerde kalır. Çift kararı "bu çiftten
  veri gelmiyor" durumunu ayrıca ele almalı (plandaki "12 sn paket yok" kuralı).
- **Saatler:** motor ölçüm yaşlarını tikten okuyacak. Etkinlik saati (`elapsed`) yeniden başlatmada sürmeli; `--hizlandir`
  ile görüşme kayıtlarının süresi ve kenar dakikaları aynı saatle sayılmalı (mock'ta ikisi de benzetim saniyesi).
- Kadro `kaynak.benzetim.kadro`'dan alınır (kayıt açıkken de çalışıyor).
- `SinyalDeposu.unut(simdi, korunan=…)`: "birlikte" sayılan çiftler korunan olarak (küme) verilmeli (mock'taki kural).
- **Kayıt kaynağı iz bitince durur;** motor yayını sürdürmeli (İ6: `/events` hiç kesilmez).
- **Yük:** duyulan çift sayısı etkinlik boyunca büyür (3 saatte ~850); `history`'nin yalnız Kurulum açıkken gönderilmesi
  (PLAN Bölüm 10 b) B2'de karar. Bölüm 7'deki "çift unutma" kuralı benzetimde hiç devreye girmez (ayrılan çiftler birbirini
  zayıf duymaya devam eder); bir şeyi sınırlamak için ona güvenilmemeli.
- **`--tohum`** B2.6'da (mock testlerini aynı tohumla koşturmak için) gerekecek.
- **Yedek kartlar:** `--kisi 97` ile masada yedek kart kalmaz (mock ile aynı); yük denemesi ve B4'ün yedek kart senaryosu
  ayrı koşulmalı. 16.3 madde 8'deki durum (yedeklerin birbirini duyması) benzetimde üretilemiyor.

## Doğrulanamayanlar ve sınırlar

- Mock karşılaştırması 60. saniye için yapıldı (planın ölçütü). Daha uzun koşularda (kayıp kart, kopma sonrası) sayılar
  madde 3 yüzünden mock'tan biraz ayrışır; ayrıca ölçülmedi.
- Gerçek donanım yok: `Paket` biçimi ve tik başına tek ölçüm varsayımı, seri paket biçimi gelince (B8) yeniden bakılmalı.
