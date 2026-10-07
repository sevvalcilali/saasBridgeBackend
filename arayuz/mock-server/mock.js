// Yakınlık Takip Sistemi — mock SSE sunucusu (pano.py ikizi)
// Brief §5 sözleşmesinin birebir aynısını üretir: GET /state, GET /events
// (2 Hz tam durum), POST /control {reset|threshold}. Bağımlılık yok.
//
//   node mock-server/mock.js [--port=8002] [--kisi=25] [--tohum=42]
//                            [--hizlandir=1] [--kopma=1] [--anlasmaSn=0]
//
// --hizlandir: benzetim zamanı çarpanı (testte 60–120 ile dakikalar saniyeye iner)
// --kopma:     alıcı kopması senaryosu (120. sn'de 20 sn, sonra her 6 dk'da)
// --anlasmaSn: rules.dealAfterS — masa testi için anlaşma süresini zorlar

import http from 'node:http'

// ---------- ayarlar ----------
const arg = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v === undefined ? true : Number(v)]
}))
const PORT = arg.port ?? 8002
const KISI_SAYISI = arg.kisi ?? 25
const TOHUM = arg.tohum ?? 42
const HIZ = arg.hizlandir ?? 1
const KOPMA = (arg.kopma ?? 1) !== 0
const ANLASMA_SN = arg.anlasmaSn || null

const TIK_MS = 500                 // gerçek zaman; yayın da bu kadans (2 Hz)
const DT = (TIK_MS / 1000) * HIZ   // benzetim saniyesi / tik
const GIRIS_SN = 60                // giriş: eşik üstünde kesintisiz 1 dk (karar 05.10.2026; gerçek sunucuyla aynı)
const CIKIS_SN = 15                // brief §2: çıkış gecikmesi
const GRAFIK_SN = 90
const ETKINLIK_DK = 180            // event.progress için varsayılan süre

// Brief §10 KOYU paleti — mock, gerçek sunucu gibi BU paletten atar;
// açık tema uyarlaması arayüz tarafındadır (src/api/renkler.js).
const PALET = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767']

// ---------- tohumlu rastgelelik ----------
let rndDurum = TOHUM >>> 0
function rnd() { // mulberry32
  rndDurum = (rndDurum + 0x6d2b79f5) >>> 0
  let t = rndDurum
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const rndAralik = (a, b) => a + rnd() * (b - a)
const rndNormal = (orta, sapma) =>
  orta + sapma * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())

// ---------- kişiler ----------
const ADLAR = ['Ayşe', 'Mehmet', 'Zeynep', 'Emre', 'Elif', 'Burak', 'Selin', 'Kaan', 'Merve', 'Deniz', 'Cem', 'İrem', 'Onur', 'Gizem', 'Barış', 'Ece', 'Tolga', 'Naz', 'Serkan', 'Pelin', 'Uğur', 'Aslı', 'Kerem', 'Duygu', 'Volkan', 'Buse', 'Halil', 'Melis', 'Ozan', 'Ceren']
const SOYADLAR = ['Demir', 'Kaya', 'Şahin', 'Yılmaz', 'Çelik', 'Arslan', 'Doğan', 'Kılıç', 'Aydın', 'Öztürk', 'Erdem', 'Polat', 'Koç', 'Güneş', 'Tekin', 'Aksoy', 'Bulut', 'Korkmaz', 'Yavuz', 'Özkan']
const FONLAR = ['Atlas Ventures', 'Boğaz Capital', 'Anadolu Fonu', 'Ege Girişim', 'Meridyen VC', 'Kule Yatırım', 'Fener Partners', 'Doruk Capital', 'Liman Ventures', 'Kuzey Fonu', 'Safir Yatırım', 'Çınar Capital']
const SIRKETLER = ['Nova Robotik', 'Peak Enerji', 'Bitki Teknoloji', 'Akıllı Tarım', 'Veri Köprüsü', 'Sağlık Cebi', 'Hızlı Kargo', 'Temiz Deniz', 'Oyun Evreni', 'Fin Radar', 'Eğitim Yıldızı', 'Şehir Sensör', 'Mutfak Robotu', 'Gök Harita', 'Ses Analiz']

function kisileriUret(istenen) {
  // Kart no 1–99 (brief §3); 1 sistemde, 14 atanmamış senaryosuna ayrılı → en çok 97 kartlı kişi.
  const adet = Math.min(istenen, 97)
  if (adet < istenen) console.warn(`uyarı: --kisi=${istenen} kart havuzunu aşıyor (kart no 2–99); ${adet} kişiyle başlıyor`)
  const yatirimciAdet = Math.max(2, Math.round(adet * 0.4))
  const misafirAdet = Math.max(1, Math.round(adet * 0.12))
  const girisimciAdet = adet - yatirimciAdet - misafirAdet

  // kart no havuzu 2..99 karışık; 14 atanmamış-kart senaryosuna ayrılır
  const kartlar = []
  for (let n = 2; n < 100; n++) if (n !== 14) kartlar.push(String(n))
  for (let i = kartlar.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)); [kartlar[i], kartlar[j]] = [kartlar[j], kartlar[i]]
  }

  const liste = []
  let adNo = 0
  const yeniAd = () => `${ADLAR[adNo % ADLAR.length]} ${SOYADLAR[(adNo++ * 7) % SOYADLAR.length]}`
  for (let i = 0; i < yatirimciAdet; i++) {
    const tier = [2, 3, 3, 3, 4, 4, 5][Math.floor(rnd() * 7)]
    liste.push({ id: kartlar.pop(), role: 'investor', name: yeniAd(), org: FONLAR[i % FONLAR.length], tier })
  }
  for (let i = 0; i < girisimciAdet; i++) {
    liste.push({ id: kartlar.pop(), role: 'founder', name: yeniAd(), org: SIRKETLER[i % SIRKETLER.length], tier: 0 })
  }
  for (let i = 0; i < misafirAdet; i++) {
    liste.push({ id: kartlar.pop(), role: 'guest', name: yeniAd(), org: '', tier: 0 })
  }
  liste.forEach((k, i) => {
    k.color = PALET[i % PALET.length]
    k.seenAgo = rndAralik(0, 2)
    k.min = 0; k.invMin = 0
    k.esler = new Set()          // şu an fiziksel olarak yanında olduğu kartlar
  })
  return liste
}

// ---------- benzetim durumu ----------
// kisiler = simülasyondaki FİZİKSEL KARTLAR (her biri o an atanmış kişinin
// kimliğini taşır). Kimlik/atama katmanı katilimcilar + atama uçlarındadır.
let kisiler = kisileriUret(KISI_SAYISI)
let katilimcilar = []               // kayıtlı kişiler (kartsız olabilir)
let kisiIdSayaci = 0
let renkSayaci = kisiler.length
// Başlangıç kadrosu: her kart = bir kayıtlı kişi, o karta atanmış.
kisiler.forEach((k) => {
  const kat = {
    kisiId: 'k' + (++kisiIdSayaci),
    ad: k.name, rol: k.role, kurum: k.org, yildiz: k.tier,
    not: '', renk: k.color, atananKart: k.id, ayrildi: false, min: 0, invMin: 0,
    sektor: '', asama: '', tanitim: '', web: '', eposta: '', paylasim: false,
  }
  k.kisiId = kat.kisiId
  katilimcilar.push(kat)
})

