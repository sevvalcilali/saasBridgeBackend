// Faz 3.6 — kalibrasyon demosu (yalnız mock): donanım yokken iki kartı "yüz yüze"
// ya da "sırt sırta" tutmayı taklit eder. Yüz yüze belirgin güçlü, sırt sırta zayıf.
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
const post = (u, body) => fetch(u, { method: 'POST', body: JSON.stringify(body) })
after(() => { for (const c of acik) c.kill() })

const B = 'http://localhost:8119'
const deger = async (a, b) => (await getj(`${B}/state`)).signals.find((s) => [s.a, s.b].sort().join() === [a, b].sort().join())?.value

test('demo/tut: yüz yüze güçlü, sırt sırta zayıf; bırakınca normale döner', async () => {
  baslat(['--port=8119', '--kisi=25', '--tohum=8', '--kopma=0'])
  await hazir(8119)
  const [p, q] = (await getj(`${B}/state`)).people
  assert.equal((await post(`${B}/api/demo/tut`, { a: p.id, b: q.id, mod: 'yuzyuze' })).status, 200)
  await bekle(3000)
  const yy = await deger(p.id, q.id)
  assert.ok(yy > -62, `yüz yüze güçlü olmalı (${yy})`)

  await post(`${B}/api/demo/tut`, { a: p.id, b: q.id, mod: 'sirtsirta' })
  await bekle(11000) // 10 sn ortanca penceresi yenilensin
  const ss = await deger(p.id, q.id)
  assert.ok(ss < -72, `sırt sırta zayıf olmalı (${ss})`)
  assert.ok(yy - ss >= 10, 'iki ölçüm belirgin ayrışmalı')

  assert.equal((await post(`${B}/api/demo/tut`, { a: p.id, b: q.id, mod: null })).status, 200)
})

test('demo/tut: panoda olmayan kart ya da geçersiz mod reddedilir', async () => {
  assert.equal((await post(`${B}/api/demo/tut`, { a: '98', b: '99', mod: 'yuzyuze' })).status, 404)
  const [p, q] = (await getj(`${B}/state`)).people
  assert.equal((await post(`${B}/api/demo/tut`, { a: p.id, b: q.id, mod: 'uydurma' })).status, 400)
})
