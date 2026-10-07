// Karşılama masası saf yardımcıları — kayıtlı kişi araması + form geçerliliği.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { katilimciAra, formGecerli, acikKartlar, kartOner, iadeAdaylari, geriAlinabilir, GERI_AL_DK, duzenlemeFarki, kisiDurumu, kartBekleyenler, bostakiKartlar, kayipKartlar, KAYIP_SN } from './masaYardim.js'

const LISTE = [
  { kisiId: 'k1', ad: 'Ayşe Demir', kurum: 'Atlas Ventures', rol: 'investor' },
  { kisiId: 'k2', ad: 'Cem Erdem', kurum: 'Nova Robotik', rol: 'founder' },
  { kisiId: 'k3', ad: 'İrem Korkmaz', kurum: 'Peak Enerji', rol: 'founder' },
]
const idler = (l) => l.map((k) => k.kisiId)

test('katilimciAra: boş arama → hepsi', () => {
  assert.equal(katilimciAra(LISTE, '').length, 3)
  assert.equal(katilimciAra(LISTE, '   ').length, 3)
})

test('katilimciAra: ad ve kurumda, Türkçe duyarsız', () => {
  assert.deepEqual(idler(katilimciAra(LISTE, 'nova')), ['k2'])
  assert.deepEqual(idler(katilimciAra(LISTE, 'AYŞE')), ['k1'])
  assert.deepEqual(idler(katilimciAra(LISTE, 'irem')), ['k3'])
})

test('formGecerli: ad zorunlu, rol geçerli olmalı', () => {
  assert.equal(formGecerli({ ad: 'Yeni Kişi', rol: 'founder' }), true)
  assert.equal(formGecerli({ ad: '', rol: 'founder' }), false)
  assert.equal(formGecerli({ ad: '   ', rol: 'founder' }), false)
  assert.equal(formGecerli({ ad: 'X', rol: 'gecersiz' }), false)
  assert.equal(formGecerli({ ad: 'X' }), false)
})

const KARTLAR = [
  { kart: '10', rssiAlici: -75, seenAgo: 0.5, atanan: 'k1' },
  { kart: '11', rssiAlici: -50, seenAgo: 1.0, atanan: null },
  { kart: '12', rssiAlici: -80, seenAgo: 40, atanan: null },  // bayat (duyulmuyor)
  { kart: '113', rssiAlici: -70, seenAgo: 0.2, atanan: null },
]

test('acikKartlar: yalnız yakın zamanda duyulanlar, kart numarasına göre (numarayla verilir)', () => {
  const a = acikKartlar(KARTLAR)
  assert.deepEqual(a.map((k) => k.kart), ['10', '11', '113'])   // 12 bayat, elendi
})

test('kartOner: numara ön ekine göre süzer; boşta hepsi', () => {
  assert.deepEqual(kartOner(KARTLAR, '').map((k) => k.kart), ['10', '11', '12', '113'])
  assert.deepEqual(kartOner(KARTLAR, '1').map((k) => k.kart), ['10', '11', '12', '113'])
  assert.deepEqual(kartOner(KARTLAR, '11').map((k) => k.kart), ['11', '113'])
  assert.deepEqual(kartOner(KARTLAR, '113').map((k) => k.kart), ['113'])
})

test('kartOner: yazılan numaranın tam eşi en başta, gerisi sırasını korur', () => {
  const kartlar = [{ kart: '30' }, { kart: '31' }, { kart: '3' }, { kart: '38' }]
  assert.deepEqual(kartOner(kartlar, '3').map((k) => k.kart), ['3', '30', '31', '38'])
  assert.deepEqual(kartOner(kartlar, '03').map((k) => k.kart), ['3'], 'baştaki sıfır atılır')
})

const KARTLI = [
  { kisiId: 'k1', ad: 'Ayşe Demir', kurum: 'Atlas Ventures', atananKart: '14' },
  { kisiId: 'k2', ad: 'Cem Erdem', kurum: 'Nova Robotik', atananKart: null },   // kartsız
  { kisiId: 'k3', ad: 'İrem Korkmaz', kurum: 'Peak Enerji', atananKart: '7' },
  { kisiId: 'k4', ad: 'Onur Koç', kurum: '', atananKart: '41' },
]

test('iadeAdaylari: yalnız kartı olanlar, kart no\'ya göre sıralı', () => {
  assert.deepEqual(idler(iadeAdaylari(KARTLI, '')), ['k3', 'k1', 'k4'])
})

test('iadeAdaylari: ad/kurumda veya kart numarasında arar', () => {
  assert.deepEqual(idler(iadeAdaylari(KARTLI, 'atlas')), ['k1'])
  assert.deepEqual(idler(iadeAdaylari(KARTLI, 'İREM')), ['k3'])
  assert.deepEqual(idler(iadeAdaylari(KARTLI, '4')), ['k4'])       // 14 değil: ön ek
  assert.deepEqual(idler(iadeAdaylari(KARTLI, 'nova')), [])        // kartsız kişi aday değil
})