// Masadaki yedek kartlar (brief §6.4 "boştaki kartlar"): açık, alıcı duyar,
// kimseye atanmamış; panoda kişi olarak görünmez. İade edilen kart da buraya döner.
const YEDEK_ADET = 6
const masadakiKartlar = new Set()
for (let n = 2; n < 100 && masadakiKartlar.size < YEDEK_ADET; n++) {
  const kart = String(n)
  if (kart !== '14' && !kisiler.some((k) => k.id === kart)) masadakiKartlar.add(kart)
}

let simSn = 0                       // benzetim saniyesi (elapsed)
let ciftler = new Map()             // "a-b" → çift kaydı
let kenarlar = new Map()            // "a-b" → toplam dakika
let bildirimler = []
let oturumlar = []                  // görüşme kayıtları (§9-6): { a, b, start, end } kişi kimliğiyle
let anlasmalar = new Set()          // anlaşma çıkmış çiftler — KİŞİ kimliğiyle (kenarAnahtari), karta değil
let bitenGorusme = 0
let esik = -72
let yalnizSn = new Map()            // kişi KİMLİĞİ → kesintisiz boşta sn (kart başkasına geçince devredilmez)
let atanmamisGeldi = false
let aliciKopuk = false              // alıcı şu an kopuk mu (tik kararı; durum bunu okur)
let sonAliciSn = 0                  // alıcıdan son satırın geldiği benzetim saniyesi

// senaryo zamanları (benzetim sn)
const ATANMAMIS_SN = 45
const KAYIP_ARALIK = [180, 300]     // bu aralıkta bir kart susar
let kayipKisi = null
// Kopma 20 benzetim sn sürer; hızlandırılmış zamanda bir tik 20 sn'den uzun
// olabileceği için pencere en az 4 tik olacak şekilde ölçeklenir (yoksa
// pencere tek tikte atlanır ve hiç gözlenemez).
const KOPMA_SURESI = Math.max(20, DT * 4)
const kopmaPenceresi = (t) => KOPMA &&
  ((t >= 120 && t < 120 + KOPMA_SURESI) || (t >= 480 && (t - 480) % 360 < KOPMA_SURESI))

