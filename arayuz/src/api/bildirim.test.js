import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bildirimleriSuz, onemSayilari, gorunenBildirimler, GORUNEN_VARSAYILAN, ONEM_SUZGECLERI } from './bildirim.js'

const B = Array.from({ length: 25 }, (_, i) => ({
  anahtar: `b${i}`, t: 1000 - i, severity: i % 5 === 0 ? 'serious' : i % 3 === 0 ? 'warn' : 'deal',
}))

test('önem süzgeci: tumu hepsini bırakır, diğerleri yalnız o önemi', () => {
  assert.equal(bildirimleriSuz(B).length, 25)
  assert.ok(bildirimleriSuz(B, 'serious').every((b) => b.severity === 'serious'))
  assert.equal(bildirimleriSuz(B, 'serious').length, 5)
})

test('önem sayıları: düğme rozetleri için', () => {
  const s = onemSayilari(B)
  assert.equal(s.tumu, 25)
  assert.equal(s.serious + s.warn + s.deal, 25)
  assert.equal(s.serious, 5)
})

test('görünen: varsayılan en yeni 20 + kalan; hepsi → tamamı; süzgeçle birlikte', () => {
  const v = gorunenBildirimler(B)
  assert.equal(v.liste.length, GORUNEN_VARSAYILAN)
  assert.equal(v.kalan, 5)
  assert.equal(v.liste[0].anahtar, 'b0', 'en yeni üstte (sıra bozulmaz)')
  const h = gorunenBildirimler(B, { hepsi: true })
  assert.equal(h.liste.length, 25); assert.equal(h.kalan, 0)
  const c = gorunenBildirimler(B, { onem: 'serious' })
  assert.equal(c.liste.length, 5); assert.equal(c.kalan, 0); assert.equal(c.toplam, 5)
})

test('ciddi bildirim 20 olumlu bildirimin altına itilse de "Ciddi" süzgeciyle hemen görünür', () => {
  const akis = [...Array.from({ length: 22 }, (_, i) => ({ anahtar: `d${i}`, severity: 'deal' })), { anahtar: 'kayip', severity: 'serious', kind: 'lost' }]
  assert.ok(!gorunenBildirimler(akis).liste.some((b) => b.anahtar === 'kayip'), 'varsayılan 20 içinde yok')
  assert.deepEqual(gorunenBildirimler(akis, { onem: 'serious' }).liste.map((b) => b.anahtar), ['kayip'])
  assert.deepEqual(ONEM_SUZGECLERI.map((s) => s.deger), ['tumu', 'serious', 'warn', 'deal', 'kural'])
})

test('kural uyarıları kendi süzgecinde sayılır ve süzülür', () => {
  const alerts = [{ severity: 'kural' }, { severity: 'deal' }, { severity: 'kural' }]
  assert.equal(onemSayilari(alerts).kural, 2)
  assert.equal(bildirimleriSuz(alerts, 'kural').length, 2)
  assert.ok(ONEM_SUZGECLERI.some((s) => s.deger === 'kural' && s.etiket === 'Kural'))
})
