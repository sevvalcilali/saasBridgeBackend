# B2 — /state · /events · /control: teslim notu

> 05.10.2026 · dal `b2-durum-yayin` · Durum: **kod bitti, bağımsız incelemeden geçti; Şevval'in onayı bekleniyor**

## Ne yapıldı

Arayüz ilk kez gerçek sunucudan canlı veri alıyor. **Pano, Kurulum ve Sunum** benzetimle çalışıyor: kişiler, görüşmeler,
ağ, istatistikler, bildirimler, eşik ayarı ve canlı sinyal grafiği. Masa (Kart Ver), kart sağlığı ve rapor için gereken
`/api/*` uçları B3–B5'te.

| Adım | Dosyalar | Ne |
|---|---|---|
| B2.1 | `cekirdek/cift.py`, `cekirdek/kenar.py` | "Birlikte" kararı: 10 sn ortancası eşiğin üstünde **kesintisiz 1 dakika** kalınca görüşme başlar, bekleme dakikası görüşmeye sayılır; 15 sn altta kalınca biter. Kim kimle ne kadar, kişi kimliğine yazılır |
| B2.2 | `cekirdek/bildirim.py`, `cekirdek/alan.py`, `cekirdek/kisi.py` | Bir tikin işlenişi (sinyal → karar → süreler → bildirimler). Bildirimler mock metinleriyle: anlaşma, yeniden bir arada, kart sinyali kesildi, önemli yatırımcı yalnız. Herkes için "kaç saniyedir boşta" (`idleSinceS`) |
| B2.3 | `cekirdek/durum.py` | `/state` nesnesi: mock'un çıktısıyla alan alan aynı biçim; tek ek alan `people[].idleSinceS` |
| B2.4 | `motor.py` | Her yarım saniyede bir tik; durum bir kez üretilir, bütün ekranlara aynı veri gider. Kaynak biterse ya da hata verirse yayın sürer |
| B2.5 | `http/durum_uclari.py`, `http/uygulama.py`, `__main__.py` | `GET /state`, `GET /events` (canlı akış), `POST /control` (eşik, sıfırla); motor sunucuyla açılıp kapanır |
| B2.6 | — | **Yapılmadı:** mock testlerini gerçek sunucuya koşturmak arayüz reposunda değişiklik ister (ayrı onay; aşağıda) |

## Kabul ölçütleri (PLAN Bölüm 14, B2)

