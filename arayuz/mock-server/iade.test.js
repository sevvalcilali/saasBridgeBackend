// Faz 2.10 — kart iadesi (brief §6): kişi "ayrıldı", kart boşa çıkar, geçmiş
// süreleri silinmez. Görüşme ortasındaki (birlikte) kart iade edilince de
// benzetim çökmez; açık görüşme kapanır, kim-kimle-ne-kadar kenarı kalır.
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

const B = 'http://localhost:8115'
const cift = (e) => [e.a, e.b].sort().join('-')

test('birlikte olan kart iade edilir: sunucu ayakta, pano\'dan düşer, süreler kalır', async () => {
  const surec = baslat(['--port=8115', '--kisi=25', '--tohum=3', '--hizlandir=120', '--kopma=0'])
  let cikti = null
  surec.on('exit', (kod) => { cikti = kod })
  await hazir(8115)

  // süre biriktirmiş ve şu an birlikte olan bir çift bekle
  let hedef = null
  for (let i = 0; i < 80 && !hedef; i++) {
    const s = await getj(`${B}/state`)
    hedef = s.live.find((c) => s.edges.some((e) => cift(e) === cift(c) && e.min > 0))
    if (!hedef) await bekle(250)
  }
  assert.ok(hedef, 'süre biriktirmiş birlikte bir çift oluşmalı')
  const once = await getj(`${B}/state`)
  const kenarOnce = once.edges.find((e) => cift(e) === cift(hedef))
  const kisi = (await getj(`${B}/api/people`)).find((k) => k.atananKart === hedef.a)

  assert.equal((await post(`${B}/api/unassign`, { kart: hedef.a })).status, 200)
  await bekle(1500) // birkaç tik geçsin

  assert.equal(cikti, null, 'iade sonrası sunucu çökmemeli')
  const sonra = await getj(`${B}/state`)
  assert.ok(!sonra.people.some((p) => p.id === hedef.a), 'iade edilen kart pano\'dan düşmeli')
  assert.ok(!sonra.live.some((c) => c.a === hedef.a || c.b === hedef.a), 'açık görüşme kapanmalı')

  const kayit = (await getj(`${B}/api/people`)).find((k) => k.kisiId === kisi.kisiId)
  assert.ok(kayit, 'kişi kayıtta kalmalı')
  assert.equal(kayit.atananKart, null, 'kart boşa çıkmalı')

  // Kenarlar kişiye bağlı (2.11): kartsız kişi panoda görünmez ama süresi silinmez —
  // yeni kart alınca kim-kimle kenarı aynı süreyle geri gelir.
  const dolu = new Set((await getj(`${B}/api/people`)).map((k) => k.atananKart))
  const yeniKart = ['99', '98', '97', '96', '95'].find((n) => !dolu.has(n))
  await post(`${B}/api/assign`, { kisiId: kisi.kisiId, kart: yeniKart })
  const geri = await getj(`${B}/state`)
  const kenarGeri = geri.edges.find((e) => cift(e) === cift({ a: yeniKart, b: hedef.b }))
  assert.ok(kenarGeri, 'kim-kimle-ne-kadar kenarı silinmemeli')
  assert.ok(kenarGeri.min >= kenarOnce.min, `biriken süre azalmamalı (${kenarOnce.min} → ${kenarGeri.min})`)
})

test('iade edilen kartın eşi yeniden eşleşebilir (esler temizlenir)', async () => {
  const s = await getj(`${B}/state`)
  // eşi boşta kalan kişi "birlikte" takılı kalmamalı: hiçbir kişi, pano'da
  // olmayan bir kartla birlikte görünmemeli
  const idler = new Set(s.people.map((p) => p.id))
  for (const c of s.live) assert.ok(idler.has(c.a) && idler.has(c.b), `hayalet çift: ${c.a}-${c.b}`)
})
