// Faz 2.13 — "boştaki kartlar" (brief §6.4): masadaki yedekler açık ve alıcı
// tarafından duyulur ama kimseye atanmamıştır; panoda kişi olarak görünmez.
// İade edilen kart masaya (stoğa) döner. Kayıp kart: atanmış kart ≥60 sn duyulmaz.
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

const B = 'http://localhost:8118'
const stok = (kartlar) => kartlar.filter((k) => !k.atanan && k.seenAgo <= 8).map((k) => k.kart)

test('başlangıçta masada yedek kartlar var: duyulur, atanmamış, panoda yok', async () => {
  baslat(['--port=8118', '--kisi=25', '--tohum=6', '--hizlandir=120', '--kopma=0'])
  await hazir(8118)
  const kartlar = await getj(`${B}/api/cards`)
  const yedek = stok(kartlar)
  assert.ok(yedek.length >= 5, `yedek kart olmalı (${yedek})`)
  const state = await getj(`${B}/state`)
  for (const k of yedek.filter((n) => n !== '14')) {
    assert.ok(!state.people.some((p) => p.id === k), `yedek Kart ${k} panoda olmamalı`)
  }
})

test('iade edilen kart masaya döner (boştaki kartlarda), panoda değil', async () => {
  const kisi = (await getj(`${B}/api/people`)).find((k) => k.atananKart)
  await post(`${B}/api/unassign`, { kart: kisi.atananKart })
  assert.ok(stok(await getj(`${B}/api/cards`)).includes(kisi.atananKart), 'iade edilen kart stokta')
  assert.ok(!(await getj(`${B}/state`)).people.some((p) => p.id === kisi.atananKart))
})

test('stoktaki kart atanınca stoktan çıkar ve panoda görünür', async () => {
  const yedek = stok(await getj(`${B}/api/cards`)).find((n) => n !== '14')
  const yeni = await (await post(`${B}/api/people`, { ad: 'Stok Deneme', rol: 'guest' })).json()
  await post(`${B}/api/assign`, { kisiId: yeni.kisiId, kart: yedek })
  const kart = (await getj(`${B}/api/cards`)).find((k) => k.kart === yedek)
  assert.equal(kart.atanan, yeni.kisiId)
  await bekle(600)
  assert.ok((await getj(`${B}/state`)).people.some((p) => p.id === yedek && p.name === 'Stok Deneme'))
})

test('kayıp kart: atanmış bir kart ≥60 sn duyulmaz (/api/cards seenAgo)', async () => {
  let kayip
  for (let i = 0; i < 80 && !kayip; i++) {
    kayip = (await getj(`${B}/api/cards`)).find((k) => k.atanan && k.seenAgo >= 60)
    if (!kayip) await bekle(250)
  }
  assert.ok(kayip, 'kayıp kart senaryosu /api/cards\'ta görünmeli')
  assert.ok(!stok(await getj(`${B}/api/cards`)).includes(kayip.kart), 'kayıp kart stok sayılmaz')
})