| Ölçüt | Sonuç |
|---|---|
| `pytest` yeşil | ✅ 269/269 (B2'de 101 yeni: çift 7, alan 31, durum 19, benzetimle uçtan uca 6, motor 11, uçlar 19, canlı akış 4, ayar 4) |
| Brief §5.1 alanlarının tamamı | ✅ alan alan testli (mock'un şema testiyle aynı liste) |
| 2 Hz yayın, alıcı çekiliyken de | ✅ gerçek sunucu süreciyle: ilk mesaj 0,7 sn içinde, 1,5 sn'de en az 2 mesaj; alıcı kopukken iki mesaj arası hep 1,5 sn'nin altında |
| Kurulum eşiği değiştirip geri okuyor | ✅ tarayıcıda kaydırıcı −72 → −74, sunucudan okundu (`docs/B2_kurulum_*.png`) |
| Pano "bağlanılamıyor" göstermiyor; alıcı kopunca "ALICI BAĞLI DEĞİL" | ✅ 18 sn izlendi: "bağlanılamıyor" hiç çıkmadı; "ALICI BAĞLI DEĞİL" beklenen anda (11,8. sn, 10 kat hız) |
| Pano, Kurulum, Sunum 390 / 768 / 1280 | ✅ hepsi açılıyor, veri doğru, yakalanmamış sayfa hatası yok (`docs/B2_*.png`) |
| Faz 1, 3, 5 kabul ölçütleri | ⚠️ kısmen: ekranlar gerçek veriyle çalışıyor; faz teslim belgelerindeki maddeler tek tek koşulmadı (tarayıcı kabul betikleri repoda yok, PLAN 12.4'e göre B8'de yazılacak) |
| `SUNUCU=… npm run test:sunucu` | ⏸️ B2.6 ile birlikte arayüz reposunda, ayrı onayla; yerine aynı sözleşme Python testleriyle kilitli |

## Neyi neden böyle yaptım

1. **Görüşme kuralı (senin kararın).** 10 sn ortancası eşiğin üstünde kesintisiz 1 dakika kalınca "birlikte". Bekleme
   dakikası görüşmeye sayılır: 3 dakika konuşan çift 3 dakika görünür. Tek oynak ölçüm sayacı sıfırlamasın diye ortanca
   kullanılıyor; Kurulum'da görünen değer, kararda kullanılan değerin kendisi.
2. **Duyulmayan çift eşik altında sayılır.** Bir kart susarsa son ölçümü 10 sn daha pencerede kalır, sonra çift
   "duyulmuyor" olur ve 15 sn sonra görüşme biter (toplam ~25 sn).
3. **Alıcı 12 sn'den uzun susarsa her şey donar** (brief §2: "12 sn hiç paket gelmezse bağlantı kopmuş sayılır"). Görüşme
   sayaçları ve süreler ilerlemez; saat, "en son duyulma" ve alıcı yaşı ilerler. Daha kısa boşluklarda (gerçek alıcıda bir
   tik boş geçebilir) sayaçlar normal işler. Bir kartın "duyulmuyor" süresi yalnız alıcı canlıyken sayılır.
4. **Kimseye verilmemiş kart, ilk görüşmesinden sonra panoya çıkar** (PLAN R7 / Soru 1 varsayılanı). Masadaki yedekler
   panoda görünmez. Mock Kart 14'ü salona girer girmez gösteriyordu; burada ilk bir dakikalık görüşmesinden sonra çıkıyor.
5. **Aynı iki kişi için anlaşma bildirimi bir kez.** Tekrar bir araya gelirlerse "Yeniden bir arada" düşer.
6. **Etkinlik saati kaynak saatinden.** Benzetimde mock gibi benzetim saniyesi (`--hizlandir` ile görüşme süreleri ve
   kenar dakikaları aynı saatle sayılır). Sunucu yeniden başlarsa saatin sürmesi B6'da (kalıcılık).
7. **Sıfırla:** süreler, görüşmeler, bildirimler, anlaşmalar ve sayaçlar silinir; kişiler, eşik ve sinyal ölçümleri
   kalır (Kurulum grafiği kesilmez). Mock sıfırlamada sahte salonu da baştan başlatıyordu; burada salon sürer.
8. **Hiç duyulmamış kartın "en son duyulma" süresi boş, durumu "görünmüyor".** Arayüz bunu "hiç duyulmadı" diye gösteriyor.
9. **Eşik ve sıfırlama `/state`'te hemen görünür;** canlı akışa sıradaki tikte (en geç yarım saniye) gider.
10. **Ctrl+C'de açık canlı akışlar en çok 1 sn beklenir,** sonra kesilir; sunucu takılmadan kapanır.
11. **Kaynak ayarı sunucu açılmadan denetlenir:** örneğin `--kaynak kayit` verilip `--iz` verilmezse "ayar hatası" ile durur.
12. **Yeni bayrak `--anlasma-sn`:** anlaşma bildirimini kısa sürede düşürmek için (deneme; mock'taki `--anlasmaSn`).
13. **"Yalnız kaldı" uyarısı bekleme dakikasında ertelenir.** Yatırımcı biriyle eşik üstünde bekliyorsa uyarı düşmez; görüşme
    başlarsa o dakika görüşmeye sayılır ve uyarı hiç düşmez, başlamazsa bekleme bitince düşer.
14. **`config.toml`'daki eşik de −100 ile −20 arasında olmalı** (Kurulum ve `/control` ile aynı aralık, tek yerde tanımlı).

## Yük ölçümü

97 kişi, duyulan çift sayısına göre bütün tik (alan + durum + JSON). İki ölçüm: benim (bildirimsiz) ve incelemecinin
(gerçek benzetim koşusu; ~300 bildirim her mesajda gidiyor):

| Duyulan çift | Benzetimde ne zaman | Tik süresi | `/state` boyutu |
|---|---|---|---|
| ~170–180 | ~30. dakika | 9,6–10,5 ms | 127–145 KB |
| ~320 | ~1. saat | 17,7–18,3 ms | 215–244 KB |
| ~850 | ~3. saat | 49,5–54,3 ms (en kötü %5: 62 ms) | 528–614 KB |

Bütçe tik başına 50 ms: **üç saatlik bir etkinliğin sonunda aşılıyor.** Süre ve boyut, duyulan çift sayısıyla doğru orantılı büyüyor; zamanın ve verinin çoğu Kurulum'daki
90 saniyelik grafik serisi. Benzetimde ayrılan çiftler birbirini zayıf da olsa duymaya devam ettiği için çift sayısı
etkinlik boyunca artıyor. Üç saatlik bir etkinliğin sonunda her ekrana saniyede iki kez yarım megabayt gidiyor; masadaki
tablet Wi-Fi'da zorlanabilir. Çözüm için öneri: grafik verisini yalnız Kurulum ekranı açıkken göndermek (PLAN Bölüm 10, b
seçeneği). Bu arayüzde de küçük bir değişiklik ister; ayrı karar.

## Bağımsız inceleme

Dalın tamamı ayrı bir incelemeciye verildi (Opus). Kritik bulgu yok; beş önemli bulgu bu dalda, önce bulguyu yakalayan test
yazılarak düzeltildi:

1. **Motorun hata dayanıklılığı.** Durum üretilirken tek bir hata, motorun kaynağı bırakmasına yol açıyordu: panoda kalıcı
   "ALICI BAĞLI DEĞİL". İkinci hata yayını tamamen durduruyordu. Artık hata loglanıyor, son geçerli durum gönderilmeye devam
   ediyor, kaynak bırakılmıyor.
2. **Sahte "Kart sinyali kesildi" yağmuru.** Alıcı 1 dakikadan uzun kopup yeniden takılınca, ilk tikte paketi henüz gelmemiş
   her kart "kayıp" bildiriliyordu (gerçek donanımda yüzlerce ciddi bildirim). Artık duyulmama yalnız alıcı canlıyken sayılıyor.
3. **Seyrek paketlerde süre kaybı.** Paketsiz her tik sayaçları donduruyordu; gerçek alıcıda boş geçen tiklerin süresi
   görüşmelerden düşülürdü. Artık plan ve brief'teki kural: alıcı ancak 12 sn susunca kopuk sayılıyor.
4. **Bekleme dakikasında yanlış "yalnız" uyarısı.** 1 dakikalık kuralla, sonradan görüşmeye sayılan dakikada "6 dk'dır
   kimseyle görüşmüyor" uyarısı düşebiliyordu. Artık bekleme sırasında uyarı erteleniyor (madde 13).
5. **Kırmızıya dönebilen testi olmayan davranışlar.** İlk canlı akış mesajının tik beklemeden gelmesi, kopmadan dönünce
   kopuk sürenin görüşmeye eklenmemesi, aynı çifte ikinci anlaşma bildirimi düşmemesi ve birden çok görüşmedeki kişi
   sayıları (yalnız karşı rol, en uzun görüşme) artık testli. Her biri kodu bilerek bozarak sınandı.

Ayrıca `config.toml`'daki eşik aralığı (B0'da bu faza bırakılmıştı) eklendi ve plandaki eski "5 sn" ifadeleri düzeltildi.

### Ertelenen küçük bulgular

- Her tikte sinyal penceresi iki kez hesaplanıyor; canlı akış çerçevesi her izleyici için ayrı kopyalanıyor (plan "aynı
  tampon" diyor). Küçük hız kazancı; yük kararıyla birlikte.
- Benzetim tik kadansı: kaynak 0,5 sn uyuyup sonra çalışıyor; yükte gerçek kadans ~0,55 sn (B1'den açık).
- Çok uzun tik aralığı (bilgisayar uykusu) görüşmeye tam sayılıyor; gerçek zamanlı kaynakta üst sınır düşünülmeli (B8).
- Canlı akış kopma testi ~8 sn sürüyor; toparlanma görülünce erken bitebilir.

## Mock'tan bilinen farklar

- Görüşme panoda yaklaşık 1 dakika geç başlar (kararın; mock 5 sn).
- Alıcı kopmasının ilk 12 sn'si görüşme süresine sayılır (mock kopmayı hemen donduruyordu).
- Kart 14 panoya salona girer girmez değil, ilk görüşmesinden sonra çıkar.
- Sıfırlama sahte salonu baştan başlatmaz (Kart 14, kayıp kart, alıcı kopması senaryoları tekrar oynamaz).
- `receiverAge` ve `seenAgo` gerçek değer; mock bunları 0–2 sn arası rastgele veriyordu.

## Arayüz reposunda yapılması gerekenler (ayrı onay)

1. "5 sn" yazan iki metin 1 dakikaya: Rapor sayfasının dipnotu (`RaporEkrani.jsx`) ve Kurulum'daki çift tablosunun
   açıklaması (`CiftTablosu.jsx`, `api/sinyal.js` yorumu).
2. Mock'un giriş gecikmesi (`GIRIS_SN = 5`) 60 sn'ye; mock geliştirmede gerçek sunucuyla aynı davransın.
3. B2.6: mock testlerinin gerçek sunucuya karşı koşabilmesi (PLAN 16.3 madde 2–4: yalnız mock'a ait uçları kullanan testler,
   test başına ayrı bayraklar, katı alan listeleri yeniden düşünülmeli).

## B5 için not

Görüşme kaydı (`/api/sessions`) eşiğin aşıldığı andan açılmalı (`başlangıç = t − ustunde_sn`), yoksa "kayıt süreleri
toplamı ≈ kenar dakikası" kuralı (PLAN 5.2 madde 4) bir dakika şaşar. Gereken bilgi alanda duruyor.

## Sıradaki

- B3: karşılama masası — kişi ekleme / düzenleme / CSV, kart verme / iade / değiştirme (`/api/people`, `/api/assign`,
  `/api/unassign`). Benzetimde masa kart verip iade ettikçe sahte kartlar salona girip çıkacak (16.3 madde 6 kararı).
