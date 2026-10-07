// Faz 2.12 — toplu ön yükleme (brief §6.3, §9-5): etkinlik öncesi CSV yüklenir,
// kartlar kapıda atanır. Kartı olmayanlar "kart bekliyor"; iade edilenler
// "ayrıldı" (ayrildi alanı) — ayrılan kişi kart bekliyor sayılmaz.
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
const csvGonder = (metin) => fetch(`${B}/api/people/import`, { method: 'POST', headers: { 'Content-Type': 'text/csv; charset=utf-8' }, body: metin })
after(() => { for (const c of acik) c.kill() })

const B = 'http://localhost:8117'
const kisi = async (ad) => (await getj(`${B}/api/people`)).find((k) => k.ad === ad)

test('ayrildi: başlangıçta false; iade → true; yeniden kart → false', async () => {
  baslat(['--port=8117', '--kisi=25', '--tohum=4'])
  await hazir(8117)
  const liste = await getj(`${B}/api/people`)
  assert.ok(liste.every((k) => k.ayrildi === false))

  const k = liste[0]
  await post(`${B}/api/unassign`, { kart: k.atananKart })
  assert.equal((await kisi(k.ad)).ayrildi, true, 'iade edilen kişi ayrıldı')

  await post(`${B}/api/assign`, { kisiId: k.kisiId, kart: '97' })
  assert.equal((await kisi(k.ad)).ayrildi, false, 'yeniden kart alınca ayrıldı kalkar')
})

test('ayrildi: "Geri al" (ayrildi:false) ve başkasından alınan kart kişiyi ayrıldı yapmaz', async () => {
  const [a, b] = (await getj(`${B}/api/people`)).filter((k) => k.atananKart)
  await post(`${B}/api/unassign`, { kart: a.atananKart, ayrildi: false })
  assert.equal((await kisi(a.ad)).ayrildi, false, 'geri al: kişi kart bekliyor')

  await post(`${B}/api/assign`, { kisiId: a.kisiId, kart: b.atananKart }) // b'nin kartı a'ya
  const bSonra = await kisi(b.ad)
  assert.equal(bSonra.atananKart, null)
  assert.equal(bSonra.ayrildi, false, 'kartı alınan kişi ayrılmış sayılmaz')
})

test('CSV içe aktarma: noktalı virgül, Türkçe başlık/rol, tırnak, boş satır', async () => {
  const onceki = (await getj(`${B}/api/people`)).length
  const csv = [
    'Ad;Soyad;Rol;Kurum;Yıldız',
    'Deniz;Aksoy;Yatırımcı;Ege Girişim;4',
    'Can;Bulut;girişimci;"Veri; Köprüsü A.Ş.";3',
    '',
    'Lale;Tunç;Misafir;;',
    'Oya;Er;Bilinmez;X;1',
    ';Soyadsız;Misafir;;',
  ].join('\r\n')
  const r = await csvGonder(csv)
  assert.equal(r.status, 200)
  const sonuc = await r.json()
  assert.equal(sonuc.eklenen, 3)
  assert.deepEqual(sonuc.atlanan.map((x) => x.satir), [6, 7], 'hatalı satırlar satır no ile bildirilir')
  assert.match(sonuc.atlanan[0].sebep, /rol/i)
  assert.match(sonuc.atlanan[1].sebep, /ad/i)

  const liste = await getj(`${B}/api/people`)
  assert.equal(liste.length, onceki + 3)
  const deniz = liste.find((k) => k.ad === 'Deniz Aksoy')
  assert.equal(deniz.rol, 'investor')
  assert.equal(deniz.yildiz, 4)
  assert.equal(deniz.atananKart, null, 'kart bekliyor')
  assert.equal(deniz.ayrildi, false)
  assert.match(deniz.renk, /^#[0-9a-f]{6}$/i)
  const can = liste.find((k) => k.ad === 'Can Bulut')
  assert.equal(can.kurum, 'Veri; Köprüsü A.Ş.')
  assert.equal(can.yildiz, 0, 'yatırımcı değilse yıldız 0')
  assert.equal(liste.find((k) => k.ad === 'Lale Tunç').rol, 'guest')

  const state = await getj(`${B}/state`)
  assert.ok(!state.people.some((p) => p.name === 'Deniz Aksoy'), 'kartsız kişi panoda yok')
})

test('CSV içe aktarma: başlıksız, virgül, İngilizce rol, BOM; aynı kişi ikinci kez eklenmez', async () => {
  const r = await csvGonder('﻿Emel,Sarı,investor,Kuzey Fonu,5\nDeniz,Aksoy,Yatırımcı,Ege Girişim,4\n')
  const sonuc = await r.json()
  assert.equal(sonuc.eklenen, 1)
  assert.equal(sonuc.atlanan.length, 1)
  assert.match(sonuc.atlanan[0].sebep, /zaten/i)
  const emel = await kisi('Emel Sarı')
  assert.equal(emel.rol, 'investor')
  assert.equal(emel.yildiz, 5)
})

test('CSV içe aktarma: boş gövde reddedilir; kapıda atanınca panoda görünür', async () => {
  assert.equal((await csvGonder('')).status, 400)
  const emel = await kisi('Emel Sarı')
  await post(`${B}/api/assign`, { kisiId: emel.kisiId, kart: '96' })
  const p = (await getj(`${B}/state`)).people.find((x) => x.id === '96')
  assert.equal(p.name, 'Emel Sarı')
})
