// Kalibrasyon: ortadaki eşik önerisi, uyarılar, geri sayım.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onerilenEsik, kalanSaniye, MIN_FARK_DB } from './kalibrasyon.js'

test('onerilenEsik: ikisinin ortası, tam sayı ve kaydırıcı aralığında', () => {
  assert.deepEqual(onerilenEsik(-52, -80), { deger: -66, fark: 28, uyari: null })
  assert.equal(onerilenEsik(-52.6, -79.1).deger, -66)
  assert.equal(onerilenEsik(-30, -40).deger, -35, 'üst sınıra kırpılır')
})

test('onerilenEsik: fark küçükse uyarı, ters ölçümde öneri yok, eksikse null', () => {
  assert.equal(onerilenEsik(-60, -60 - (MIN_FARK_DB - 1)).uyari, 'kucuk')
  assert.deepEqual(onerilenEsik(-80, -55), { deger: null, fark: -25, uyari: 'ters' })
  assert.equal(onerilenEsik(null, -80), null)
})

test('kalanSaniye: 10 sn geri sayım', () => {
  assert.equal(kalanSaniye(0, 0), 10)
  assert.equal(kalanSaniye(0, 100), 10)
  assert.equal(kalanSaniye(0, 9001), 1)
  assert.equal(kalanSaniye(0, 10000), 0)
  assert.equal(kalanSaniye(0, 15000), 0)
})
