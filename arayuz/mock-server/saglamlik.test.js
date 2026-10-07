// Tarama düzeltmeleri — mock sağlamlığı: hatalı istek süreci düşürmez, alan tipleri ve
// kart no (1–99) doğrulanır, sıfırlama atanmış Kart 14'ü bozmaz.
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
const bekle = (ms) => new Promise((c) => setTimeout(c, ms))
const getj = async (u) => (await fetch(u)).json()
const post = (u, body) => fetch(u, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
after(() => { for (const c of acik) c.kill() })

const B = 'http://localhost:8125'

test('hatalı gövdeler 4xx döner, süreç ayakta kalır; kart no doğrulanır', async () => {
  const surec = baslat(['--port=8125', '--kisi=25', '--tohum=3', '--hizlandir=1', '--kopma=0'])
  let cikti = null
  surec.on('exit', (kod) => { cikti = kod })
  await hazir(8125)

  assert.equal((await post(`${B}/api/people`, { ad: 5 })).status, 400, 'ad sayı → 400')
  const k = await (await post(`${B}/api/people`, { ad: 'Deneme Kişi', kurum: 5, not: {}, rol: 'founder' })).json()
  assert.equal(k.kurum, '', 'dize olmayan kurum yok sayılır')
  assert.equal((await post(`${B}/api/people/import`, 'ad;kurum\nAli;Fon')).status, 200, 'CSV içe aktarma çökmez')
  assert.equal((await post(`${B}/api/people`, '{bozuk')).status, 400)

  for (const kart of ['105', '0', 'abc', '', '1000']) {
    assert.equal((await post(`${B}/api/assign`, { kisiId: k.kisiId, kart })).status, 400, `kart ${JSON.stringify(kart)} reddedilir`)
  }
  assert.equal((await post(`${B}/api/assign`, { kisiId: k.kisiId, kart: '007' })).status, 200, '"007" kabul, 7 olarak')
  assert.equal((await getj(`${B}/api/people`)).find((x) => x.kisiId === k.kisiId).atananKart, '7')

  assert.equal((await post(`${B}/api/unassign`, { kart: '150' })).status, 400)
  assert.equal((await post(`${B}/api/unassign`, { kart: '98' })).status, 404, 'bilinmeyen kart iade edilemez')
  assert.ok(!(await getj(`${B}/api/cards`)).some((c) => c.kart === '98' || c.id === '98'), 'hayalet kart masaya eklenmez')

  assert.equal((await fetch(`${B}/api/demo`)).status, 200, 'demo ucu yalnız mock\'ta')
  assert.ok((await fetch(`${B}/state`)).ok)
  assert.equal(cikti, null, 'süreç ayakta')
})

test('sıfırlama: atanmış Kart 14 kişisinde kalır', async () => {
  const k = await (await post(`${B}/api/people`, { ad: 'On Dört', rol: 'guest' })).json()
  assert.equal((await post(`${B}/api/assign`, { kisiId: k.kisiId, kart: '14' })).status, 200)
  await post(`${B}/control`, { cmd: 'reset' })
  await bekle(1200)
  const s = await getj(`${B}/state`)
  const on4 = s.people.filter((p) => p.id === '14')
  assert.equal(on4.length, 1, 'Kart 14 tek kez ve panoda')
  assert.equal(on4[0].name, 'On Dört', 'Kart 14 hâlâ atanan kişinin')
})