const anahtar = (a, b) => (Number(a) < Number(b) ? `${a}-${b}` : `${b}-${a}`)
// Kenarlar (kim kimle ne kadar) KİŞİYE bağlıdır, karta değil: kart değişse de
// süreler kişide birleşir, iade edilen kart başkasına verilince devredilmez
// (brief §6). Kişisi olmayan (atanmamış) kart kendi adıyla tutulur.
const kimlik = (e) => e.kisiId ?? `kart:${e.id}`
const kenarAnahtari = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`)

// Görüşme kaydı (§9-6): birlikte başlayınca açılır, bitince kapanır. start/end etkinlik
// saniyesi. Kayıt eşiğin aşıldığı ana geri tarihlidir (start = simSn - bekleme): bekleme dakikası kenar
// süresine de eklendiği için kayıtlar toplamı edges[].min ile tutarlı kalır.
function oturumAc(c, beklemeSn) {
  c.oturum = { a: kimlik(kisiBul(c.a)), b: kimlik(kisiBul(c.b)), start: simSn - beklemeSn, end: null }
  oturumlar.push(c.oturum)
}
function oturumKapat(c) {
  if (c.oturum && c.oturum.end === null) c.oturum.end = simSn
  c.oturum = null
}
const kisiBul = (id) => kisiler.find((k) => k.id === id)
const gorunenAd = (k) => (k.role === 'founder' && k.org ? k.org : k.name)

// ---------- kayıt defteri + atama (§9) ----------
const katBul = (id) => katilimcilar.find((k) => k.kisiId === id)
const kartKat = (kart) => katilimcilar.find((k) => k.atananKart === kart)
const yeniRenk = () => PALET[(renkSayaci++) % PALET.length]
const katDto = (k) => ({
  kisiId: k.kisiId, ad: k.ad, rol: k.rol, kurum: k.kurum,
  yildiz: k.yildiz, not: k.not, renk: k.renk, atananKart: k.atananKart, ayrildi: k.ayrildi,
  sektor: k.sektor, asama: k.asama, tanitim: k.tanitim, web: k.web, eposta: k.eposta, paylasim: k.paylasim,
})

// Profil (kişiye özel rapor 2. adım; gerçek sunucuyla aynı): metinler 200 karakter, aşama yalnız girişimcide,
// paylaşım izni yalnız açıkça "evet" (true / 1) denirse.
const ASAMALAR = ['fikir', 'mvp', 'gelir', 'buyume']
const PROFIL_METINLERI = ['sektor', 'tanitim', 'web', 'eposta']
const EVET = new Set(['evet', 'e', 'yes', 'y', 'true', '1', 'var', 'izinli', 'x'])
const profilMetni = (v) => metinAlan(v).trim().slice(0, 200)
const asamaAl = (rol, v) => (rol === 'founder' && ASAMALAR.includes(v) ? v : '')
const evetMi = (v) => (typeof v === 'boolean' ? v : typeof v === 'number' ? v === 1
  : typeof v === 'string' && EVET.has(v.trim().toLocaleLowerCase('tr')))

// Gövdeden gelen metin alanı: dize değilse (sayı, nesne…) yok sayılır — tip hatası sunucuyu düşürmesin.
const metinAlan = (v) => (typeof v === 'string' ? v : '')
// Kart no 1–99 (brief §3; 100+ dinleyici cihaz). "007" → "7". Geçersizse null.
function kartNo(v) {
  const m = String(v ?? '').trim()
  if (!/^\d{1,3}$/.test(m)) return null
  const n = Number(m)
  return n >= 1 && n <= 99 ? String(n) : null
}

function kisiEkle({ ad, rol, kurum, yildiz, not, asama, paylasim, ...profil }) {
  rol = ['investor', 'founder', 'guest'].includes(rol) ? rol : 'guest'
  const kat = {
    kisiId: 'k' + (++kisiIdSayaci),
    ad: metinAlan(ad).trim() || 'İsimsiz',
    rol: ['investor', 'founder', 'guest'].includes(rol) ? rol : 'guest',
    kurum: metinAlan(kurum),
    yildiz: rol === 'investor' ? Math.max(0, Math.min(5, yildiz | 0)) : 0,
    not: metinAlan(not), renk: yeniRenk(), atananKart: null, ayrildi: false, min: 0, invMin: 0,
    asama: asamaAl(rol, asama), paylasim: evetMi(paylasim),
    ...Object.fromEntries(PROFIL_METINLERI.map((alan) => [alan, profilMetni(profil[alan])])),
  }
  katilimcilar.push(kat)
  return kat
}

// Kartı sahneden çıkar. Çiftleri kapatılır (eşler serbest kalır, açık görüşme
// biter) ki benzetim artık olmayan karta dokunmasın; kenarlar (kim kimle ne
// kadar) rapor için silinmez.
function kartiCikar(kart) {
  for (const [key, c] of ciftler) {
    if (c.a !== kart && c.b !== kart) continue
    fizikselAyril(c.a, c.b)
    if (c.together) { bitenGorusme++; oturumKapat(c) }
    ciftler.delete(key)
  }
  kisiler = kisiler.filter((k) => k.id !== kart)
}

// Kartı simülasyondan çıkar, biriktirdiği süreyi kişiye taşı (rapor için silinmez).
function iadeKat(kat, kart) {
  const e = kisiBul(kart)
  if (e) { kat.min += e.min || 0; kat.invMin += e.invMin || 0 }
  kat.atananKart = null
  kartiCikar(kart)
}

// Kart entry'nin kimlik alanlarını atanan kişiden doldur (/state bunu okur).
function kimlikYaz(e, kat) {
  e.kisiId = kat.kisiId
  e.name = kat.ad; e.role = kat.rol; e.org = kat.kurum
  e.tier = kat.yildiz; e.color = kat.renk
}

function ata(kisiId, kart) {
  const kat = katBul(kisiId)
  if (!kat) return false
  kart = String(kart)
  const eski = kartKat(kart)
  if (eski && eski !== kat) iadeKat(eski, kart)      // kart başkasındaysa geri al
  if (kat.atananKart && kat.atananKart !== kart) iadeKat(kat, kat.atananKart) // kişinin eski kartını bırak
  kat.atananKart = kart
  kat.ayrildi = false
  masadakiKartlar.delete(kart)
  let e = kisiBul(kart)
  if (!e) {
    e = { id: kart, esler: new Set(), seenAgo: 0, min: 0, invMin: 0, bias: rndAralik(-3, 3) }
    kisiler.push(e)
  } else if (!e.kisiId) {
    kenarlariTasi(kimlik(e), kat.kisiId) // atanmamış kartla geçen süre artık bu kişinin
  }
  // Kart değişimi / yeniden kart: önceki kartlardan biriken süre yeni kartta birleşir.
  e.min += kat.min; e.invMin += kat.invMin
  kat.min = 0; kat.invMin = 0
  kimlikYaz(e, kat)
  e.seenAgo = Math.min(e.seenAgo, 1)
  return true
}

// Bir kimliğin kenarlarını başka kimliğe aktar (aynı çift varsa süreler toplanır).
function kenarlariTasi(eski, yeni) {
  for (const [key, dk] of [...kenarlar]) {
    const [x, y] = key.split('|')
    if (x !== eski && y !== eski) continue
    kenarlar.delete(key)
    const kk = kenarAnahtari(x === eski ? yeni : x, y === eski ? yeni : y)
    kenarlar.set(kk, (kenarlar.get(kk) ?? 0) + dk)
  }
  for (const o of oturumlar) { if (o.a === eski) o.a = yeni; if (o.b === eski) o.b = yeni }
  // Kayıtsız kartla çıkan anlaşma da karta kişi atanınca o kişiye geçer.
  for (const key of [...anlasmalar]) {
    const [x, y] = key.split('|')
    if (x !== eski && y !== eski) continue
    anlasmalar.delete(key)
    anlasmalar.add(kenarAnahtari(x === eski ? yeni : x, y === eski ? yeni : y))
  }
}

// Kart iadesi (brief §6): kişi "ayrıldı" olur. "Geri al" (yanlış atama) ayrildi=false
// gönderir: kişi ayrılmadı, hâlâ kart bekliyor.
function iade(kart, ayrildi = true) {
  kart = String(kart)
  const kat = kartKat(kart)
  if (kat) { iadeKat(kat, kart); kat.ayrildi = ayrildi }
  else kartiCikar(kart)
  masadakiKartlar.add(kart) // kart masaya (stoğa) döner
  return true
}

// ---------- toplu ön yükleme (§9-5: POST /api/people/import, CSV) ----------
// Sütunlar: ad, soyad, rol, kurum, yıldız (brief §6.2). Başlık satırı varsa
// sütunlar ada göre eşlenir, yoksa bu sırayla okunur. Ayraç ; , veya sekme
// (Türkçe Excel ; kullanır). Rol Türkçe ya da İngilizce yazılabilir.
const trKucuk = (s) => (s ?? '').trim().toLocaleLowerCase('tr')
const ROL_ADLARI = {
  yatırımcı: 'investor', yatirimci: 'investor', investor: 'investor',
  girişimci: 'founder', girisimci: 'founder', founder: 'founder',
  misafir: 'guest', guest: 'guest',
}
const SUTUN_ADLARI = {
  ad: 'ad', isim: 'ad', soyad: 'soyad', soyadı: 'soyad', rol: 'rol', kurum: 'kurum', şirket: 'kurum', yıldız: 'yildiz', yildiz: 'yildiz',
  sektör: 'sektor', sektor: 'sektor', sektörler: 'sektor', 'ilgi alanı': 'sektor', 'ilgi alanları': 'sektor',
  aşama: 'asama', asama: 'asama', tanıtım: 'tanitim', tanitim: 'tanitim', açıklama: 'tanitim',
  web: 'web', 'web sitesi': 'web', website: 'web', site: 'web',
  'e-posta': 'eposta', eposta: 'eposta', email: 'eposta', 'e-mail': 'eposta', mail: 'eposta',
  izin: 'paylasim', paylaşım: 'paylasim', 'paylaşım izni': 'paylasim', 'iletişim izni': 'paylasim',
}
const ASAMA_ADLARI = { fikir: 'fikir', idea: 'fikir', mvp: 'mvp', gelir: 'gelir', revenue: 'gelir', büyüme: 'buyume', buyume: 'buyume', growth: 'buyume' }

function csvSatirlari(metin) {
  metin = metin.replace(/^\uFEFF/, '')
  const ilk = metin.split(/\r?\n/, 1)[0]
  const ayrac = [';', '\t', ','].reduce((en, a) => (ilk.split(a).length > ilk.split(en).length ? a : en), ',')
  const satirlar = []
  let satir = [], alan = '', tirnak = false
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i]
    if (tirnak) {
      if (c === '"' && metin[i + 1] === '"') { alan += '"'; i++ }
      else if (c === '"') tirnak = false
      else alan += c
    } else if (c === '"') tirnak = true
    else if (c === ayrac) { satir.push(alan); alan = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && metin[i + 1] === '\n') i++
      satir.push(alan); satirlar.push(satir); satir = []; alan = ''
    } else alan += c
  }
  if (alan || satir.length) { satir.push(alan); satirlar.push(satir) }
  return satirlar
}

function csvIceAktar(metin) {
  const satirlar = csvSatirlari(metin)
  let sutunlar = ['ad', 'soyad', 'rol', 'kurum', 'yildiz', 'sektor', 'asama', 'tanitim', 'web', 'eposta', 'paylasim']
  let bas = 0
  if (satirlar.length && SUTUN_ADLARI[trKucuk(satirlar[0][0])]) {
    sutunlar = satirlar[0].map((b) => SUTUN_ADLARI[trKucuk(b)] ?? null)
    bas = 1
  }
  const mevcut = new Set(katilimcilar.map((k) => `${trKucuk(k.ad)}|${trKucuk(k.kurum)}`))
  let eklenen = 0
  const atlanan = []
  for (let i = bas; i < satirlar.length; i++) {
    const hucre = satirlar[i]
    if (hucre.every((h) => !h.trim())) continue // boş satır
    const v = {}
    sutunlar.forEach((s, j) => { if (s) v[s] = (hucre[j] ?? '').trim() })
    const satir = i + 1 // kullanıcıya dosyadaki satır no
    const ad = [v.ad, v.soyad].filter(Boolean).join(' ')
    const rol = ROL_ADLARI[trKucuk(v.rol)]
    if (!v.ad) { atlanan.push({ satir, sebep: 'ad boş' }); continue }
    if (!rol) { atlanan.push({ satir, sebep: `rol anlaşılamadı: "${v.rol ?? ''}"` }); continue }
    const kurum = v.kurum ?? ''
    const anahtarK = `${trKucuk(ad)}|${trKucuk(kurum)}`
    if (mevcut.has(anahtarK)) { atlanan.push({ satir, sebep: `${ad} zaten kayıtlı` }); continue }
    mevcut.add(anahtarK)
    kisiEkle({ ad, rol, kurum, yildiz: Number(v.yildiz) || 0, sektor: v.sektor, asama: ASAMA_ADLARI[trKucuk(v.asama)],
      tanitim: v.tanitim, web: v.web, eposta: v.eposta, paylasim: v.paylasim ?? '' })
    eklenen++
  }
  return { eklenen, atlanan }
}

// Deterministik jitter (istek işleyicide rnd() kullanmayız; tohum bozulmasın).
const jitter = (kart) => ((Number(kart) * 13 + Math.floor(simSn)) % 7) - 3

// Alıcının bir kartı duyduğu güç (masadan zayıf; arayüz artık kullanmıyor, sözleşmede kalır).
function rssiAlici(kart) {
  return Math.round((-72 - (Number(kart) % 15) + jitter(kart)) * 10) / 10
}
const kartDto = (kart, e) => ({
  kart,
  rssiAlici: rssiAlici(kart),
  seenAgo: e ? Math.round(e.seenAgo * 10) / 10 : 0.1,
  atanan: kartKat(kart)?.kisiId ?? null,
})

// Alıcının duyduğu kartlar: aktif simülasyon kartları + masadaki yedek kartlar.
function kartlariListele() {
  const harita = new Map()
  for (const k of kisiler) harita.set(k.id, kartDto(k.id, k))
  for (const kart of masadakiKartlar) if (!harita.has(kart)) harita.set(kart, kartDto(kart, null))
  return [...harita.values()]
}

const karsiRol = (a, b) =>
  (a.role === 'investor' && b.role === 'founder') || (a.role === 'founder' && b.role === 'investor')

function anlasmaSuresiSn(cift) {
  if (ANLASMA_SN) return ANLASMA_SN
  const [a, b] = [kisiBul(cift.a), kisiBul(cift.b)]
  if (!a || !b || !karsiRol(a, b)) return Infinity
  const tier = Math.max(a.tier, b.tier)
  const dk = { 2: 11, 3: 8, 4: 11, 5: 8 }[tier]   // brief §5.2 + §6.1
  return dk ? dk * 60 : Infinity
}

function bildir(kind, severity, title, detail, ids, kural = '') {
  const simdi = new Date()
  bildirimler.push({
    t: simdi.getTime() / 1000,
    clock: `${String(simdi.getHours()).padStart(2, '0')}:${String(simdi.getMinutes()).padStart(2, '0')}`,
    kind, severity, title, detail, people: ids, kural,
  })
}

// ---------- Uyarı kuralları (gerçek sunucu cekirdek/kural.py ile aynı; Şevval isteği 2026-10-06) ----------
// "[kim] ile [kiminle] [yan yana gelince | N dk'dan uzun birlikte]" → bildirim kind/severity "kural" (panoda açılır
// pencere). Kim / kiminle: { kisiler: [kisiId] } ya da { rol, enAzYildiz }. Kişisiz kart hiçbir kurala uymaz; bir çiftin
// bir görüşmesinde bir kez; görüşme bitince unutulur; sıfırlamada kurallar kalır.
let kurallar = []
let kuralSayac = 0
const KURAL_ROLLERI = ['investor', 'founder', 'guest', 'herkes']
const KURAL_GRUP_ADI = { investor: 'yatırımcılar', founder: 'girişimciler', guest: 'misafirler', herkes: 'herkes' }
const katGorunen = (k) => (k.rol === 'founder' && k.kurum ? k.kurum : k.ad)

function secimCoz(d, taraf) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return `${taraf}: kişiler ya da rol seçin`
  if ('kisiler' in d) {
    if (!Array.isArray(d.kisiler) || !d.kisiler.length || !d.kisiler.every((k) => typeof k === 'string')) return `${taraf}: en az bir kişi seçin`
    for (const id of d.kisiler) if (!katBul(id)) return `${taraf}: bilinmeyen kişi ${id}`
    return { kisiler: [...new Set(d.kisiler)] }
  }
  if (!KURAL_ROLLERI.includes(d.rol)) return `${taraf}: rol yatırımcı, girişimci, misafir ya da herkes olmalı`
  const y = d.enAzYildiz ?? 0
  if (!Number.isInteger(y) || y < 0 || y > 5) return `${taraf}: en az yıldız 0–5 olmalı`
  return { rol: d.rol, enAzYildiz: y }
}
const secimAdi = (s) => (s.kisiler
  ? s.kisiler.map((id) => (katBul(id) ? katGorunen(katBul(id)) : id)).join(', ')
  : (s.enAzYildiz && ['investor', 'herkes'].includes(s.rol) ? `★${s.enAzYildiz}+ ` : '') + KURAL_GRUP_ADI[s.rol])

function kuralCoz(g, kuralId) {
  const kim = secimCoz(g.kim, 'kim'); if (typeof kim === 'string') return kim
  const kiminle = secimCoz(g.kiminle, 'kiminle'); if (typeof kiminle === 'string') return kiminle
  const dakika = g.dakika ?? 0
  if (typeof dakika !== 'number' || !Number.isFinite(dakika) || dakika < 0 || dakika > 600) return 'dakika 0–600 olmalı'
  const acik = g.acik ?? true
  if (typeof acik !== 'boolean') return 'acik true / false olmalı'
  let ad = typeof g.ad === 'string' ? g.ad.trim().slice(0, 80) : ''
  if (!ad) ad = `${secimAdi(kim)} ile ${secimAdi(kiminle)}${dakika ? ` · ${dakika} dk` : ' · yan yana'}`.slice(0, 80)
  return { kuralId, ad, kim, kiminle, dakika, acik }
}
const secimeUyar = (s, e) => (s.kisiler ? s.kisiler.includes(e.kisiId)
  : (s.rol === 'herkes' || e.role === s.rol) && (e.tier || 0) >= (s.enAzYildiz || 0))
const kuralaUyar = (r, a, b) => Boolean(a.kisiId && b.kisiId && a.kisiId !== b.kisiId) &&
  ((secimeUyar(r.kim, a) && secimeUyar(r.kiminle, b)) || (secimeUyar(r.kim, b) && secimeUyar(r.kiminle, a)))

// ---------- benzetim adımı ----------
function tik() {
  aliciKopuk = kopmaPenceresi(simSn)
  simSn += DT
  if (!aliciKopuk) sonAliciSn = simSn   // alıcıdan taze satır geldi

  // atanmamış kart sahneye girer (sunucu ikizinin kendiliğinden eklemesi)
  // (Masa kartı 14'ü o zamana kadar birine verdiyse ya da masadaysa ikinci kopya eklenmez.)
  if (!atanmamisGeldi && simSn >= ATANMAMIS_SN) {
    atanmamisGeldi = true
    if (!kisiBul('14') && !masadakiKartlar.has('14')) kisiler.push({
      id: '14', role: 'guest', name: 'Kart 14', org: '', tier: 0,
      color: PALET[kisiler.length % PALET.length],
      seenAgo: 0.5, min: 0, invMin: 0, esler: new Set(),
    })
  }

  // kayıp kart senaryosu: seçilen kart bir süre susar
  if (!kayipKisi && simSn >= KAYIP_ARALIK[0]) {
    // Sahnede hiç kart yoksa (hepsi iade edildi) senaryo bekler; boş listede çökmesin.
    kayipKisi = kisiler[Math.floor(kisiler.length / 3)] ?? null
    if (kayipKisi) for (const esId of [...kayipKisi.esler]) fizikselAyril(kayipKisi.id, esId)
  }
  const kayipSessiz = kayipKisi && simSn >= KAYIP_ARALIK[0] && simSn < KAYIP_ARALIK[1]

  if (aliciKopuk) {
    // alıcı yok: hiç paket gelmez, herkesin seenAgo'su büyür, benzetim donar
    for (const k of kisiler) k.seenAgo += DT
    return
  }

  // duyulma: normalde herkes taze; susan kart hariç
  for (const k of kisiler) {
    k.seenAgo = (kayipSessiz && k === kayipKisi) ? k.seenAgo + DT : rndAralik(0, 2)
  }
  if (kayipKisi && !kayipSessiz && kayipKisi.kayipBildirildi) kayipKisi.kayipBildirildi = false

  // --- fiziksel eşleşme dinamiği ---
  const bosta = kisiler.filter((k) => k.esler.size === 0 && !(kayipSessiz && k === kayipKisi))
  const eslesmeOlasiligi = 0.010 * DT // kişi başına tik olasılığı
  for (const k of bosta) {
    if (k.esler.size > 0 || rnd() > eslesmeOlasiligi) continue
    const adaylar = bosta.filter((x) => x !== k && x.esler.size === 0)
    if (!adaylar.length) continue
    const karsi = adaylar.filter((x) => karsiRol(k, x))
    const es = (karsi.length && rnd() < 0.7) ? karsi[Math.floor(rnd() * karsi.length)] : adaylar[Math.floor(rnd() * adaylar.length)]
    const key = anahtar(k.id, es.id)
    k.esler.add(es.id); es.esler.add(k.id)
    const [a, b] = key.split('-')
    ciftler.set(key, {
      a, b, fiziksel: true, hedefSn: rndAralik(2, 14) * 60,
      fizikselSn: 0, ustundeSn: 0, altindaSn: 0,
      together: false, birlikteSn: 0, olcumler: [], sonDuyulma: simSn,
      bias: rndAralik(-3, 3), anlasmaVerildi: false,
    })
  }

  // --- çift ölçümleri, gecikmeler, süre birikimi ---
  for (const [key, c] of ciftler) {
    if (c.fiziksel) {
      c.fizikselSn += DT
      if (c.fizikselSn >= c.hedefSn || (kayipSessiz && (kisiBul(c.a) === kayipKisi || kisiBul(c.b) === kayipKisi))) {
        fizikselAyril(c.a, c.b)
      }
    }
    // ölçüm üret: yakınken güçlü, ayrıldıktan sonra zayıf
    // kalibrasyon demosu (/api/demo/tut) çiftin konumunu zorlayabilir
    const merkez = c.zorla === 'yuzyuze' ? -54 + c.bias
      : c.zorla === 'sirtsirta' ? -80 + c.bias
      : c.fiziksel ? -52 + c.bias : -84 + c.bias
    const ab = rnd() < 0.05 ? null : rndNormal(merkez, 3)
    const ba = rnd() < 0.05 ? null : rndNormal(merkez + rndAralik(-2, 2), 3)
    if (ab !== null || ba !== null) {
      const value = ab !== null && ba !== null ? (ab + ba) / 2 : (ab ?? ba)
      c.olcumler.push({ t: simSn, ab, ba, value })
      c.sonDuyulma = simSn
    }
    c.olcumler = c.olcumler.filter((o) => simSn - o.t <= GRAFIK_SN + 5)

    // giriş/çıkış gecikmesi: 1 dk üstte → başlar, 15 sn altta → biter. Başladığı tikte bekleme dakikasının
    // tamamı süreye eklenir, sonra her tik DT (gerçek sunucu cekirdek/cift.py ile aynı).
    const son = c.olcumler.at(-1)
    const ustunde = son && son.value >= esik
    if (ustunde) { c.ustundeSn += DT; c.altindaSn = 0 } else { c.altindaSn += DT; c.ustundeSn = 0 }
    let ekSn = DT
    if (!c.together && ustunde && c.ustundeSn >= GIRIS_SN) {
      c.together = true; c.birlikteSn = 0; ekSn = c.ustundeSn
      oturumAc(c, c.ustundeSn)
      const [ka, kb] = [kisiBul(c.a), kisiBul(c.b)]
      if (anlasmalar.has(kenarAnahtari(kimlik(ka), kimlik(kb)))) {
        bildir('repeat', 'deal', 'Yeniden bir arada',
          `${gorunenAd(ka)} ile ${gorunenAd(kb)} anlaşma sonrası tekrar bir araya geldi.`, [c.a, c.b])
      }
    }
    if (c.together) {
      c.birlikteSn += ekSn
      const [ka, kb] = [kisiBul(c.a), kisiBul(c.b)]
      const kk = kenarAnahtari(kimlik(ka), kimlik(kb))
      kenarlar.set(kk, (kenarlar.get(kk) ?? 0) + ekSn / 60)
      ka.min += ekSn / 60; kb.min += ekSn / 60
      if (karsiRol(ka, kb)) { ka.invMin += ekSn / 60; kb.invMin += ekSn / 60 }
      if (!c.anlasmaVerildi && c.birlikteSn >= anlasmaSuresiSn(c)) {
        c.anlasmaVerildi = true
        anlasmalar.add(kk) // kişi çifti: kart iade edilip başkasına verilince devredilmez
        const yat = ka.role === 'investor' ? ka : kb
        const gir = yat === ka ? kb : ka
        bildir('deal', 'deal', 'Potansiyel anlaşma',
          `${yat.name} (${'★'.repeat(yat.tier)}) ile ${gorunenAd(gir)} ${Math.round(c.birlikteSn / 60)} dakikadır birlikte.`,
          [c.a, c.b])
      }
      c.kuralTetiklendi ??= new Set()
      for (const r of kurallar) {
        if (!r.acik || c.kuralTetiklendi.has(r.kuralId) || c.birlikteSn < r.dakika * 60 || !kuralaUyar(r, ka, kb)) continue
        c.kuralTetiklendi.add(r.kuralId)
        bildir('kural', 'kural', r.ad,
          `${gorunenAd(ka)} ile ${gorunenAd(kb)} ${r.dakika ? `${r.dakika} dakikadır birlikte.` : 'yan yana geldi.'}`,
          [c.a, c.b], r.kuralId)
      }
      if (!c.fiziksel && c.altindaSn >= CIKIS_SN) {
        c.together = false
        c.kuralTetiklendi = new Set() // yeniden buluşurlarsa kurallar yine uyarabilir
        oturumKapat(c)
        bitenGorusme++
      }
    }
    // artık ne fiziksel ne birlikte ne de yakın zamanda duyulmuşsa kaydı kapat
    if (!c.fiziksel && !c.together && simSn - c.sonDuyulma > 30) ciftler.delete(key)
  }

  // --- kişi durumları ve bildirim kuralları ---
  for (const k of kisiler) {
    // Çıkış gecikmesindeki (fiziksel ayrılmış, henüz bitmemiş) görüşmeler de "birlikte" — panodaki durumla aynı.
    let birlikteMi = false
    for (const [, c] of ciftler) if (c.together && (c.a === k.id || c.b === k.id)) { birlikteMi = true; break }

    // kayıp kart bildirimi (60 sn duyulmadı → ciddi)
    if (k.seenAgo >= 60 && !k.kayipBildirildi) {
      k.kayipBildirildi = true
      bildir('lost', 'serious', 'Kart sinyali kesildi',
        `${gorunenAd(k)} (kart ${k.id}) 1 dk'dır duyulmuyor.`, [k.id])
    }

    // Kesintisiz boşta süre herkes için sayılır (people[].idleSinceS, §9); görüşünce ya da görünmez olunca sıfır.
    // Bildirim yalnız önemli yatırımcı (≥★★★) 6 dk yalnız kalınca.
    const kim = kimlik(k)
    if (!birlikteMi && k.seenAgo < 30) {
      const yalniz = (yalnizSn.get(kim) ?? 0) + DT
      yalnizSn.set(kim, yalniz)
      if (k.role === 'investor' && k.tier >= 3 && yalniz >= 360 && !k.yalnizBildirildi) {
        k.yalnizBildirildi = true
        bildir('idle_investor', 'warn', 'Önemli yatırımcı yalnız',
          `${k.name} (${'★'.repeat(k.tier)}) 6 dk'dır kimseyle görüşmüyor.`, [k.id])
      }
    } else {
      yalnizSn.set(kim, 0)
      k.yalnizBildirildi = false
    }
  }
}

