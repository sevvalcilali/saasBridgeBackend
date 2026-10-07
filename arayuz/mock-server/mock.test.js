// Mock sunucu kabul testi — Faz 0 ölçütü: "mock çıktısı brief şemasıyla
// alan alan uyumlu". Şema kilidi brief §5.1'in TAM alan kümesini birebir
// doğrular (eksik alan da fazla alan da hata). Davranış testleri hızlandırılmış
// zamanla (--hizlandir) bildirim/kopma/atanmamış kart senaryolarını doğrular.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const MOCK_YOLU = fileURLToPath(new URL('./mock.js', import.meta.url))
const acikSunucular = []

function sunucuBaslat(args) {
  const cocuk = spawn(process.execPath, [MOCK_YOLU, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  acikSunucular.push(cocuk)
  return cocuk
}

async function hazirBekle(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/state`)
      if (r.ok) return
    } catch { /* henüz açılmadı */ }
    await new Promise((c) => setTimeout(c, 50))
  }
  throw new Error(`mock ${port} portunda açılmadı`)
}

async function durum(port) {
  return (await fetch(`http://localhost:${port}/state`)).json()
}

/** koşul sağlanana dek /state'i yoklar; süre dolarsa son durumla döner */
async function bekleKi(port, kosul, sureMs = 8000, aralikMs = 40) {
  const son = Date.now() + sureMs
  let s
  while (Date.now() < son) {
    s = await durum(port)
    if (kosul(s)) return { tamam: true, s }
    await new Promise((c) => setTimeout(c, aralikMs))
  }
  return { tamam: false, s }
}

after(() => { for (const c of acikSunucular) c.kill() })

// ---------- 1) ŞEMA KİLİDİ (port 8102; 10× hız: giriş 1 dk olunca ilk canlı çift ~6 sn'de) ----------

test('şema: durum nesnesi brief §5.1 ile alan alan birebir', async () => {
  sunucuBaslat(['--port=8102', '--kisi=25', '--tohum=7', '--hizlandir=10'])
  await hazirBekle(8102)
  const s = await durum(8102)

  assert.deepEqual(Object.keys(s).sort(), [
    'alerts', 'chartSeconds', 'clock', 'edges', 'elapsed', 'event', 'history',
    'live', 'people', 'receiverAge', 'rules', 'signals', 'stats', 'threshold',
  ])

  assert.equal(s.people.length, 25)
  for (const k of s.people) {
    assert.deepEqual(Object.keys(k).sort(), [
      'color', 'id', 'idleSinceS', 'invMin', 'invPeers', 'live', 'min', 'name', 'org',
      'role', 'seenAgo', 'stars', 'status', 'tier', 'withName',
    ])
    assert.equal(typeof k.id, 'string')
    assert.ok(['investor', 'founder', 'guest'].includes(k.role))
    assert.match(k.color, /^#[0-9a-f]{6}$/i)
    assert.ok(['talking', 'idle', 'away'].includes(k.status))
    assert.equal(typeof k.withName, 'string')
    for (const alan of ['live', 'min', 'invMin', 'invPeers', 'tier']) {
      assert.equal(typeof k[alan], 'number', `people.${alan}`)
    }
    assert.ok(k.seenAgo === null || typeof k.seenAgo === 'number')
    assert.equal(k.stars, '★'.repeat(k.tier))
    const kartNo = Number(k.id)
    assert.ok(kartNo >= 1 && kartNo < 100, 'kart no 1–99 (100+ dinleyici, kişi değil)')
  }

  // rol sırası: yatırımcılar → girişimciler → misafirler (brief §5.1 yorumu)
  const rolSira = s.people.map((k) => ({ investor: 0, founder: 1, guest: 2 })[k.role])
  assert.deepEqual(rolSira, [...rolSira].sort((a, b) => a - b))

  for (const c of s.live) assert.deepEqual(Object.keys(c).sort(), ['a', 'b', 'real', 'rssi'])
  for (const e of s.edges) assert.deepEqual(Object.keys(e).sort(), ['a', 'b', 'min'])
  for (const b of s.alerts) {
    assert.deepEqual(Object.keys(b).sort(), ['clock', 'detail', 'kind', 'people', 'severity', 't', 'title'])
    assert.ok(['deal', 'repeat', 'idle_investor', 'lost', 'no_investor'].includes(b.kind))
    assert.ok(['deal', 'warn', 'serious'].includes(b.severity))
    assert.match(b.clock, /^\d{2}:\d{2}$/)
  }
  assert.deepEqual(Object.keys(s.stats).sort(), ['deals', 'done', 'founders', 'livePairs', 'mixedMin', 'reached'])
  assert.ok(s.receiverAge === null || typeof s.receiverAge === 'number')
  assert.equal(typeof s.elapsed, 'number')
  assert.deepEqual(Object.keys(s.event).sort(), ['date', 'name', 'progress', 'sub'])
  assert.ok(s.event.progress === null || (s.event.progress >= 0 && s.event.progress <= 1))
  assert.match(s.clock, /^\d{2}:\d{2}:\d{2}$/)
  assert.equal(typeof s.threshold, 'number')
  for (const sg of s.signals) {
    assert.deepEqual(Object.keys(sg).sort(), ['a', 'ab', 'above', 'b', 'ba', 'n', 'together', 'value'])
    assert.ok(sg.ab === null || typeof sg.ab === 'number')
    assert.ok(sg.ba === null || typeof sg.ba === 'number')
    assert.equal(typeof sg.value, 'number')
    assert.equal(typeof sg.above, 'boolean')
    assert.equal(typeof sg.together, 'boolean')
  }
  for (const [cift, seri] of Object.entries(s.history)) {
    assert.match(cift, /^\d+-\d+$/)
    for (const nokta of seri) {
      assert.equal(nokta.length, 2)
      assert.ok(nokta[0] >= 0 && nokta[0] <= s.chartSeconds + 2, 'history: kaç sn önce')
    }
  }
  assert.equal(s.chartSeconds, 90)
  assert.deepEqual(Object.keys(s.rules), ['dealAfterS'])
})

test('şema: canlı çift ↔ kişi durumu tutarlı', async () => {
  const { tamam, s } = await bekleKi(8102, (d) => d.live.length > 0, 12000)
  assert.ok(tamam, 'hiç canlı çift oluşmadı')
  assert.equal(s.stats.livePairs, s.live.length)
  for (const c of s.live) {
    for (const id of [c.a, c.b]) {
      const kisi = s.people.find((k) => k.id === id)
      assert.ok(kisi, `canlı çiftteki ${id} kişi listesinde yok`)
      assert.equal(kisi.status, 'talking')
      assert.ok(kisi.withName.length > 0)
    }
    const sg = s.signals.find((x) => (x.a === c.a && x.b === c.b) || (x.a === c.b && x.b === c.a))
    assert.ok(sg && sg.together, 'canlı çiftin signals kaydı together olmalı')
  }
})

test('SSE: /events bağlanır bağlanmaz durum, sonra ~2 Hz akış', async () => {
  const ctrl = new AbortController()
  const t0 = Date.now()
  const yanit = await fetch('http://localhost:8102/events', { signal: ctrl.signal })
  assert.match(yanit.headers.get('content-type'), /text\/event-stream/)
  const okuyucu = yanit.body.getReader()
  const cozucu = new TextDecoder()
  let tampon = ''
  const mesajlar = []
  let ilkMs = null
  while (mesajlar.length < 4 && Date.now() - t0 < 4000) {
    const { value, done } = await okuyucu.read()
    if (done) break
    tampon += cozucu.decode(value, { stream: true })
    let i
    while ((i = tampon.indexOf('\n\n')) >= 0) {
      const blok = tampon.slice(0, i); tampon = tampon.slice(i + 2)
      const veri = blok.split('\n').filter((h) => h.startsWith('data: ')).map((h) => h.slice(6)).join('')
      if (veri) {
        if (ilkMs === null) ilkMs = Date.now() - t0
        mesajlar.push(JSON.parse(veri))
      }
    }
  }
  ctrl.abort()
  assert.ok(ilkMs !== null && ilkMs < 700, `ilk durum hemen gelmeli (${ilkMs} ms)`)
  assert.ok(mesajlar.length >= 4, `4 sn içinde ≥4 mesaj bekleniyordu (${mesajlar.length})`)
  assert.equal(mesajlar[0].chartSeconds, 90)
  assert.ok(mesajlar.at(-1).elapsed > mesajlar[0].elapsed)
})

test('kontrol: eşik değişir ve aralık dışı reddedilir', async () => {
  const r1 = await fetch('http://localhost:8102/control', {
    method: 'POST', body: JSON.stringify({ cmd: 'threshold', value: -70 }),
  })
  assert.equal(r1.status, 200)
  assert.equal((await durum(8102)).threshold, -70)

  const r2 = await fetch('http://localhost:8102/control', {
    method: 'POST', body: JSON.stringify({ cmd: 'threshold', value: -150 }),
  })
  assert.equal(r2.status, 400)
  assert.equal((await durum(8102)).threshold, -70)
})

// ---------- 2) DAVRANIŞ (port 8103, hızlandırılmış zaman) ----------

test('senaryo: atanmamış kart, kayıp kartı ve anlaşma bildirimi doğar', async () => {
  sunucuBaslat(['--port=8103', '--kisi=25', '--tohum=7', '--hizlandir=120', '--kopma=0'])
  await hazirBekle(8103)

  const atanmamis = await bekleKi(8103, (s) =>
    s.people.some((k) => /^Kart \d+$/.test(k.name) && k.role === 'guest'))
  assert.ok(atanmamis.tamam, 'atanmamış kart hiç görünmedi')

  const kayip = await bekleKi(8103, (s) => s.alerts.some((b) => b.kind === 'lost'))
  assert.ok(kayip.tamam, 'lost bildirimi düşmedi')
  const kayipBildirim = kayip.s.alerts.find((b) => b.kind === 'lost')
  const kayipKisi = kayip.s.people.find((k) => k.id === kayipBildirim.people[0])
  assert.ok(kayipKisi.seenAgo === null || kayipKisi.seenAgo > 30)

  const anlasma = await bekleKi(8103, (s) => s.alerts.some((b) => b.kind === 'deal'), 15000)
  assert.ok(anlasma.tamam, 'deal bildirimi düşmedi')
  assert.ok(anlasma.s.stats.deals >= 1)

  // bildirimler yalnız eklenir, en eski başta (brief §5.1)
  const zamanlar = anlasma.s.alerts.map((b) => b.t)
  assert.deepEqual(zamanlar, [...zamanlar].sort((a, b) => a - b))

  // süreler birikir
  assert.ok(anlasma.s.edges.length > 0)
  assert.ok(anlasma.s.stats.mixedMin > 0)
})

test('sıfırla: süreler, geçmiş ve bildirimler temizlenir', async () => {
  const r = await fetch('http://localhost:8103/control', {
    method: 'POST', body: JSON.stringify({ cmd: 'reset' }),
  })
  assert.equal(r.status, 200)
  const s = await durum(8103)
  assert.equal(s.edges.length, 0)
  assert.equal(s.alerts.length, 0)
  assert.equal(s.stats.done, 0)
  assert.ok(s.elapsed < 60, 'elapsed sıfırlanmalı')
  for (const k of s.people) {
    assert.equal(k.min, 0)
    assert.equal(k.invMin, 0)
  }
})

// ---------- 3) ALICI KOPMASI (port 8104) ----------

test('alıcı kopması: receiverAge büyür, sonra toparlanır', async () => {
  sunucuBaslat(['--port=8104', '--kisi=10', '--tohum=3', '--hizlandir=60', '--kopma=1'])
  await hazirBekle(8104)
  const koptu = await bekleKi(8104, (s) => s.receiverAge > 5, 12000, 25)
  assert.ok(koptu.tamam, 'alıcı kopması hiç görülmedi')
  const geldi = await bekleKi(8104, (s) => s.receiverAge !== null && s.receiverAge < 5, 12000, 25)
  assert.ok(geldi.tamam, 'alıcı geri gelmedi')
})

// ---------- Grafik verisi yalnız isteyene (port 8128): /state ve /events ?grafik=0 → history {} ----------

test('?grafik=0: history boş gelir, geri kalan aynı; parametre yoksa tam', async () => {
  sunucuBaslat(['--port=8128', '--kisi=25', '--tohum=7', '--hizlandir=60'])
  await hazirBekle(8128)
  await bekleKi(8128, (s) => Object.keys(s.history).length > 0)

  const tam = await durum(8128)
  const grafiksiz = await (await fetch('http://localhost:8128/state?grafik=0')).json()
  assert.ok(Object.keys(tam.history).length > 0)
  assert.deepEqual(grafiksiz.history, {})
  assert.deepEqual(Object.keys(grafiksiz).sort(), Object.keys(tam).sort())

  const kontrol = new AbortController()
  const yanit = await fetch('http://localhost:8128/events?grafik=0', { signal: kontrol.signal })
  const okuyucu = yanit.body.getReader()
  let metin = ''
  while ((metin.match(/\n\n/g) ?? []).length < 3) metin += new TextDecoder().decode((await okuyucu.read()).value)
  kontrol.abort()
  const mesajlar = metin.split('\n\n').filter(Boolean).slice(0, 3).map((b) => JSON.parse(b.replace(/^data: /, '')))
  for (const m of mesajlar) assert.deepEqual(m.history, {})
})
