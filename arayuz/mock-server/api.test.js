// §9 mock uçları — kişi kayıt defteri + atama (Faz 2.1). Kişi ≠ kart:
// katılımcı kayıtlıdır; karta atanınca /state'te görünür, iade edilince düşer
// ama kayıttan silinmez (süreleri raporda kalır).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const MOCK = fileURLToPath(new URL('./mock.js', import.meta.url))
const acik = []
function baslat(args) { const c = spawn(process.execPath, [MOCK, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }); acik.push(c); return c }
async function hazir(port) {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${port}/state`)).ok) return } catch {} await new Promise((c) => setTimeout(c, 50)) }
  throw new Error('açılmadı')
}
const getj = async (u) => (await fetch(u)).json()
const post = (u, body) => fetch(u, { method: 'POST', body: JSON.stringify(body) })
after(() => { for (const c of acik) c.kill() })

const B = 'http://localhost:8112'

test('GET /api/people: başlangıç kadrosu, her katılımcı bir karta atanmış', async () => {
  baslat(['--port=8112', '--kisi=25', '--tohum=7'])
  await hazir(8112)
  const kisiler = await getj(`${B}/api/people`)
  assert.equal(kisiler.length, 25)
  for (const k of kisiler) {
    assert.deepEqual(Object.keys(k).sort(), ['ad', 'asama', 'atananKart', 'ayrildi', 'eposta', 'kisiId', 'kurum', 'not',
      'paylasim', 'renk', 'rol', 'sektor', 'tanitim', 'web', 'yildiz'])
    assert.ok(['investor', 'founder', 'guest'].includes(k.rol))
    assert.match(k.renk, /^#[0-9a-f]{6}$/i)
    assert.ok(k.atananKart, 'başlangıçta kart atanmış olmalı')
  }
})

test('POST /api/people: kartsız katılımcı — kayıtta var, /state\'te yok', async () => {
  const yanit = await post(`${B}/api/people`, { ad: 'Yeni Kişi', rol: 'founder', kurum: 'Test A.Ş.', yildiz: 0 })
  assert.equal(yanit.status, 200)
  const kisi = await yanit.json()
  assert.equal(kisi.ad, 'Yeni Kişi')
  assert.equal(kisi.atananKart, null)
  assert.ok(kisi.kisiId)
  assert.match(kisi.renk, /^#[0-9a-f]{6}$/i)

  assert.equal((await getj(`${B}/api/people`)).length, 26)
  const state = await getj(`${B}/state`)
  assert.ok(!state.people.some((p) => p.name === 'Yeni Kişi'), 'kartsız kişi /state\'te olmamalı')
})

test('POST /api/assign: karta atanınca /state\'te görünür', async () => {
  const yeni = (await getj(`${B}/api/people`)).find((k) => k.ad === 'Yeni Kişi')
  const r = await post(`${B}/api/assign`, { kisiId: yeni.kisiId, kart: '77' })
  assert.equal(r.status, 200)

  const kisiler = await getj(`${B}/api/people`)
  assert.equal(kisiler.find((k) => k.kisiId === yeni.kisiId).atananKart, '77')

  const state = await getj(`${B}/state`)
  const p = state.people.find((x) => x.id === '77')
  assert.ok(p, 'atanan kart /state\'te olmalı')
  assert.equal(p.name, 'Yeni Kişi')
  assert.equal(p.role, 'founder')
})

test('POST /api/unassign: iade → /state\'ten düşer, kayıtta kalır', async () => {
  const r = await post(`${B}/api/unassign`, { kart: '77' })
  assert.equal(r.status, 200)
  const state = await getj(`${B}/state`)
  assert.ok(!state.people.some((x) => x.id === '77'), 'iade edilen kart /state\'te olmamalı')
  const kisi = (await getj(`${B}/api/people`)).find((k) => k.ad === 'Yeni Kişi')
  assert.ok(kisi, 'katılımcı kayıtta kalmalı (silinmez)')
  assert.equal(kisi.atananKart, null)
})

test('POST /api/assign: dolu karta atama eskisini geri alır', async () => {
  const kisiler = await getj(`${B}/api/people`)
  const dolu = kisiler.find((k) => k.atananKart)             // atanmış biri
  const bosta = kisiler.find((k) => !k.atananKart)           // Yeni Kişi (kartsız)
  const kart = dolu.atananKart

  const r = await post(`${B}/api/assign`, { kisiId: bosta.kisiId, kart })
  assert.equal(r.status, 200)

  const sonra = await getj(`${B}/api/people`)
  assert.equal(sonra.find((k) => k.kisiId === dolu.kisiId).atananKart, null, 'eski sahip iade edilmeli')
  assert.equal(sonra.find((k) => k.kisiId === bosta.kisiId).atananKart, kart)
  const state = await getj(`${B}/state`)
  assert.equal(state.people.find((x) => x.id === kart).name, bosta.ad)
})

test('PATCH /api/people: bilgi güncellenir, renk değişmez', async () => {
  const k = (await getj(`${B}/api/people`)).find((x) => x.ad === 'Yeni Kişi')
  const eskiRenk = k.renk
  const r = await fetch(`${B}/api/people/${k.kisiId}`, { method: 'PATCH', body: JSON.stringify({ kurum: 'Değişti Ltd.', renk: '#000000' }) })
  assert.equal(r.status, 200)
  const g = (await getj(`${B}/api/people`)).find((x) => x.kisiId === k.kisiId)
  assert.equal(g.kurum, 'Değişti Ltd.')
  assert.equal(g.renk, eskiRenk, 'renk değişmemeli')
})

test('/state şeması Faz 1 ile bozulmadan uyumlu (25 kişi, alanlar aynı)', async () => {
  const state = await getj(`${B}/state`)
  // atama oynamalarından sonra da geçerli alan kümesi
  for (const p of state.people) {
    assert.deepEqual(Object.keys(p).sort(), [
      'color', 'id', 'idleSinceS', 'invMin', 'invPeers', 'live', 'min', 'name', 'org',
      'role', 'seenAgo', 'stars', 'status', 'tier', 'withName',
    ])
  }
})

test('POST /api/assign: olmayan kişi → 404 ve ok:false', async () => {
  const r = await post(`${B}/api/assign`, { kisiId: 'yok', kart: '50' })
  assert.equal(r.status, 404)
  assert.equal((await r.json()).ok, false)
})


test('profil (rapor 2. adım): eklenir, düzenlenir, CSV ile gelir; izin varsayılanı hayır', async () => {
  const yeni = await (await post(`${B}/api/people`, { ad: 'Can', rol: 'founder', sektor: 'Sağlık', asama: 'mvp', eposta: 'can@nova.com' })).json()
  assert.deepEqual([yeni.sektor, yeni.asama, yeni.eposta, yeni.paylasim], ['Sağlık', 'mvp', 'can@nova.com', false])
  const r = await fetch(`${B}/api/people/${yeni.kisiId}`, { method: 'PATCH', body: JSON.stringify({ paylasim: true, rol: 'investor' }) })
  const guncel = await r.json()
  assert.deepEqual([guncel.paylasim, guncel.asama], [true, ''], 'girişimci değilse aşama düşer')
  const csv = 'ad;soyad;rol;kurum;sektör;aşama;e-posta;izin\nEce;Tan;Girişimci;Mavi;Enerji;Büyüme;ece@mavi.com;Evet\n'
  await fetch(`${B}/api/people/import`, { method: 'POST', body: csv })
  const ece = (await getj(`${B}/api/people`)).find((k) => k.ad === 'Ece Tan')
  assert.deepEqual([ece.sektor, ece.asama, ece.eposta, ece.paylasim], ['Enerji', 'buyume', 'ece@mavi.com', true])
})

// ---------- Uyarı kuralları (port 8129, 60 kat hız): gerçek sunucunun /api/rules sözleşmesiyle aynı ----------

test('kurallar: eklenir, doğrulanır, kapatılır, silinir; tetiklenince kural uyarısı akışa düşer', async () => {
  const R = 'http://localhost:8129'
  baslat(['--port=8129', '--kisi=25', '--tohum=7', '--hizlandir=60'])
  await hazir(8129)
  const kisiler = await getj(`${R}/api/people`)
  const hatali = await post(`${R}/api/rules`, { kim: { kisiler: ['k999'] }, kiminle: { rol: 'herkes' } })
  assert.equal(hatali.status, 400)
  assert.deepEqual(await hatali.json(), { ok: false, hata: 'kim: bilinmeyen kişi k999' })

  const grup = await (await post(`${R}/api/rules`, { kim: { rol: 'investor', enAzYildiz: 4 }, kiminle: { rol: 'founder' }, dakika: 5 })).json()
  assert.equal(grup.ad, '★4+ yatırımcılar ile girişimciler · 5 dk')
  const kapali = await (await fetch(`${R}/api/rules/${grup.kuralId}`, { method: 'PATCH', body: JSON.stringify({ acik: false }) })).json()
  assert.equal(kapali.acik, false)
  const ilk = kisiler[0]
  const ozel = await (await post(`${R}/api/rules`, { kim: { kisiler: [ilk.kisiId] }, kiminle: { rol: 'herkes' } })).json()
  assert.equal(ozel.ad, `${ilk.rol === 'founder' && ilk.kurum ? ilk.kurum : ilk.ad} ile herkes · yan yana`)
  assert.equal((await fetch(`${R}/api/rules/${ozel.kuralId}`, { method: 'DELETE' })).status, 200)
  assert.equal((await fetch(`${R}/api/rules/r99`, { method: 'DELETE' })).status, 404)

  await post(`${R}/api/rules`, { ad: 'Herkes yan yana', kim: { rol: 'herkes' }, kiminle: { rol: 'herkes' }, dakika: 0 })
  let uyari
  for (let i = 0; i < 150 && !uyari; i++) {
    uyari = (await getj(`${R}/state`)).alerts.find((b) => b.kind === 'kural')
    await new Promise((c) => setTimeout(c, 100))
  }
  assert.ok(uyari, 'kural uyarısı gelmedi')
  assert.deepEqual([uyari.title, uyari.severity, uyari.kural, uyari.people.length], ['Herkes yan yana', 'kural', 'r3', 2])
  assert.match(uyari.detail, / ile .* yan yana geldi\.$/)
  assert.deepEqual((await getj(`${R}/api/rules`)).map((k) => k.kuralId), ['r1', 'r3'])
})
