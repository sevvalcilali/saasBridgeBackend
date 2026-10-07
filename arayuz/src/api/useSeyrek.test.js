import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seyrekDeger } from './useSeyrek.js'

test('etkin değilken her zaman güncel değer', () => {
  const a = seyrekDeger(null, 1, 0, 2000, false)
  assert.equal(seyrekDeger(a, 2, 100, 2000, false).deger, 2)
})

test('etkinken aralık dolmadan eski değer (aynı nesne), dolunca yeni', () => {
  const a = seyrekDeger(null, 'ilk', 0, 2000, true)
  assert.equal(a.deger, 'ilk')
  const b = seyrekDeger(a, 'ikinci', 1500, 2000, true)
  assert.equal(b, a)
  const c = seyrekDeger(b, 'üçüncü', 2000, 2000, true)
  assert.equal(c.deger, 'üçüncü')
})

test('kalabalık biterse beklemeden güncellenir', () => {
  const a = seyrekDeger(null, 1, 0, 2000, true)
  assert.equal(seyrekDeger(a, 2, 10, 2000, false).deger, 2)
})

test('henüz değer yokken (veri gelmeden) bekletmez — ilk gerçek değer hemen döner', () => {
  const a = seyrekDeger(null, null, 0, 2000, false)
  assert.equal(seyrekDeger(a, { signals: [] }, 10, 2000, true).deger.signals.length, 0)
})

test('seyrekDeger zorla: süre dolmadan da hemen yenilenir ("Şimdi güncelle")', () => {
  const ilk = seyrekDeger(null, { v: 1 }, 1000, 60000, true)
  const bekle = seyrekDeger(ilk, { v: 2 }, 5000, 60000, true)
  const zorla = seyrekDeger(bekle, { v: 3 }, 6000, 60000, true, true)
  assert.equal(bekle.deger.v, 1)
  assert.deepEqual([zorla.deger.v, zorla.zaman], [3, 6000])
})
