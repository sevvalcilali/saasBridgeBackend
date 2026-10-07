// Eşik: sınırlar, gecikmeli tek gönderim, bağlam sayısı.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { esikSinirla, gecikmeliGonderici, esikUstuCiftSayisi, ESIK_ALT, ESIK_UST } from './esik.js'

test('esikSinirla: -95…-35 aralığına ve tam sayıya', () => {
  assert.equal(esikSinirla(-120), ESIK_ALT)
  assert.equal(esikSinirla(-10), ESIK_UST)
  assert.equal(esikSinirla(-71.6), -72)
  assert.equal(esikSinirla('-70'), -70)
})

test('gecikmeliGonderici: art arda değerlerden yalnız sonuncusu, 250 ms sonra gider', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const giden = []
  const sonuclar = []
  const g = gecikmeliGonderici((v) => { giden.push(v); return Promise.resolve() }, (s) => sonuclar.push(s))
  g.planla(-70); mock.timers.tick(100)
  g.planla(-68); mock.timers.tick(100)
  g.planla(-66); mock.timers.tick(249)
  assert.deepEqual(giden, [], 'bırakılmadan önce istek yok')
  mock.timers.tick(1)
  assert.deepEqual(giden, [-66], 'tek istek, son değer')
  mock.timers.reset()
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(sonuclar, [{ deger: -66, hata: null }])
})

test('gecikmeliGonderici: hata bildirilir; iptal bekleyeni durdurur', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const sonuclar = []
  const g = gecikmeliGonderici(() => Promise.reject(new Error('503')), (s) => sonuclar.push(s))
  g.planla(-60); mock.timers.tick(250)
  const giden = []
  const g2 = gecikmeliGonderici((v) => { giden.push(v); return Promise.resolve() }, () => {})
  g2.planla(-50); g2.iptal(); mock.timers.tick(500)
  mock.timers.reset()
  await new Promise((r) => setImmediate(r))
  assert.equal(sonuclar.length, 1)
  assert.equal(sonuclar[0].deger, -60)
  assert.ok(sonuclar[0].hata)
  assert.deepEqual(giden, [], 'iptal edilen gitmez')
})

test('esikUstuCiftSayisi: value ≥ eşik olanlar', () => {
  const s = [{ value: -50 }, { value: -72 }, { value: -80 }, { value: null }]
  assert.equal(esikUstuCiftSayisi(s, -72), 2)
  assert.equal(esikUstuCiftSayisi(s, -45), 0)
})

test('gecikmeliGonderici: sunucu reddi (false döner) da hatadır', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const sonuclar = []
  const g = gecikmeliGonderici(() => Promise.resolve(false), (s) => sonuclar.push(s))
  g.planla(-40); mock.timers.tick(250)
  mock.timers.reset()
  await new Promise((r) => setImmediate(r))
  assert.ok(sonuclar[0].hata, 'false → hata')
})
