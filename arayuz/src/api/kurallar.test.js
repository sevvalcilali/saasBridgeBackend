// Uyarı kuralları (Şevval isteği 2026-10-06): masada kurulur, panoda açılır uyarı. Saf yardımcılar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GRUPLAR, grupSecimi, secimMetni, kuralCumlesi, acilacakUyarilar, ILK_ACILISTA_SN } from './kurallar.js'

const KISILER = [
  { kisiId: 'k1', ad: 'Ayşe Demir', rol: 'investor', kurum: 'Atlas' },
  { kisiId: 'k2', ad: 'Cem Erdem', rol: 'founder', kurum: 'Nova Robotik' },
]

test('grup seçenekleri sunucunun seçim biçimine çevrilir', () => {
  assert.deepEqual(GRUPLAR.map((g) => g.deger), ['investor', 'investor4', 'investor3', 'founder', 'guest', 'herkes'])
  assert.deepEqual(grupSecimi('investor4'), { rol: 'investor', enAzYildiz: 4 })
  assert.deepEqual(grupSecimi('founder'), { rol: 'founder', enAzYildiz: 0 })
})

test('secimMetni: belirli kişiler adlarıyla (girişimcide kurum), grup adıyla; bilinmeyen kimlik kendisi', () => {
  assert.equal(secimMetni({ kisiler: ['k1', 'k2'] }, KISILER), 'Ayşe Demir, Nova Robotik')
  assert.equal(secimMetni({ kisiler: ['k9'] }, KISILER), 'k9')
  assert.equal(secimMetni({ rol: 'investor', enAzYildiz: 4 }, KISILER), '★4+ yatırımcılar')
  assert.equal(secimMetni({ rol: 'herkes', enAzYildiz: 0 }, KISILER), 'herkes')
})

test('kuralCumlesi: okunur tek cümle', () => {
  const yanYana = { kim: { kisiler: ['k1'] }, kiminle: { kisiler: ['k2'] }, dakika: 0 }
  assert.equal(kuralCumlesi(yanYana, KISILER), 'Ayşe Demir ile Nova Robotik yan yana gelince')
  assert.equal(kuralCumlesi({ ...yanYana, kim: { rol: 'investor', enAzYildiz: 4 }, kiminle: { rol: 'founder', enAzYildiz: 0 }, dakika: 5 }, KISILER),
    '★4+ yatırımcılar ile girişimciler 5 dakikadan uzun birlikte kalınca')
})

test('acilacakUyarilar: yalnız kural uyarıları, görülmemişler, eskiden yeniye; ilk açılışta yalnız son 2 dk', () => {
  const simdi = 10_000
  const alerts = [
    { anahtar: 'a', kind: 'kural', t: simdi - 30 },
    { anahtar: 'b', kind: 'deal', t: simdi - 10 },
    { anahtar: 'c', kind: 'kural', t: simdi - ILK_ACILISTA_SN - 5 },
    { anahtar: 'd', kind: 'kural', t: simdi - 5 },
  ] // sunucudan en yeni üstte gelir (client.js sıralar); burada sıra önemsiz
  const gorulen = new Set(['d'])
  assert.deepEqual(acilacakUyarilar(alerts, gorulen, simdi, { ilk: true }).map((b) => b.anahtar), ['a'])
  assert.deepEqual(acilacakUyarilar(alerts, gorulen, simdi, { ilk: false }).map((b) => b.anahtar), ['c', 'a'])
})
