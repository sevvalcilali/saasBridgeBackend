// Faz 4.1 — görüşme kayıtları (brief §9-6): GET /api/sessions → [{a, b, start, end}].
// a/b kişi kimliği (kisiId; kayıtsız kart "kart:N"), start/end etkinlik saniyesi,
// sürmekte olanda end null. Kişi bazlı: iade edilen kişinin kayıtları kalır.
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

const B = 'http://localhost:8124'
const DT_DK = (0.5 * 20) / 60 // 20x: bir tik = 10 benzetim sn

test('sessions: şema; açık ve kapanmış kayıtlar; kişi kimliğiyle', async () => {
  baslat(['--port=8124', '--kisi=25', '--tohum=3', '--hizlandir=20', '--kopma=0'])
  await hazir(8124)
  let o = []
  for (let i = 0; i < 120 && !(o.some((x) => x.end != null) && o.some((x) => x.end == null)); i++) {
    o = await getj(`${B}/api/sessions`); await bekle(250)
  }
  assert.ok(o.some((x) => x.end != null), 'kapanmış görüşme olmalı')
  assert.ok(o.some((x) => x.end == null), 'sürmekte olan görüşme olmalı')
  for (const x of o) {
    assert.deepEqual(Object.keys(x).sort(), ['a', 'b', 'end', 'start'])
    assert.match(x.a, /^(k\d+|kart:\d+)$/); assert.match(x.b, /^(k\d+|kart:\d+)$/)
    if (x.end != null) assert.ok(x.end > x.start)
  }
})

test('sessions: çift başına toplam süre /state kenar süresiyle tutarlı', async () => {
  const kisiler = await getj(`${B}/api/people`)
  const kartiKim = new Map(kisiler.filter((k) => k.atananKart).map((k) => [k.atananKart, k.kisiId]))
  const [o, s] = await Promise.all([getj(`${B}/api/sessions`), getj(`${B}/state`)])
  const toplam = new Map()
  for (const x of o) {
    const k = [x.a, x.b].sort().join('|')
    toplam.set(k, (toplam.get(k) ?? 0) + ((x.end ?? s.elapsed) - x.start) / 60)
  }
  let karsilastirilan = 0
  for (const e of s.edges) {
    const [a, b] = [kartiKim.get(e.a) ?? `kart:${e.a}`, kartiKim.get(e.b) ?? `kart:${e.b}`]
    const t = toplam.get([a, b].sort().join('|'))
    assert.ok(t !== undefined, `kenar ${e.a}-${e.b} için görüşme kaydı olmalı`)
    assert.ok(Math.abs(t - e.min) <= DT_DK + 0.02, `çift ${e.a}-${e.b}: kayıt ${t.toFixed(2)} dk ≈ kenar ${e.min} dk`)
    karsilastirilan++
  }
  assert.ok(karsilastirilan > 0)
})

test('sessions: iade edilen kişinin kayıtları kalır, açık görüşmesi kapanır', async () => {
  const o = await getj(`${B}/api/sessions`)
  const acikOturum = o.find((x) => x.end == null && x.a.startsWith('k') && x.b.startsWith('k'))
  assert.ok(acikOturum, 'açık bir görüşme olmalı')
  const kisi = (await getj(`${B}/api/people`)).find((k) => k.kisiId === acikOturum.a)
  await post(`${B}/api/unassign`, { kart: kisi.atananKart })
  const sonra = await getj(`${B}/api/sessions`)
  const ayni = sonra.filter((x) => x.a === acikOturum.a || x.b === acikOturum.a)
  assert.ok(ayni.length >= 1, 'kayıtlar silinmemeli')
  assert.ok(ayni.every((x) => x.end != null), 'iade edilen kişinin açık görüşmesi kapanmalı')
})

test('sessions: sıfırla hepsini temizler', async () => {
  await post(`${B}/control`, { cmd: 'reset' })
  assert.deepEqual(await getj(`${B}/api/sessions`), [])
})