function fizikselAyril(aId, bId) {
  const c = ciftler.get(anahtar(aId, bId))
  if (c) c.fiziksel = false
  kisiBul(aId)?.esler.delete(bId)
  kisiBul(bId)?.esler.delete(aId)
}

// ---------- durum nesnesi (brief §5.1 birebir) ----------
function durumUret() {
  const simdi = new Date()

  const canli = []
  const sinyaller = []
  const gecmis = {}
  for (const [key, c] of ciftler) {
    if (simSn - c.sonDuyulma > 10) continue
    const pencere = c.olcumler.filter((o) => simSn - o.t <= 10)
    if (!pencere.length) continue
    const degerler = pencere.map((o) => o.value).sort((x, y) => x - y)
    const ortanca = degerler[Math.floor(degerler.length / 2)]
    const son = pencere.at(-1)
    sinyaller.push({
      a: c.a, b: c.b,
      ab: son.ab === null ? null : Math.round(son.ab * 10) / 10,
      ba: son.ba === null ? null : Math.round(son.ba * 10) / 10,
      value: Math.round(ortanca * 10) / 10,
      n: pencere.length,
      above: ortanca >= esik,
      together: c.together,
    })
    if (c.together) canli.push({ a: c.a, b: c.b, real: true, rssi: Math.round(ortanca * 10) / 10 })

    // grafik: son 90 sn, 2 sn'lik ortancalar, en eski başta
    const kovalar = new Map()
    for (const o of c.olcumler) {
      if (simSn - o.t > GRAFIK_SN) continue
      const kova = Math.floor((simSn - o.t) / 2)
      if (!kovalar.has(kova)) kovalar.set(kova, [])
      kovalar.get(kova).push(o.value)
    }
    const seri = [...kovalar.entries()]
      .sort((x, y) => y[0] - x[0])
      .map(([kova, degerlerK]) => {
        const s = degerlerK.sort((x, y) => x - y)
        return [kova * 2, Math.round(s[Math.floor(s.length / 2)] * 10) / 10]
      })
    if (seri.length) gecmis[key] = seri
  }

  // Kişi bazlı kenarlar → şu an sahnede olan kartlar (Faz 1 sözleşmesi kart no ile).
  // Kartı olmayan (ayrılmış) kişinin süreleri silinmez, yalnız panoda görünmez.
  const sahnede = new Map(kisiler.map((k) => [kimlik(k), k]))
  const kenarCiftleri = []
  for (const [key, dk] of kenarlar) {
    const [x, y] = key.split('|')
    const [a, b] = [sahnede.get(x), sahnede.get(y)]
    if (a && b && dk > 0) kenarCiftleri.push([a, b, dk])
  }

  const people = kisiler.map((k) => {
    const aktifCiftler = [...k.esler]
      .map((esId) => ciftler.get(anahtar(k.id, esId)))
      .filter((c) => c?.together)
    // fiziksel ayrılmış ama çıkış gecikmesi dolmamış görüşmeler de "birlikte"
    for (const [, c] of ciftler) {
      if (c.together && !aktifCiftler.includes(c) && (c.a === k.id || c.b === k.id)) aktifCiftler.push(c)
    }
    const durum = k.seenAgo > 30 ? 'away' : aktifCiftler.length ? 'talking' : 'idle'
    const esAdlari = aktifCiftler
      .map((c) => kisiBul(c.a === k.id ? c.b : c.a))
      .filter(Boolean).map(gorunenAd).join(', ')

    const karsiKisiler = new Set()
    for (const [a, b] of kenarCiftleri) {
      if (a !== k && b !== k) continue
      const es = a === k ? b : a
      if (karsiRol(k, es)) karsiKisiler.add(es.id)
    }

    return {
      id: k.id, role: k.role, name: k.name, org: k.org, color: k.color,
      stars: '★'.repeat(k.tier), tier: k.tier,
      status: durum,
      withName: durum === 'talking' ? esAdlari : '',
      live: aktifCiftler.length ? Math.max(...aktifCiftler.map((c) => c.birlikteSn)) / 60 : 0,
      min: Math.round(k.min * 100) / 100,
      invMin: Math.round(k.invMin * 100) / 100,
      invPeers: karsiKisiler.size,
      seenAgo: Math.round(k.seenAgo * 10) / 10,
      idleSinceS: Math.round((yalnizSn.get(kimlik(k)) ?? 0) * 10) / 10,
    }
  })

  const edges = kenarCiftleri.map(([a, b, dk]) => ({ a: a.id, b: b.id, min: Math.round(dk * 100) / 100 }))

  const girisimciler = kisiler.filter((k) => k.role === 'founder')
  const ulasan = new Set()
  for (const [a, b] of kenarCiftleri) {
    if (karsiRol(a, b)) ulasan.add((a.role === 'founder' ? a : b).id)
  }
  const karmaDk = kenarCiftleri.reduce((toplam, [a, b, dk]) => (karsiRol(a, b) ? toplam + dk : toplam), 0)

  return {
    people,
    live: canli,
    edges,
    alerts: bildirimler,
    stats: {
      done: bitenGorusme,
      livePairs: canli.length,
      mixedMin: Math.round(karmaDk * 10) / 10,
      deals: anlasmalar.size,
      reached: ulasan.size,
      founders: girisimciler.length,
    },
    // brief §5.1: alıcıdan son satır kaç SANİYE önce geldi. >5 ise sorun var.
    receiverAge: aliciKopuk
      ? Math.round((simSn - sonAliciSn) * 10) / 10
      : Math.round(rndAralik(0.1, 0.6) * 10) / 10,
    elapsed: Math.round(simSn * 10) / 10,
    event: {
      name: 'Yatırımcı Buluşması',
      sub: 'Yakınlık kartları · sahte veri',
      date: '28.09.2026 · Demo Salonu',
      progress: Math.min(1, simSn / (ETKINLIK_DK * 60)),
    },
    clock: simdi.toTimeString().slice(0, 8),
    threshold: esik,
    signals: sinyaller,
    history: gecmis,
    chartSeconds: GRAFIK_SN,
    rules: { dealAfterS: ANLASMA_SN },
  }
}

