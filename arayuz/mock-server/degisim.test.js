// Faz 2.11 — kart değişimi (brief §6): kişi aynı kalır, kartı değişir, süreler
// kişide birleşir (eski kart + yeni kart). Kişi bilgisi düzenleme: renk değişmez.
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
const patch = (u, body) => fetch(u, { method: 'PATCH', body: JSON.stringify(body) })
after(() => { for (const c of acik) c.kill() })

const B = 'http://localhost:8116'
const kenar = (s, x, y) => s.edges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x))

test('kart değişimi: yeni kartta kişinin süresi ve kim-kimle kenarı birleşir', async () => {
  baslat(['--port=8116', '--kisi=25', '--tohum=3', '--hizlandir=120', '--kopma=0'])
  await hazir(8116)

  // süre biriktirmiş bir kişi ve onun bir kenarı
  let s, e
  for (let i = 0; i < 80 && !e; i++) {
    s = await getj(`${B}/state`)
    e = s.edges.find((x) => x.min > 0 && s.people.some((p) => p.id === x.a) && s.people.some((p) => p.id === x.b))
    if (!e) await bekle(250)
  }
  assert.ok(e, 'süre biriktirmiş bir kenar oluşmalı')
  const eskiKart = e.a
  const es = e.b
  const eskiKisi = s.people.find((p) => p.id === eskiKart)
  const kisiler = await getj(`${B}/api/people`)
  const kisi = kisiler.find((k) => k.atananKart === eskiKart)
  const dolu = new Set(kisiler.map((k) => k.atananKart))
  const yeniKart = ['99', '98', '97', '96', '95', '94', '93'].find((n) => !dolu.has(n))

  assert.equal((await post(`${B}/api/assign`, { kisiId: kisi.kisiId, kart: yeniKart })).status, 200)
  await bekle(600)

  const sonra = await getj(`${B}/state`)
  assert.ok(!sonra.people.some((p) => p.id === eskiKart), 'eski kart panodan düşmeli')
  const yeni = sonra.people.find((p) => p.id === yeniKart)
  assert.ok(yeni, 'yeni kart panoda olmalı')
  assert.equal(yeni.name, eskiKisi.name, 'kişi aynı kalmalı')
  assert.equal(yeni.color, eskiKisi.color, 'renk kişiyi takip etmeli')
  assert.ok(yeni.min >= eskiKisi.min, `toplam süre birleşmeli (${eskiKisi.min} → ${yeni.min})`)

  const eskiKenar = kenar(s, eskiKart, es)
  const yeniKenar = kenar(sonra, yeniKart, es)
  assert.ok(yeniKenar, 'kim-kimle kenarı yeni kartla görünmeli')
  assert.ok(yeniKenar.min >= eskiKenar.min, `kenar süresi korunmalı (${eskiKenar.min} → ${yeniKenar.min})`)
  assert.ok(!kenar(sonra, eskiKart, es), 'eski kart no ile kenar kalmamalı')

  const kayit = (await getj(`${B}/api/people`)).find((k) => k.kisiId === kisi.kisiId)
  assert.equal(kayit.atananKart, yeniKart)
})

test('iade edilen kart başka kişiye verilirse eski kişinin süreleri ona geçmez', async () => {
  const kenarToplam = (st, id) => st.edges.filter((e) => e.a === id || e.b === id).reduce((t, e) => t + e.min, 0)
  let s, p
  for (let i = 0; i < 80 && !p; i++) {
    s = await getj(`${B}/state`)
    p = s.people.find((x) => x.min > 0 && kenarToplam(s, x.id) >= 3)
    if (!p) await bekle(250)
  }
  assert.ok(p, 'süresi olan bir kişi olmalı')
  const once = kenarToplam(s, p.id)
  await post(`${B}/api/unassign`, { kart: p.id })
  const yeni = await (await post(`${B}/api/people`, { ad: 'Taze Kişi', rol: 'guest' })).json()
  await post(`${B}/api/assign`, { kisiId: yeni.kisiId, kart: p.id })
  await bekle(100)
  const sonra = await getj(`${B}/state`)
  const t = sonra.people.find((x) => x.id === p.id)
  assert.equal(t.name, 'Taze Kişi')
  assert.ok(t.min < p.min, `yeni kişi eski sahibin süresini devralmamalı (${p.min} → ${t.min})`)
  // en fazla bir tik (≤1 dk) yeni görüşme olabilir; eski sahibin kenarları gelmemeli
  assert.ok(kenarToplam(sonra, p.id) < once - 1, `eski kenarlar devralınmamalı (${once} → ${kenarToplam(sonra, p.id)})`)
})

test('iade edilen kişi yeni kart alınca süreleri geri gelir (silinmemiş)', async () => {
  const s = await getj(`${B}/state`)
  const p = s.people.find((x) => x.min > 0)
  const kisi = (await getj(`${B}/api/people`)).find((k) => k.atananKart === p.id)
  await post(`${B}/api/unassign`, { kart: p.id })
  const dolu = new Set((await getj(`${B}/api/people`)).map((k) => k.atananKart))
  const yeniKart = ['92', '91', '90', '89', '88', '87'].find((n) => !dolu.has(n))
  await post(`${B}/api/assign`, { kisiId: kisi.kisiId, kart: yeniKart })
  await bekle(100)
  const t = (await getj(`${B}/state`)).people.find((x) => x.id === yeniKart)
  assert.ok(t.min >= p.min, `süre geri gelmeli (${p.min} → ${t.min})`)
})

test('PATCH: rol/ad değişir ve panoya yansır; geçersiz rol yok sayılır; renk sabit', async () => {
  const kisi = (await getj(`${B}/api/people`)).find((k) => k.atananKart && k.rol === 'founder')
  let r = await patch(`${B}/api/people/${kisi.kisiId}`, { ad: 'Yeni Ad', rol: 'investor', yildiz: 9 })
  assert.equal(r.status, 200)
  const g = await r.json()
  assert.equal(g.rol, 'investor')
  assert.equal(g.yildiz, 5, 'yıldız 1–5 aralığına kırpılmalı')
  assert.equal(g.renk, kisi.renk)

  r = await patch(`${B}/api/people/${kisi.kisiId}`, { rol: 'uydurma', ad: '   ' })
  const g2 = await r.json()
  assert.equal(g2.rol, 'investor', 'geçersiz rol yok sayılmalı')
  assert.equal(g2.ad, 'Yeni Ad', 'boş ad yok sayılmalı')

  await bekle(100)
  const p = (await getj(`${B}/state`)).people.find((x) => x.id === kisi.atananKart)
  assert.equal(p.name, 'Yeni Ad')
  assert.equal(p.role, 'investor')
  assert.equal(p.stars, '★★★★★')
})
