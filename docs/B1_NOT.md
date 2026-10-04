# B1 — Giriş katmanı + sinyal işleme: teslim notu

> 04.10.2026 · dal `b1-giris-sinyal` · Durum: **kod bitti; Şevval'in onayı bekleniyor**

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
| `pytest` yeşil | ✅ 130/130 (B1'de eklenen: paket 10, sinyal 19, benzetim 14, kayıt 10, ayar +7) |
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

## B2 için notlar

- **Karar bekleyen:** "birlikte" kararı ortancayla mı, son ölçümle mi verilecek (PLAN 16.3 madde 1)? `SinyalDeposu`
  ikisini de veriyor (`value` ve `son`).
- **Veri gelmeyen çift:** susan kartın çifti, son (güçlü) ölçümüyle 10 sn daha sinyallerde kalır. Çift kararı "bu çiftten
  veri gelmiyor" durumunu ayrıca ele almalı (plandaki "12 sn paket yok" kuralı).
- Motor zamanı tikten okuyacak; kadroyu `kaynak.benzetim.kadro`'dan alacak. `--kaydet` açıkken kaynak sarıldığı için
  kadroya erişim yolu B2'de belirlenecek.
- `SinyalDeposu.unut(simdi, korunan=…)`: "birlikte" sayılan çiftler korunan olarak verilmeli (mock'taki kural).

## Doğrulanamayanlar ve sınırlar

- Mock karşılaştırması 60. saniye için yapıldı (planın ölçütü). Daha uzun koşularda (kayıp kart, kopma sonrası) sayılar
  madde 3 yüzünden mock'tan biraz ayrışır; ayrıca ölçülmedi.
- Gerçek donanım yok: `Paket` biçimi ve tik başına tek ölçüm varsayımı, seri paket biçimi gelince (B8) yeniden bakılmalı.
