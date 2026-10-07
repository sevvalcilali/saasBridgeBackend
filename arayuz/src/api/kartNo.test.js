import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kisiKartiMi, kartNoCoz } from './kartNo.js'

test('kişi kartı 1–99; 100+ dinleyici, 0 ve metin değil', () => {
  for (const v of ['1', '14', '99', 7]) assert.equal(kisiKartiMi(v), true, String(v))
  for (const v of ['0', '100', '105', 'abc', '', null, '1.5']) assert.equal(kisiKartiMi(v), false, String(v))
})

test('elle yazılan numara: baştaki sıfır atılır, aralık dışı reddedilir', () => {
  assert.equal(kartNoCoz('007'), '7')
  assert.equal(kartNoCoz(' 14 '), '14')
  assert.equal(kartNoCoz('105'), null)
  assert.equal(kartNoCoz('0'), null)
  assert.equal(kartNoCoz('00'), null)
  assert.equal(kartNoCoz(''), null)
  assert.equal(kartNoCoz('1000'), null)
})