function sifirla() {
  simSn = 0
  sonAliciSn = 0
  aliciKopuk = false
  ciftler = new Map()
  kenarlar = new Map()
  bildirimler = []
  oturumlar = []
  anlasmalar = new Set()
  bitenGorusme = 0
  yalnizSn = new Map()
  kayipKisi = null
  // kartı olmayanların (ayrılan / kart değiştiren) biriken süreleri de sıfırlanır
  for (const kat of katilimcilar) { kat.min = 0; kat.invMin = 0 }
  // Kart 14 senaryosu yeniden oynar — ama kart bir kişiye verildiyse o kişinin kartıdır, düşürülmez.
  const kart14Atanmis = !!kartKat('14')
  atanmamisGeldi = kart14Atanmis
  for (const k of kisiler) {
    if (k.id === '14' && !kart14Atanmis) continue
    k.min = 0; k.invMin = 0; k.esler = new Set()
    k.kayipBildirildi = false; k.yalnizBildirildi = false
    k.seenAgo = rndAralik(0, 2)
  }
  if (!kart14Atanmis) kisiler = kisiler.filter((k) => k.id !== '14')
}

// ---------- HTTP + SSE ----------
const sseIstemciler = new Set()

function metinOku(istek) {
  return new Promise((coz) => {
    let g = ''
    istek.setEncoding('utf8') // çok baytlı Türkçe harfler parça sınırında bölünmesin
    istek.on('data', (p) => { g += p })
    istek.on('end', () => coz(g))
  })
}
async function govdeOku(istek) {
  const g = await metinOku(istek)
  try { return JSON.parse(g || '{}') } catch { return null }
}
const json = (yanit, kod, veri) => {
  yanit.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8' })
  yanit.end(JSON.stringify(veri))
}

