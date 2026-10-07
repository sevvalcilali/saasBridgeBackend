# Faz 1 — Organizatör Canlı Panosu · Teslim Notu

Tarih: 29.09.2026 · Dal: `faz-0-altyapi` · Test: **79/79 birim testi yeşil**, 16 adımın her biri tarayıcıda (Playwright) doğrulandı · Build: `dist/` 242 kB JS (gzip 76 kB).

## Ekran görüntüleri

| Dosya | Ne gösteriyor |
|---|---|
| `masaustu_25kisi.png` | 1280 px, 25 kişi: üst şerit, liste, ağ, bildirimler |
| `masaustu_50kisi.png` | 1280 px, 50 kişi (kalabalık senaryo) |
| `tablet_900.png` | 900 px: bildirimler üstte, liste, ağ altta |
| `telefon_600_kisiler.png` · `telefon_600_bildirimler.png` | 600 px: sekmeli düzen |

## Neyi neden böyle yaptım

**Açık, sıcak tema (krem zemin).** Brief koyu tema istiyordu. Proje kararıyla açık temaya geçildi. Tüm renkler `tokens.css`'te. Kontrastlar birim testiyle kilitlendi (WCAG AA). Koyu tema, yeni bir değer setiyle sonradan eklenebilir.

**Yeşil yalnız "şu an birlikte".** Kişi paletinden `#199e70` çıkarıldı. Sunucu bu rengi gönderirse petrol tonuna çevriliyor. Alıcı rozeti, anlaşma bildirimi ve seçim vurgusu bilerek yeşil değil: nötr, altın ve kırmızı kullanıldı.

**Kimlik ve durum asla yalnız renkle verilmiyor.** Kişi: renk + rol şekli (○ yatırımcı, □ girişimci, ◇ misafir) + ad. Durum: renk + ikon (●○◌⚠) + yazı. Renk körü bir organizatör de her şeyi okuyabiliyor.

**Sakin hareket.**
- Liste süreye göre değil, durum önceliğine göre sıralanıyor (birlikte → boşta → görünmüyor). Aynı durumdakiler sunucu sırasını koruyor. Böylece saniyede 2 güncelleme gelse de liste zıplamıyor; yalnız biri durum değiştirince yer değişiyor. Bu değişim FLIP animasyonuyla kayarak oluyor.
- Test: 8 kişi durum değiştirirken durumu değişmeyen 18 kişinin sırası hiç bozulmadı.
- Ağdaki düğümler deterministik yerleşimde, yerinden oynamıyor.
- Tüm animasyonlar "hareketi azalt" tercihine uyuyor.

**Ağ fiziksel konum değil.** Yatırımcılar solda, girişimciler sağda, misafirler altta. Altta "konum fiziksel değildir" ibaresi var. Kalabalıkta (50 kişi) okunur kalması için ağın yüksekliği en kalabalık sütuna göre büyüyor. Misafir etiketleri dönüşümlü üstte/altta yazılıyor.

**Veri silinmez, sadece solar.** Bağlantı koparsa kırmızı bant çıkıyor ve içerik soluyor, ama son veri ekranda kalıyor. Doğrulama sırasında bir hata bulundu ve düzeltildi: sessizce ölen bağlantılar (soket açık kalıyor ama veri gelmiyor) hiç fark edilmiyordu. İstemciye bir "sessizlik gözcüsü" eklendi: 6 sn boyunca mesaj gelmezse bağlantı kopmuş sayılıyor ve yeniden bağlanılıyor.

**Temiz mimari.**
- Sunucuyla konuşan tek dosya `api/client.js`. Gerçek sunucuya geçerken değişecek tek şey adres.
- Tüm hesap ve metin kurgusu (durum cümlesi, filtre, sıralama, özet, ağ geometrisi) `api/` altında saf fonksiyonlarda ve birim testli. JSX içinde hesap yok.

**Performans.** Satır bileşeni alan alan karşılaştıran `memo` ile sarıldı ve callback'ler kararlı hale getirildi. 25 ve 50 kişide 6 sn canlı akış boyunca **sıfır uzun görev** ölçüldü (50 ms üstü ana iş parçacığı bloğu yok).

## Brief kural kontrolü (§7, §10)

- [x] Üst şerit: etkinlik, saat, ALICI BAĞLI/DEĞİL, eşik, onaylı Sıfırla
- [x] Kişi listesi: rol grupları, renk+şekil+ad, girişimcide kurum önde, yıldız, durum cümlesi, toplam süre, birlikte olanlar yeşil
- [x] Arama + filtre (rol, durum, hiç görüşmemiş); seçilen filtre ve sekme `localStorage`'da
- [x] Ağ: rol şekilli düğümler, çizgi kalınlığı toplam süreyle artıyor, şu an birlikte olanlar yeşil ve akıyor, "konum değildir" ibaresi var
- [x] Bildirimler: en yeni üstte, türe göre ikon, önemine göre renk; tıklayınca ilgili kişiler hem listede hem ağda vurgulanıyor
- [x] Alt şerit: özet sayılar + ilerleme çubuğu
- [x] Kişi detay paneli: kiminle ne kadar, kart bilgisi
- [x] Metre/cm yok · konum/ısı haritası yok · "konuşma" değil "birlikte" · tamamen çevrimdışı (CDN yok, ikonlar gömülü, sistem fontu)
- [x] Tarih `28.09.2026`, saat `14:05`, süre `3 dk 20 sn`
- [x] 100 ve üstü numaralı kartlar kişi listesinde yok; atanmamış kartta "Kişi ata" düğmesi (Faz 2'ye köprü)
- [x] Tablet ve telefon düzeni

## Yol boyunca verdiğim kararlar

1. **Detay paneli arka planı karartmıyor (modal değil).** Panel açıkken başka bir kişiye tıklayınca panel ona geçiyor. Bunun için liste tıklanabilir kalmalıydı. Kapatma X düğmesiyle.
2. **Sunucu verisi EventSource yerine fetch akışıyla okunuyor.** Yeniden bağlanma ve hata durumu bizim kontrolümüzde kalıyor. Aynı kod testlerde de ek paket olmadan çalışıyor.
3. **Ağ yüksekliği kişi sayısına göre değişiyor.** Kişi eklenince düğümler bir kez yeniden diziliyor; normal güncellemelerde yerinden oynamıyor.

## Açık sorular / bilinen konular

1. **Kritik bildirimler gözden kaçabilir.** Çok sayıda "anlaşma" bildirimi gelirse, erken düşen bir "kart kayboldu" bildirimi görünen son 20'nin dışına itiliyor. Öneri: çözülmemiş ciddi bildirimleri en üste sabitlemek. Karar sizin.
2. **Erişilebilirlik:** Atanmamış kart satırında, tıklanabilir satırın içinde bir düğme daha var ("Kişi ata"). Faz kapanışındaki erişilebilirlik denetiminde düzeltilecek.
3. **Mock'un kısıtları (arayüz sorunu değil):**
   - 50 kişide şirket adları tekrar ediyor (listede 15 ad var).
   - Mock çok hızlı çalıştırıldığında (120x ve üstü) alıcı kopması, kart kaybı senaryosunu örtebiliyor.
