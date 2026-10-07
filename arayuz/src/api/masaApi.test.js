// masaApi — karşılama masası uçlarıyla konuşan TEK yer (§9). Gerçek mock'a
// karşı uçtan uca: gerçek sunucu gelince yalnız adres değişir.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MasaApi } from './masaApi.js'

const MOCK = fileURLToPath(new URL('../../mock-server/mock.js', import.meta.url))
const acik = []
function baslat(args) { const c = spawn(process.execPath, [MOCK, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }); acik.push(c); return c }
async function hazir(port) {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${port}/state`)).ok) return } catch {} await new Promise((c) => setTimeout(c, 50)) }
  throw new Error('açılmadı')
}
after(() => { for (const c of acik) c.kill() })

const api = new MasaApi({ adres: 'http://localhost:8114' })

test('kişi ekle/getir/ata/kart/iade tam akışı', async () => {
  baslat(['--port=8114', '--kisi=25', '--tohum=9'])
  await hazir(8114)

  assert.equal((await api.kisileriGetir()).length, 25)

  const yeni = await api.kisiEkle({ ad: 'Ada Lovelace', rol: 'founder', kurum: 'Analitik A.Ş.' })
  assert.equal(yeni.atananKart, null)
  assert.equal((await api.kisileriGetir()).length, 26)

  await api.ata(yeni.kisiId, '77')
  const atanmis = (await api.kisileriGetir()).find((k) => k.kisiId === yeni.kisiId)
  assert.equal(atanmis.atananKart, '77')

  const kartlar = await api.kartlariGetir()
  assert.ok(kartlar.some((k) => k.kart === '77' && k.atanan === yeni.kisiId))

  await api.iade('77')
  assert.equal((await api.kisileriGetir()).find((k) => k.kisiId === yeni.kisiId).atananKart, null)
})

test('kart numarayla verilir: "yaklaştır" ucu ve istemci yöntemi yok (Şevval kararı 07.10.2026)', async () => {
  assert.equal(typeof api.yaklastir, 'undefined')
  const yanit = await fetch(`http://localhost:8114/api/yaklastir`, { method: 'POST', body: JSON.stringify({ kart: '88' }) })
  assert.equal(yanit.status, 404)
})

test('kisiGuncelle: bilgi değişir; kisiSil: kayıttan düşer', async () => {
  const k = (await api.kisileriGetir()).find((x) => x.ad === 'Ada Lovelace')
  const g = await api.kisiGuncelle(k.kisiId, { kurum: 'Yeni Kurum' })
  assert.equal(g.kurum, 'Yeni Kurum')

  await api.kisiSil(k.kisiId)
  assert.ok(!(await api.kisileriGetir()).some((x) => x.kisiId === k.kisiId))
})

test('hata: olmayan kişi güncellemesi reddedilir', async () => {
  await assert.rejects(() => api.kisiGuncelle('yok-boyle-kisi', { kurum: 'X' }))
})

test('iceAktar: CSV metni gider, özet döner; iade ayrildi seçeneği', async () => {
  const sonuc = await api.iceAktar('ad;soyad;rol;kurum;yıldız\nNur;Işık;Yatırımcı;Liman;3\nX;Y;bilinmez;;\n')
  assert.equal(sonuc.eklenen, 1)
  assert.equal(sonuc.atlanan.length, 1)
  const nur = (await api.kisileriGetir()).find((k) => k.ad === 'Nur Işık')
  assert.equal(nur.atananKart, null)
  assert.equal(nur.ayrildi, false)

  await api.ata(nur.kisiId, '61')
  await api.iade('61', { ayrildi: false })          // geri al
  assert.equal((await api.kisileriGetir()).find((k) => k.kisiId === nur.kisiId).ayrildi, false)
  await api.ata(nur.kisiId, '61')
  await api.iade('61')                               // kart iadesi
  assert.equal((await api.kisileriGetir()).find((k) => k.kisiId === nur.kisiId).ayrildi, true)
})

test('renk: masaya gelen kişi rengi panodakiyle aynı tema paletinde; yeşil yok', async () => {
  const { PALET } = await import('./renkler.js')
  const palet = new Set(Object.values(PALET))
  const kisiler = await api.kisileriGetir()
  assert.ok(kisiler.every((k) => palet.has(k.renk)), 'tüm renkler tema paletinden')
  assert.ok(!kisiler.some((k) => k.renk.toLowerCase() === '#199e70'), 'yeşil (birlikte rengi) kişi rengi olamaz')
  const yeni = await api.kisiEkle({ ad: 'Renk Deneme', rol: 'guest' })
  assert.ok(palet.has(yeni.renk))
  assert.ok(palet.has((await api.kisiGuncelle(yeni.kisiId, { kurum: 'X' })).renk))
})

test('RaporApi: kayıt defteri (renk uyarlanmış) + görüşme kayıtları', async () => {
  const { RaporApi } = await import('./raporApi.js')
  const { PALET } = await import('./renkler.js')
  const r = new RaporApi({ adres: 'http://localhost:8114' })
  const kisiler = await r.kisileriGetir()
  assert.ok(kisiler.length > 0 && kisiler.every((k) => Object.values(PALET).includes(k.renk)))
  const o = await r.oturumlariGetir()
  assert.ok(Array.isArray(o))
})
