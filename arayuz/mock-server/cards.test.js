// GET /api/cards: alıcının duyduğu kartlar (masadaki yedekler dahil), son duyulma ve atanan kişi.
// Kart numarayla verilir; "yaklaştır ve tanı" ve POST /api/yaklastir yok (Şevval kararı 07.10.2026).
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

const B = 'http://localhost:8113'

test('GET /api/cards: şema ve normalde hiçbir kart baskın değil', async () => {
  baslat(['--port=8113', '--kisi=25', '--tohum=5'])
  await hazir(8113)
  const kartlar = await getj(`${B}/api/cards`)
  assert.ok(kartlar.length >= 25)
  for (const k of kartlar) {
    assert.deepEqual(Object.keys(k).sort(), ['atanan', 'kart', 'rssiAlici', 'seenAgo']) // pil yok (07.10.2026)
    assert.equal(typeof k.rssiAlici, 'number')
  }
  const enGuclu = Math.max(...kartlar.map((k) => k.rssiAlici))
  assert.ok(enGuclu <= -60, `normalde yakın kart olmamalı (en güçlü ${enGuclu})`)
})

test('atanan: başlangıç kadrosunun kartları bir kişiye atanmış', async () => {
  const kartlar = await getj(`${B}/api/cards`)
  const atanmis = kartlar.filter((k) => k.atanan)
  assert.ok(atanmis.length >= 25, 'atanmış kart yok')
})