test('geriAlinabilir: son birkaç dakikadaki atama geri alınabilir, sonrası değil', () => {
  const t0 = 1_000_000
  const atama = { kisiId: 'k1', ad: 'Ayşe Demir', kart: '14', zaman: t0 }
  assert.equal(geriAlinabilir(atama, t0), true)
  assert.equal(geriAlinabilir(atama, t0 + (GERI_AL_DK * 60_000) - 1), true)
  assert.equal(geriAlinabilir(atama, t0 + GERI_AL_DK * 60_000), false)
  assert.equal(geriAlinabilir(null, t0), false)
})

test('duzenlemeFarki: yalnız değişen alanlar; renk hiç yok', () => {
  const kisi = { kisiId: 'k1', ad: 'Ayşe Demir', rol: 'investor', kurum: 'Atlas', yildiz: 3, not: '', renk: '#3987e5' }
  const form = { ad: 'Ayşe Demir ', rol: 'investor', kurum: 'Atlas', yildiz: 4, not: '', renk: '#000000' }
  assert.deepEqual(duzenlemeFarki(kisi, form), { yildiz: 4 })
  assert.deepEqual(duzenlemeFarki(kisi, { ...kisi }), {})
})

test('duzenlemeFarki: yatırımcılıktan çıkınca yıldız 0 olur', () => {
  const kisi = { ad: 'Ayşe', rol: 'investor', kurum: '', yildiz: 3, not: '' }
  assert.deepEqual(duzenlemeFarki(kisi, { ...kisi, rol: 'founder' }), { rol: 'founder', yildiz: 0 })
})

test('kisiDurumu: kartlı / kart bekliyor / ayrıldı', () => {
  assert.deepEqual(kisiDurumu({ atananKart: '14', ayrildi: false }), { tur: 'kartli', etiket: 'Kart 14' })
  assert.deepEqual(kisiDurumu({ atananKart: null, ayrildi: false }), { tur: 'bekliyor', etiket: 'kart bekliyor' })
  assert.deepEqual(kisiDurumu({ atananKart: null, ayrildi: true }), { tur: 'ayrildi', etiket: 'ayrıldı' })
})

test('kartBekleyenler: ayrılanlar ve kartlılar dışarıda', () => {
  const l = [
    { kisiId: 'a', atananKart: '3', ayrildi: false },
    { kisiId: 'b', atananKart: null, ayrildi: false },
    { kisiId: 'c', atananKart: null, ayrildi: true },
  ]
  assert.deepEqual(idler(kartBekleyenler(l)), ['b'])
})

test('kisiDurumu: kartı kayıpsa "Kartı kontrol et"', () => {
  assert.deepEqual(kisiDurumu({ atananKart: '14' }, true), { tur: 'kayip', etiket: 'Kart 14 · Kartı kontrol et' })
  assert.equal(kisiDurumu({ atananKart: null, ayrildi: false }, true).tur, 'bekliyor', 'kartsız kişi kayıp olamaz')
})

const MASA = [
  { kart: '40', atanan: null, seenAgo: 0.3 },
  { kart: '7', atanan: null, seenAgo: 1.2 },
  { kart: '9', atanan: null, seenAgo: 30 },     // duyulmuyor: stok sayılmaz
  { kart: '12', atanan: 'k1', seenAgo: 0.5 },   // atanmış
  { kart: '15', atanan: 'k2', seenAgo: 75 },     // kayıp
  { kart: '16', atanan: 'k3', seenAgo: KAYIP_SN },
  { kart: '17', atanan: 'yok', seenAgo: 90 },   // kaydı olmayan atanmış
]

test('bostakiKartlar: açık ve atanmamış, numaraya göre', () => {
  assert.deepEqual(bostakiKartlar(MASA).map((k) => k.kart), ['7', '40'])
})

test('kayipKartlar: atanmış ve ≥60 sn duyulmayan, en uzun susan üstte', () => {
  const kisiler = [{ kisiId: 'k1', ad: 'A' }, { kisiId: 'k2', ad: 'B' }, { kisiId: 'k3', ad: 'C' }]
  const l = kayipKartlar(MASA, kisiler)
  assert.deepEqual(l.map((x) => [x.kart, x.kisi.ad]), [['15', 'B'], ['16', 'C']])
})

test('duzenlemeFarki profil: yalnız değişen profil alanları; aşama yalnız girişimcide; eski kayıtta alan yoksa boş sayılır', () => {
  const eski = { kisiId: 'k2', ad: 'Cem', rol: 'founder', kurum: 'Nova', yildiz: 0, not: '' } // sürüm 1 kaydı: profil yok
  const form = { ad: 'Cem', rol: 'founder', kurum: 'Nova', yildiz: 0, not: '',
    sektor: ' Sağlık ', asama: 'mvp', tanitim: '', web: '', eposta: 'can@nova.com', paylasim: true }
  assert.deepEqual(duzenlemeFarki(eski, form), { sektor: 'Sağlık', asama: 'mvp', eposta: 'can@nova.com', paylasim: true })
  const yatirimci = { ...eski, rol: 'investor', asama: '', sektor: 'Sağlık', paylasim: false }
  assert.deepEqual(duzenlemeFarki(yatirimci, { ...form, rol: 'investor', sektor: 'Sağlık', eposta: '', paylasim: false }), {})
})
