// Ego görünümü: seçili kişi ortada, gün boyu görüştüğü herkes çevresinde; çizgi kalınlığı süre.
// Geçmiş çizgileri yalnız istenince ve yalnız o kişi için çizilir: yumak oluşmaz.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { egoYerlesimi } from './ego.js'

const k = (id, role) => ({ id, role, name: `K${id}`, color: '#111' })
const PEOPLE = [k('2', 'investor'), k('3', 'founder'), k('4', 'guest'), k('5', 'founder'), k('6', 'investor')]
const EDGES = [
  { a: '2', b: '3', min: 12 }, { a: '4', b: '2', min: 3 }, { a: '2', b: '5', min: 6 },
  { a: '3', b: '5', min: 9 }, // seçili kişiyi içermiyor
  { a: '2', b: '101', min: 4 }, // kişisi yok (dinleyici)
]
const W = 1000, H = 640

test('eşler süreye göre; ilki tepede, merkez ortada; seçili kişiyi içermeyen ve kişisiz kenar yok', () => {
  const { merkez, esler, fazla } = egoYerlesimi('2', PEOPLE, EDGES, [], { w: W, h: H })
  assert.deepEqual([merkez.x, merkez.y], [W / 2, H / 2])
  assert.deepEqual(esler.map((e) => e.kisi.id), ['3', '5', '4'])
  assert.ok(Math.abs(esler[0].x - W / 2) < 1 && esler[0].y < H / 2, 'en uzun görüşülen tepede')
  assert.equal(fazla, 0)
})

test('şu an birlikte olan eş ve yatırımcı–girişimci eşi işaretli; kalınlık süreyle orantılı', () => {
  const { esler } = egoYerlesimi('2', PEOPLE, EDGES, [{ a: '5', b: '2' }], { w: W, h: H })
  const es = Object.fromEntries(esler.map((e) => [e.kisi.id, e]))
  assert.equal(es['5'].simdi, true)
  assert.equal(es['3'].simdi, false)
  assert.deepEqual([es['3'].karma, es['4'].karma], [true, false])
  assert.equal(es['3'].kalinlik, 12)
  assert.ok(es['4'].kalinlik < es['5'].kalinlik && es['5'].kalinlik < es['3'].kalinlik)
})

test('çok eşte en uzun N gösterilir, kalanı sayı olarak', () => {
  const r = egoYerlesimi('2', PEOPLE, EDGES, [], { w: W, h: H, enCok: 2 })
  assert.deepEqual([r.esler.length, r.fazla], [2, 1])
})

test('etiket düğümün dışına yazılır: tepedeki üste, sağdaki sağa, soldaki sola, alttaki alta', () => {
  const people = [k('1', 'investor'), ...Array.from({ length: 8 }, (_, i) => k(String(i + 10), 'founder'))]
  const edges = people.slice(1).map((p, i) => ({ a: '1', b: p.id, min: 20 - i }))
  const { esler } = egoYerlesimi('1', people, edges, [], { w: W, h: H })
  assert.deepEqual(esler.map((e) => e.yon), ['ust', 'sag', 'sag', 'sag', 'alt', 'sol', 'sol', 'sol'])
})
