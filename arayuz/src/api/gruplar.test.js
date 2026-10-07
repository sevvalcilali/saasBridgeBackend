// Canlı gruplar ("adacıklar"): şu an yan yana olanlar tek dairede. Gruplar `live` çiftlerinden çıkar
// (A–B ve B–C birlikte → A, B, C tek grup); daireler ekranda yer değiştirmez.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canliGruplar, bostakiler, yerlestir, yalnizMi, sureRengi, SURE_RENKLERI, siluetPozu, siluetGecikmesi, grupSiralari } from './gruplar.js'

const k = (id, role, ek = {}) => ({ id, role, name: `K${id}`, org: '', color: '#111', status: 'idle', live: 0, tier: 0, idleSinceS: 0, ...ek })
const KISILER = [
  k('2', 'investor', { status: 'talking', live: 4.2 }),
  k('3', 'founder', { status: 'talking', live: 4.2 }),
  k('4', 'guest', { status: 'talking', live: 1.5 }),
  k('5', 'investor', { status: 'talking', live: 2 }),
  k('6', 'investor', { status: 'talking', live: 2 }),
  k('7', 'founder'),
  k('8', 'investor', { tier: 4, idleSinceS: 400 }),
  k('9', 'guest', { status: 'away' }),
]
const LIVE = [{ a: '2', b: '3' }, { a: '3', b: '4' }, { a: '5', b: '6' }, { a: '6', b: '101' }]

test('zincirlenen çiftler tek grup; üyeler yatırımcı → girişimci → misafir sırasında', () => {
  const gruplar = canliGruplar(KISILER, LIVE)
  assert.deepEqual(gruplar.map((g) => g.uyeler.map((u) => u.id)), [['2', '3', '4'], ['5', '6']])
  assert.deepEqual(gruplar.map((g) => g.anahtar), ['2-3-4', '5-6'])
})

test('karma grup: içinde hem yatırımcı hem girişimci var; süre en uzun görüşen üyenin', () => {
  const [karma, yatirimcilar] = canliGruplar(KISILER, LIVE)
  assert.equal(karma.karma, true)
  assert.equal(karma.dakika, 4.2)
  assert.equal(yatirimcilar.karma, false)
})

test('kişisi olmayan kart (101 dinleyici) gruba girmez, tek başına grup oluşmaz', () => {
  assert.ok(canliGruplar(KISILER, LIVE).every((g) => g.uyeler.length >= 2))
  assert.deepEqual(canliGruplar(KISILER, [{ a: '7', b: '101' }]), [])
})

test('boştakiler: önce yalnız kalan önemli yatırımcı, sonra en uzun boşta; görünmeyenler ayrı', () => {
  const { bosta, gorunmeyen } = bostakiler(KISILER, canliGruplar(KISILER, LIVE))
  assert.deepEqual(bosta.map((x) => x.id), ['8', '7'])
  assert.deepEqual(gorunmeyen.map((x) => x.id), ['9'])
  assert.equal(yalnizMi(KISILER[6]), true)
  assert.equal(yalnizMi({ ...KISILER[6], tier: 2 }), false)
})

test('daireler yerinde kalır: grup büyüyünce ya da küçülünce aynı yerde, yeni grup boş yere', () => {
  let { yerler, atama } = yerlestir([], canliGruplar(KISILER, LIVE))
  assert.deepEqual([...atama], [['2-3-4', 0], ['5-6', 1]])

  // 2-3-4 dağıldı (3 gitti), 5-6'ya 7 katıldı, 8 ile 9 yeni grup
  const sonra = [{ a: '2', b: '4' }, { a: '5', b: '6' }, { a: '6', b: '7' }, { a: '8', b: '9' }]
  const kisiler = KISILER.map((x) => ({ ...x, status: 'talking' }))
  ;({ yerler, atama } = yerlestir(yerler, canliGruplar(kisiler, sonra)))
  assert.deepEqual(Object.fromEntries(atama), { '2-4': 0, '5-6-7': 1, '8-9': 2 })

  // Ortadaki grup biterse sağdaki kaymaz; boşalan yer bir sonraki yeni gruba verilir
  ;({ yerler, atama } = yerlestir(yerler, canliGruplar(kisiler, [{ a: '2', b: '4' }, { a: '8', b: '9' }])))
  assert.deepEqual(Object.fromEntries(atama), { '2-4': 0, '8-9': 2 })
  ;({ yerler, atama } = yerlestir(yerler, canliGruplar(kisiler, [{ a: '2', b: '4' }, { a: '8', b: '9' }, { a: '3', b: '7' }])))
  assert.deepEqual(Object.fromEntries(atama), { '2-4': 0, '3-7': 1, '8-9': 2 })
})

test('sondaki boş yerler atılır (daireler bitince alan küçülür)', () => {
  const { yerler } = yerlestir([new Set(['2', '3']), new Set(['5', '6'])], canliGruplar(KISILER, [{ a: '2', b: '3' }]))
  assert.equal(yerler.length, 1)
})

test('sureRengi: 1–5 dk gri, 5–10 sarı, 10–20 turuncu, 20+ kırmızı (Şevval kararı 2026-10-06); sınırda üst renk', () => {
  const ad = (dk) => sureRengi(dk).ad
  assert.deepEqual([ad(1), ad(4.99), ad(5), ad(9.9), ad(10), ad(19.9), ad(20), ad(95)],
    ['gri', 'gri', 'mavi', 'mavi', 'turuncu', 'turuncu', 'kirmizi', 'kirmizi'])
  assert.equal(sureRengi(12).degisken, 'var(--sure-10)')
  assert.deepEqual(SURE_RENKLERI.map((r) => r.etiket), ['1–5 dk', '5–10 dk', '10–20 dk', '20 dk+'])
})

test('siluetPozu: kişiye göre sabit (her tikte aynı duruş), üç duruştan biri', () => {
  assert.equal(siluetPozu('14'), siluetPozu('14'))
  assert.deepEqual(new Set(['1', '2', '3', '4', '5', '6'].map(siluetPozu)), new Set([0, 1, 2]))
})

test('siluetGecikmesi: kişiye göre sabit, figürler aynı anda sallanmasın diye farklı (0 ile −6 sn arası)', () => {
  const g = ['2', '3', '4', '5', '6', '7', '8'].map(siluetGecikmesi)
  assert.equal(siluetGecikmesi('14'), siluetGecikmesi('14'))
  assert.ok(g.every((x) => x <= 0 && x > -6))
  assert.ok(new Set(g).size >= 5)
})

// Salon görünümü (Şevval 2026-10-06): grup yan yana sıra değil küme; arka sıra + ön sıra.
test('grupSiralari: 2 kişi yan yana; 3 üçgen; 4 ikişer; 5 arkada 2 önde 3; 6 üçer', () => {
  assert.deepEqual([2, 3, 4, 5, 6].map((n) => grupSiralari(n)), [[0, 2], [1, 2], [2, 2], [2, 3], [3, 3]])
})

test('grupSiralari: üyeleri sıralara böler, arka sıra listenin başından', () => {
  const uyeler = ['a', 'b', 'c', 'd', 'e']
  assert.deepEqual(grupSiralari(uyeler.length, uyeler), [['a', 'b'], ['c', 'd', 'e']])
})