async function apiYonlendir(istek, yanit) {
  const url = istek.url
  const yol = url.split('?')[0]

  if (istek.method === 'GET' && yol === '/api/people') { json(yanit, 200, katilimcilar.map(katDto)); return true }

  if (istek.method === 'GET' && yol === '/api/rules') { json(yanit, 200, kurallar); return true }
  if (istek.method === 'POST' && yol === '/api/rules') {
    const g = await govdeOku(istek)
    const r = g && typeof g === 'object' ? kuralCoz(g, `r${kuralSayac + 1}`) : 'geçersiz kural'
    if (typeof r === 'string') { json(yanit, 400, { ok: false, hata: r }); return true }
    kuralSayac++; kurallar.push(r)
    json(yanit, 200, r); return true
  }
  const kuralYolu = yol.match(/^\/api\/rules\/([^/]+)$/)
  if (kuralYolu) {
    const i = kurallar.findIndex((k) => k.kuralId === kuralYolu[1])
    if (i < 0) { json(yanit, 404, { ok: false, hata: 'kural yok' }); return true }
    if (istek.method === 'PATCH') {
      const g = await govdeOku(istek) || {}
      const r = kuralCoz({ ...kurallar[i], ...g }, kurallar[i].kuralId)
      if (typeof r === 'string') { json(yanit, 400, { ok: false, hata: r }); return true }
      kurallar[i] = r
      json(yanit, 200, r); return true
    }
    if (istek.method === 'DELETE') { kurallar.splice(i, 1); json(yanit, 200, { ok: true }); return true }
  }
  if (istek.method === 'GET' && yol === '/api/sessions') {
    const y = (v) => (v === null ? null : Math.round(v * 10) / 10)
    json(yanit, 200, oturumlar.map((o) => ({ a: o.a, b: o.b, start: y(o.start), end: y(o.end) }))); return true
  }

  if (istek.method === 'GET' && yol === '/api/cards') { json(yanit, 200, kartlariListele()); return true }

  // YALNIZ MOCK — arayüz demo düğmelerini (kalibrasyonda çifti tut) yalnız bu uç varsa gösterir.
  // Gerçek sunucu bu ucu SAĞLAMAMALI (404) → üretimde demo düğmesi görünmez.
  if (istek.method === 'GET' && yol === '/api/demo') { json(yanit, 200, { ok: true, mock: true }); return true }

  // YALNIZ MOCK — kalibrasyon demosu: iki kartı yüz yüze / sırt sırta tutmayı taklit eder
  // (gerçek sunucuda yok; kartları teknik kişi eliyle tutar). mod: null → bırak.
  if (istek.method === 'POST' && yol === '/api/demo/tut') {
    const g = await govdeOku(istek) || {}
    const [a, b] = [String(g.a), String(g.b)]
    if (!['yuzyuze', 'sirtsirta', null].includes(g.mod ?? null)) { json(yanit, 400, { ok: false, hata: 'mod' }); return true }
    if (a === b || !kisiBul(a) || !kisiBul(b)) { json(yanit, 404, { ok: false, hata: 'kart panoda yok' }); return true }
    const key = anahtar(a, b)
    let c = ciftler.get(key)
    if (!c && g.mod) {
      const [x, y] = key.split('-')
      c = { a: x, b: y, fiziksel: false, hedefSn: 0, fizikselSn: 0, ustundeSn: 0, altindaSn: 0,
        together: false, birlikteSn: 0, olcumler: [], sonDuyulma: simSn, bias: 0, anlasmaVerildi: false } // rnd() yok: tohum bozulmasın
      ciftler.set(key, c)
    }
    if (c) c.zorla = g.mod ?? null
    json(yanit, 200, { ok: true }); return true
  }

  if (istek.method === 'POST' && yol === '/api/people') {
    const g = await govdeOku(istek)
    if (!g || !metinAlan(g.ad).trim()) { json(yanit, 400, { ok: false, hata: 'ad gerekli' }); return true }
    json(yanit, 200, katDto(kisiEkle(g))); return true
  }

  // /api/people/{id}'den ÖNCE: yoksa "import" kişi kimliği sanılır
  if (istek.method === 'POST' && yol === '/api/people/import') {
    const metin = await metinOku(istek)
    if (!metin.replace(/^\uFEFF/, '').trim()) { json(yanit, 400, { ok: false, hata: 'boş dosya' }); return true }
    json(yanit, 200, csvIceAktar(metin)); return true
  }

  const eslesme = yol.match(/^\/api\/people\/([^/]+)$/)
  if (eslesme) {
    const kat = katBul(eslesme[1])
    if (!kat) { json(yanit, 404, { ok: false }); return true }
    if (istek.method === 'PATCH') {
      const g = await govdeOku(istek) || {}
      // renk/kisiId değişmez; geçersiz rol ve boş ad yok sayılır
      if (typeof g.ad === 'string' && g.ad.trim()) kat.ad = g.ad.trim()
      if (['investor', 'founder', 'guest'].includes(g.rol)) kat.rol = g.rol
      for (const alan of ['kurum', 'not']) if (typeof g[alan] === 'string') kat[alan] = g[alan]
      for (const alan of PROFIL_METINLERI) if (typeof g[alan] === 'string') kat[alan] = profilMetni(g[alan])
      if (g.paylasim !== undefined) kat.paylasim = evetMi(g.paylasim)
      if (g.yildiz !== undefined) kat.yildiz = g.yildiz | 0
      kat.yildiz = kat.rol === 'investor' ? Math.max(0, Math.min(5, kat.yildiz)) : 0
      kat.asama = asamaAl(kat.rol, g.asama !== undefined ? g.asama : kat.asama)
      const e = kat.atananKart && kisiBul(kat.atananKart)
      if (e) kimlikYaz(e, kat)
      json(yanit, 200, katDto(kat)); return true
    }
    if (istek.method === 'DELETE') {
      if (kat.atananKart) iade(kat.atananKart)
      katilimcilar = katilimcilar.filter((k) => k.kisiId !== kat.kisiId)
      json(yanit, 200, { ok: true }); return true
    }
  }

  if (istek.method === 'POST' && yol === '/api/assign') {
    const g = await govdeOku(istek)
    const kart = kartNo(g?.kart)
    if (!g || !g.kisiId || !kart) { json(yanit, 400, { ok: false, hata: 'kart no 1–99 olmalı' }); return true }
    const oldu = ata(g.kisiId, kart)
    json(yanit, oldu ? 200 : 404, { ok: oldu }); return true
  }

  if (istek.method === 'POST' && yol === '/api/unassign') {
    const g = await govdeOku(istek)
    const kart = kartNo(g?.kart)
    if (!g || !kart) { json(yanit, 400, { ok: false, hata: 'kart no 1–99 olmalı' }); return true }
    // Ne kişisi ne sahnede ne masada olan kart: bilinmiyor (masaya hayalet kart eklenmesin).
    if (!kartKat(kart) && !kisiBul(kart) && !masadakiKartlar.has(kart)) { json(yanit, 404, { ok: false, hata: 'kart bilinmiyor' }); return true }
    iade(kart, g.ayrildi !== false); json(yanit, 200, { ok: true }); return true
  }

  return false
}

