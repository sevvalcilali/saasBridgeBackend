// Sunucu, kişilere brief §10'daki KOYU paletten renk atar. Arayüzde bu renkler
// temanın kişi rengi token'larına eşlenir; böylece "renk kişiyi takip eder"
// kuralı bozulmadan her iki temada da doğrulanmış tonla görünür.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sunucuRengi, PALET, KISI_RENK_ADLARI } from './renkler.js'
import { temaTokenlari } from '../theme/tokenOku.js'

test('brief koyu paleti tema token\'larına birebir eşlenir', () => {
  assert.equal(sunucuRengi('#3987e5'), 'var(--kisi-mavi)')
  assert.equal(sunucuRengi('#d95926'), PALET.turuncu)
  assert.equal(sunucuRengi('#c98500'), PALET.hardal)
  assert.equal(sunucuRengi('#d55181'), PALET.pembe)
  assert.equal(sunucuRengi('#9085e9'), PALET.mor)
  assert.equal(sunucuRengi('#e66767'), PALET.mercan)
  assert.equal(sunucuRengi('#898781'), PALET.gri)
})

test('sunucudan #199e70 gelirse petrole eşlenir (yeşil "birlikte"ye ayrılmış)', () => {
  assert.equal(sunucuRengi('#199e70'), PALET.petrol)
})

test('büyük harfli hex de eşlenir; renk yoksa gri', () => {
  assert.equal(sunucuRengi('#3987E5'), PALET.mavi)
  assert.equal(sunucuRengi(null), PALET.gri)
})

test('bilinmeyen renk olduğu gibi geçer (kişiye özel renk)', () => {
  assert.equal(sunucuRengi('#123456'), '#123456')
})

test('her kişi rengi token\'ı iki temada da tanımlı (kayma kilidi)', () => {
  const { acik, koyu } = temaTokenlari()
  for (const ad of KISI_RENK_ADLARI) {
    assert.ok(acik[`kisi-${ad}`], `açık: --kisi-${ad} eksik`)
    assert.ok(koyu[`kisi-${ad}`] && koyu[`kisi-${ad}`] !== acik[`kisi-${ad}`], `koyu: --kisi-${ad} ayrı adımlanmamış`)
  }
})
