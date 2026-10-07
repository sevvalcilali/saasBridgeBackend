// Kod incelemesi R2 — mock doğruluğu: anlaşma geçmişi karta değil kişiye bağlı (kart başkasına
// verilince devredilmez); bütün kartlar iade edilse de benzetim (kayıp kart senaryosu) çökmez.
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

test('anlaşma geçmişi kişiye bağlı: iade edilip başkasına verilen kart "yeniden bir arada" üretmez, sayaç artar', async () => {
  const B = 'http://localhost:8126'
  baslat(['--port=8126', '--kisi=25', '--tohum=3', '--hizlandir=60', '--kopma=0', '--anlasmaSn=10'])
  await hazir(8126)
  let anlasma = null
  for (let i = 0; i < 120 && !anlasma; i++) {
    anlasma = (await getj(`${B}/state`)).alerts.find((a) => a.kind === 'deal' && a.people.every((p) => Number(p) < 100))
    if (!anlasma) await bekle(150)
  }
  assert.ok(anlasma, 'bir anlaşma oluşmalı')
  const [x, y] = anlasma.people
  await post(`${B}/api/unassign`, { kart: x })
  const yeni = await (await post(`${B}/api/people`, { ad: 'Yeni Sahip', rol: 'investor', yildiz: 3 })).json()
  assert.equal((await post(`${B}/api/assign`, { kisiId: yeni.kisiId, kart: x })).status, 200)
  const atamaT = Date.now() / 1000
  const dealsOnce = (await getj(`${B}/state`)).stats.deals
  await post(`${B}/api/demo/tut`, { a: x, b: y, mod: 'yuzyuze' })
  let yeniAnlasma = null
  for (let i = 0; i < 120 && !yeniAnlasma; i++) {
    const s = await getj(`${B}/state`)
    const sonra = s.alerts.filter((a) => a.t > atamaT && a.people.includes(x) && a.people.includes(y))
    assert.ok(!sonra.some((a) => a.kind === 'repeat'), 'yeni sahip için "Yeniden bir arada" çıkmamalı')
    yeniAnlasma = sonra.find((a) => a.kind === 'deal')
    if (yeniAnlasma) assert.ok(s.stats.deals > dealsOnce, `anlaşma sayacı artmalı (${dealsOnce} → ${s.stats.deals})`)
    else await bekle(150)
  }
  assert.ok(yeniAnlasma, 'yeni kişi çifti kendi anlaşmasını almalı')
})

test('bütün kartlar iade edilse de benzetim çökmez (kayıp kart senaryosu boş listede)', async () => {
  const B = 'http://localhost:8127'
  const surec = baslat(['--port=8127', '--kisi=25', '--tohum=3', '--hizlandir=60', '--kopma=0']) // 180 sim-sn ≈ 3 sn
  let cikti = null
  surec.on('exit', (kod) => { cikti = kod })
  await hazir(8127)
  // Kart 14 45. sn'de sahneye girer; o da iade edilsin ki sahne gerçekten boş kalsın.
  for (let i = 0; i < 60 && !(await getj(`${B}/state`)).people.some((p) => p.id === '14'); i++) await bekle(100)
  for (const p of (await getj(`${B}/state`)).people) await post(`${B}/api/unassign`, { kart: p.id })
  assert.equal((await getj(`${B}/state`)).people.length, 0)
  await post(`${B}/control`, { cmd: 'reset' }) // simSn 0; kayıp kart senaryosu 180. sn'de boş listeyle yeniden kurulur
  await bekle(6000)
  assert.equal(cikti, null, 'süreç ayakta')
  assert.ok((await fetch(`${B}/state`)).ok)
})
