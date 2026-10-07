// Durumdan türetilen küçük kararlar — JSX içinde hesap yok (temiz mimari).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aliciBagli, durumCumlesi, gruplaRol, gorunenAd, atanmamisKartMi, siralaKisiler, ozetKutulari, etkinlikYuzde, kisiGorusmeleri, karsiRolYazisi, SIRALAMALAR, veriCanli } from './durum.js'

test('aliciBagli: taze veri geliyorsa bağlı', () => {
  assert.equal(aliciBagli({ receiverAge: 0.1 }), true)
  assert.equal(aliciBagli({ receiverAge: 5 }), true)
})

test('aliciBagli: 5 sn üstü bayat → bağlı değil (brief §5.1: >5 sorun)', () => {
  assert.equal(aliciBagli({ receiverAge: 5.1 }), false)
  assert.equal(aliciBagli({ receiverAge: 40 }), false)
})

test('aliciBagli: hiç veri gelmediyse (null/undefined) bağlı değil', () => {
  assert.equal(aliciBagli({ receiverAge: null }), false)
  assert.equal(aliciBagli({ receiverAge: undefined }), false)
})

test('durumCumlesi: birlikte → "X ile · süre"', () => {
  assert.equal(
    durumCumlesi({ status: 'talking', withName: 'Nova Robotik', live: 3.34 }),
    'Nova Robotik ile · 3 dk 20 sn',
  )
})

test('durumCumlesi: birden fazla kişiyle birlikte', () => {
  assert.equal(
    durumCumlesi({ status: 'talking', withName: 'Ayşe, Mehmet', live: 0.5 }),
    'Ayşe, Mehmet ile · 30 sn',
  )
})

test('durumCumlesi: boşta', () => {
  assert.equal(durumCumlesi({ status: 'idle' }), 'boşta')
  assert.equal(durumCumlesi({ status: 'idle', idleSinceS: 59.5 }), 'boşta')
})

test('durumCumlesi: boşta süresi idleSinceS ile, tam dakika', () => {
  assert.equal(durumCumlesi({ status: 'idle', idleSinceS: 250 }), "boşta · 4 dk'dır")
  assert.equal(durumCumlesi({ status: 'idle', idleSinceS: 3960 }), "boşta · 1 sa 6 dk'dır")
})

test('durumCumlesi: görünmüyor → seenAgo ile', () => {
  assert.equal(
    durumCumlesi({ status: 'away', seenAgo: 130 }),
    'görünmüyor · 2 dk önce',
  )
})

test('gorunenAd: girişimcide kurum öne (brief §3)', () => {
  assert.equal(gorunenAd({ role: 'founder', name: 'Cem Erdem', org: 'Nova Robotik' }), 'Nova Robotik · Cem Erdem')
  assert.equal(gorunenAd({ role: 'founder', name: 'Cem Erdem', org: '' }), 'Cem Erdem')
  assert.equal(gorunenAd({ role: 'investor', name: 'Ayşe Demir', org: 'Atlas' }), 'Ayşe Demir')
})

test('gruplaRol: rol sırası sabit (yatırımcı→girişimci→misafir), boş grup atlanır', () => {
  const gruplar = gruplaRol([
    { id: '1', role: 'founder' },
    { id: '2', role: 'investor' },
    { id: '3', role: 'founder' },
  ])
  assert.deepEqual(gruplar.map((g) => g.rol), ['investor', 'founder'])
  assert.deepEqual(gruplar.map((g) => g.baslik), ['Yatırımcılar', 'Girişimciler'])
  assert.deepEqual(gruplar.map((g) => g.kisiler.length), [1, 2])
  // grup içi orijinal sıra korunur (sakin sıralama: sunucu sırası)
  assert.deepEqual(gruplar[1].kisiler.map((k) => k.id), ['1', '3'])
})

test('gruplaRol: misafir grubu da olur', () => {
  const gruplar = gruplaRol([{ id: '1', role: 'guest' }])
  assert.deepEqual(gruplar.map((g) => g.baslik), ['Misafirler'])
})

test('atanmamisKartMi: sunucunun otomatik eklediği "Kart N" misafiri', () => {
  assert.equal(atanmamisKartMi({ name: 'Kart 14', role: 'guest' }), true)
  assert.equal(atanmamisKartMi({ name: 'Kart 3', role: 'guest' }), true)
})

test('atanmamisKartMi: gerçek kişi atanmamış sayılmaz', () => {
  assert.equal(atanmamisKartMi({ name: 'Ayşe Demir', role: 'guest' }), false)
  assert.equal(atanmamisKartMi({ name: 'Kartal Yılmaz', role: 'guest' }), false)
  // "Kart N" adı ama misafir değilse (elle adlandırılmış) atanmamış sayma
  assert.equal(atanmamisKartMi({ name: 'Kart 14', role: 'investor' }), false)
})

test('siralaKisiler: durum önceliği (birlikte→boşta→görünmüyor)', () => {
  const p = [
    { id: '1', status: 'away' },
    { id: '2', status: 'talking' },
    { id: '3', status: 'idle' },
    { id: '4', status: 'talking' },
  ]
  assert.deepEqual(siralaKisiler(p).map((k) => k.id), ['2', '4', '3', '1'])
})

test('siralaKisiler: aynı durumda sunucu sırası korunur (kararlı — zıplamaz)', () => {
  const p = [
    { id: '9', status: 'idle' },
    { id: '3', status: 'idle' },
    { id: '7', status: 'idle' },
  ]
  assert.deepEqual(siralaKisiler(p).map((k) => k.id), ['9', '3', '7'])
})

test('siralaKisiler: girdiyi değiştirmez', () => {
  const p = [{ id: '1', status: 'away' }, { id: '2', status: 'talking' }]
  siralaKisiler(p)
  assert.deepEqual(p.map((k) => k.id), ['1', '2'])
})

