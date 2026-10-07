// Kurulum ekranı: çift durumu, yön farkı, seyrek veri, sabit sıralama.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ciftDurumu, yonFarki, ciftSatirlari, ciftSayisi, dbmYazisi, perspektifKisileri, YON_FARK_DB } from './sinyal.js'
import { kisaAd } from './ad.js'

test('ciftDurumu: dört durum mevcut alanlardan türetilir', () => {
  assert.equal(ciftDurumu({ above: true, together: true }).tur, 'birlikte')
  assert.equal(ciftDurumu({ above: true, together: false }).etiket, 'başlıyor…')
  assert.equal(ciftDurumu({ above: false, together: true }).etiket, 'bitiyor…')
  assert.equal(ciftDurumu({ above: false, together: false }).tur, 'alti')
})

test('yonFarki: iki yön arası mutlak fark; bir yön yoksa null', () => {
  assert.equal(yonFarki({ ab: -46, ba: -58.5 }), 12.5)
  assert.equal(yonFarki({ ab: null, ba: -50 }), null)
})

const PEOPLE = [
  { id: '10', name: 'Ayşe', role: 'investor', color: '#2f6fc0' },
  { id: '3', name: 'Cem', role: 'founder', color: '#c25022' },
  { id: '4', name: 'Deniz', role: 'guest', color: '#6a5cd0' },
]

test('ciftSatirlari: kişiler eşlenir, bilinmeyen kart yer tutucu; sıra kart no ile sabit', () => {
  const s = [
    { a: '10', b: '3', ab: -50, ba: -50 - YON_FARK_DB, value: -54, n: 12, above: true, together: true },
    { a: '4', b: '3', ab: -70, ba: -71, value: -70.5, n: 3, above: false, together: false },
    { a: '101', b: '4', ab: null, ba: -80, value: -80, n: 9, above: false, together: false },
  ]
  const l = ciftSatirlari(s, PEOPLE)
  assert.deepEqual(l.map((r) => r.anahtar), ['3-4', '3-10', '4-101'])
  const r = l.find((x) => x.anahtar === '3-10')
  assert.equal(r.a.name, 'Cem'); assert.equal(r.b.name, 'Ayşe')
  // sinyal a=10,b=3 geldi; satırda 3 solda → yönler de çevrilir
  assert.equal(r.ab, -50 - YON_FARK_DB, 'ab = 3\'ün 10\'u duyduğu (sinyaldeki ba)')
  assert.equal(r.ba, -50)
  assert.equal(r.yonFarkli, true)
  assert.equal(l[0].seyrek, true, 'n=3 seyrek')
  assert.equal(l[2].a.name, 'Deniz'); assert.equal(l[2].b.name, 'Kart 101')
  assert.equal(l[2].ab, -80); assert.equal(l[2].ba, null)
  assert.equal(l[2].yonFarki, null)
  // aynı veri farklı sırada gelse de tablo sırası aynı (zıplamaz)
  assert.deepEqual(ciftSatirlari([...s].reverse(), PEOPLE).map((x) => x.anahtar), ['3-4', '3-10', '4-101'])
})

test('dbmYazisi', () => {
  assert.equal(dbmYazisi(null), '—')
  assert.equal(dbmYazisi(-46), '-46.0')
  assert.equal(dbmYazisi(-71.26), '-71.3')
})

const SIG = [
  { a: '10', b: '3', ab: -50, ba: -52, value: -51, n: 12, above: true, together: true },
  { a: '4', b: '3', ab: -70, ba: -71, value: -70.5, n: 9, above: false, together: false },
  { a: '101', b: '4', ab: null, ba: -80, value: -80, n: 9, above: false, together: false },
]

test('perspektif: ciftSatirlari kişiye göre süzer', () => {
  assert.deepEqual(ciftSatirlari(SIG, PEOPLE, '3').map((r) => r.anahtar), ['3-4', '3-10'])
  assert.deepEqual(ciftSatirlari(SIG, PEOPLE, '10').map((r) => r.anahtar), ['3-10'])
  assert.equal(ciftSatirlari(SIG, PEOPLE, null).length, 3)
  assert.equal(ciftSayisi(SIG, '3'), 2)
  assert.equal(ciftSayisi(SIG), 3)
})

test('perspektifKisileri: çifti duyulanlar kart no sırasıyla; seçili kişi çiftsiz kalsa da listede', () => {
  assert.deepEqual(perspektifKisileri(SIG, PEOPLE).map((k) => k.id), ['3', '4', '10', '101'])
  assert.ok(perspektifKisileri([], PEOPLE, '10').some((k) => k.id === '10'))
})

test('kısa ad (Kurulum rozet/seçici): girişimcide kurum, diğerlerinde ad', () => {
  assert.equal(kisaAd({ role: 'founder', name: 'Serkan', org: 'Oyun Evreni' }), 'Oyun Evreni')
  assert.equal(kisaAd({ role: 'founder', name: 'Serkan', org: '' }), 'Serkan')
  assert.equal(kisaAd({ role: 'investor', name: 'Ayşe', org: 'Atlas' }), 'Ayşe')
})