const sunucu = http.createServer((istek, yanit) => {
  if (istek.url.startsWith('/api/')) {
    apiYonlendir(istek, yanit).then((esles) => {
      if (!esles) json(yanit, 404, { ok: false, hata: 'bilinmeyen uç' })
    }).catch((hata) => {
      // Tek bir hatalı istek süreci (ve bütün SSE istemcilerini) düşürmesin.
      console.error('api hatası:', istek.method, istek.url, hata)
      if (!yanit.headersSent) json(yanit, 500, { ok: false, hata: 'sunucu hatası' })
      else yanit.end()
    })
    return
  }
  // ?grafik=0 → history {} (sinyal grafiğini yalnız Kurulum ister; gerçek sunucuyla aynı, backend B7)
  const [durumYolu, durumSorgu = ''] = istek.url.split('?')
  const grafikli = new URLSearchParams(durumSorgu).get('grafik') !== '0'
  const grafigeGore = (d) => (grafikli ? d : { ...d, history: {} })
  if (istek.method === 'GET' && durumYolu === '/state') {
    yanit.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    yanit.end(JSON.stringify(grafigeGore(durumUret())))
    return
  }
  if (istek.method === 'GET' && durumYolu === '/events') {
    yanit.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    yanit.grafik = grafikli
    yanit.write(`data: ${JSON.stringify(grafigeGore(durumUret()))}\n\n`)
    sseIstemciler.add(yanit)
    istek.on('close', () => sseIstemciler.delete(yanit))
    return
  }
  if (istek.method === 'POST' && istek.url === '/control') {
    let govde = ''
    istek.on('data', (parca) => { govde += parca })
    istek.on('end', () => {
      let komut
      try { komut = JSON.parse(govde) } catch { komut = null }
      if (komut?.cmd === 'reset') {
        sifirla()
        yanit.writeHead(200, { 'Content-Type': 'application/json' })
        yanit.end('{"ok":true}')
      } else if (komut?.cmd === 'threshold' &&
                 typeof komut.value === 'number' && komut.value >= -100 && komut.value <= -20) {
        esik = komut.value
        yanit.writeHead(200, { 'Content-Type': 'application/json' })
        yanit.end('{"ok":true}')
      } else {
        yanit.writeHead(400, { 'Content-Type': 'application/json' })
        yanit.end('{"ok":false,"hata":"gecersiz komut"}')
      }
    })
    return
  }
  yanit.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  yanit.end('Yakınlık mock sunucusu — uçlar: GET /state, GET /events (SSE), POST /control\n')
})

setInterval(() => {
  tik()
  if (sseIstemciler.size) {
    const d = durumUret()
    const tam = `data: ${JSON.stringify(d)}\n\n`
    let grafiksiz = null
    for (const istemci of sseIstemciler) {
      istemci.write(istemci.grafik ? tam : (grafiksiz ??= `data: ${JSON.stringify({ ...d, history: {} })}\n\n`))
    }
  }
}, TIK_MS)

sunucu.listen(PORT, () => {
  console.log(`mock dinliyor: http://localhost:${PORT}  (kişi=${kisiler.length}, tohum=${TOHUM}, hız=${HIZ}x, kopma=${KOPMA ? 'açık' : 'kapalı'})`)
})