test('ozetKutulari: stats alanlarını etiketli, biçimli kutulara çevirir', () => {
  const durum = {
    stats: { livePairs: 3, done: 12, mixedMin: 21.4, deals: 1, reached: 5, founders: 12 },
  }
  const kutular = ozetKutulari(durum)
  assert.deepEqual(kutular.map((k) => k.deger), ['3', '12', '21 dk 24 sn', '1', '5/12'])
  assert.ok(kutular.every((k) => typeof k.ad === 'string' && k.ad.length))
})

test('etkinlikYuzde: 0..1 → 0..100, null → null, sınır dışı kırpılır', () => {
  assert.equal(etkinlikYuzde({ event: { progress: 0.5 } }), 50)
  assert.equal(etkinlikYuzde({ event: { progress: null } }), null)
  assert.equal(etkinlikYuzde({ event: { progress: 1.2 } }), 100)
  assert.equal(etkinlikYuzde({ event: { progress: -0.1 } }), 0)
})

test('kisiGorusmeleri: kişiye ait kenarlar, karşı taraf çözümlü, süreye göre azalan', () => {
  const people = [
    { id: '10', name: 'Ayşe' }, { id: '11', name: 'Can' }, { id: '12', name: 'Ece' },
  ]
  const edges = [
    { a: '10', b: '11', min: 2 },
    { a: '12', b: '10', min: 9 },   // ters yön
    { a: '11', b: '12', min: 5 },   // 10'la ilgisiz
  ]
  const g = kisiGorusmeleri('10', edges, people)
  assert.deepEqual(g.map((x) => [x.kisi.id, x.min]), [['12', 9], ['11', 2]])
})

test('kisiGorusmeleri: karşı tarafı listede olmayan kenar atlanır', () => {
  const people = [{ id: '10', name: 'Ayşe' }]
  const g = kisiGorusmeleri('10', [{ a: '10', b: '99', min: 3 }], people)
  assert.equal(g.length, 0)
})

test('karsiRolYazisi: yatırımcıda girişimci, girişimcide yatırımcı sayısı; misafirde yok (brief §7.2)', () => {
  assert.equal(karsiRolYazisi({ role: 'investor', invPeers: 3 }), '3 girişimci')
  assert.equal(karsiRolYazisi({ role: 'founder', invPeers: 1 }), '1 yatırımcı')
  assert.equal(karsiRolYazisi({ role: 'founder', invPeers: 0 }), '0 yatırımcı')
  assert.equal(karsiRolYazisi({ role: 'founder' }), '0 yatırımcı')
  assert.equal(karsiRolYazisi({ role: 'guest', invPeers: 2 }), null)
})

const SIRA_KISILER = [
  { id: '1', status: 'idle', min: 12, invPeers: 1, tier: 3 },
  { id: '2', status: 'talking', min: 40, invPeers: 3, tier: 0 },
  { id: '3', status: 'idle', min: 0, invPeers: 0, tier: 5 },
  { id: '4', status: 'away', min: 12, invPeers: 0, tier: 4 },
  { id: '5', status: 'idle', min: 0, invPeers: 0, tier: 0 },
]
const ids = (l) => l.map((k) => k.id)

test('siralaKisiler(sure): en uzun görüşen üstte; eşit sürede sunucu sırası (kararlı)', () => {
  assert.deepEqual(ids(siralaKisiler(SIRA_KISILER, 'sure')), ['2', '1', '4', '3', '5'])
})

test('siralaKisiler(yalniz): en az görüşen üstte, eşitlikte daha az karşı rol kişisi, sonra sunucu sırası', () => {
  const p = [...SIRA_KISILER, { id: '6', status: 'idle', min: 0, invPeers: 2, tier: 0 }]
  assert.deepEqual(ids(siralaKisiler(p, 'yalniz')), ['3', '5', '6', '4', '1', '2'])
})

test('siralaKisiler(yildiz): yıldız azalan, yıldızsızlar sunucu sırasında', () => {
  assert.deepEqual(ids(siralaKisiler(SIRA_KISILER, 'yildiz')), ['3', '4', '1', '2', '5'])
})

test('siralaKisiler: bilinmeyen ölçüt (ör. eski localStorage değeri) → durum sıralaması', () => {
  assert.deepEqual(ids(siralaKisiler(SIRA_KISILER, 'yok')), ids(siralaKisiler(SIRA_KISILER)))
  assert.deepEqual(SIRALAMALAR.map((s) => s.deger), ['durum', 'sure', 'yalniz', 'yildiz'])
})

test('siralaKisiler(sure): süre sırası değişmedikçe satır yer değiştirmez (sakin hareket)', () => {
  const t0 = [{ id: 'a', min: 10.0 }, { id: 'b', min: 9.5 }, { id: 'c', min: 9.5 }]
  const t1 = [{ id: 'a', min: 10.5 }, { id: 'b', min: 10.0 }, { id: 'c', min: 9.5 }] // a ve b konuşuyor, sıra aynı
  assert.deepEqual(ids(siralaKisiler(t0, 'sure')), ['a', 'b', 'c'])
  assert.deepEqual(ids(siralaKisiler(t1, 'sure')), ['a', 'b', 'c'])
})

test('veriCanli: sunucu bağlı ve alıcı taze → canlı; alıcı kopuk (receiverAge > 5) ya da sunucu kopuk → soluk', () => {
  assert.equal(veriCanli({ receiverAge: 0.4 }, true), true)
  assert.equal(veriCanli({ receiverAge: 12 }, true), false)
  assert.equal(veriCanli({ receiverAge: null }, true), false)
  assert.equal(veriCanli({ receiverAge: 0.4 }, false), false)
})
