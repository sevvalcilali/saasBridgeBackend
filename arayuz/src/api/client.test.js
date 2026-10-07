// api/client.js — sunucuyla konuşan TEK yer (PLAN mimari kuralı 1).
// Sözleşme: ilk durumu /state'ten alır, /events (SSE) ile canlı dinler,
// kopunca geri çekilmeli yeniden dener, son veriyi SİLMEZ (brief §11),
// kişi renklerini açık temaya eşler ve kartı 100+ olanları kişi listesinden
// ayıklar (brief §2: dinleyici cihaz, kişi değil).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { durumIsle, PanoBaglantisi } from './client.js'
import { PALET } from './renkler.js'

const ORNEK_DURUM = {
  people: [
    { id: '10', role: 'investor', name: 'Ayşe Demir', org: 'Atlas Ventures', color: '#3987e5', stars: '★★★', tier: 3, status: 'talking', withName: 'Nova Robotik', live: 0.41, min: 12.5, invMin: 9, invPeers: 2, seenAgo: 0.1 },
    { id: '11', role: 'founder', name: 'Can Yılmaz', org: 'Nova Robotik', color: '#199e70', stars: '', tier: 0, status: 'talking', withName: 'Ayşe Demir', live: 0.41, min: 12.5, invMin: 9, invPeers: 1, seenAgo: 0.2 },
    { id: '101', role: 'guest', name: 'Kart 101', org: '', color: '#898781', stars: '', tier: 0, status: 'idle', withName: '', live: 0, min: 0, invMin: 0, invPeers: 0, seenAgo: 0.3 },
  ],
  live: [{ a: '10', b: '11', real: true, rssi: -41.3 }],
  edges: [{ a: '10', b: '11', min: 0.41 }],
  alerts: [
    { t: 1, clock: '09:20', kind: 'lost', severity: 'serious', title: 'Kart sinyali kesildi', detail: '…', people: ['12'] },
    { t: 2, clock: '09:22', kind: 'deal', severity: 'deal', title: 'Potansiyel anlaşma', detail: '…', people: ['10', '11'] },
  ],
  stats: { done: 3, livePairs: 1, mixedMin: 21.4, deals: 1, reached: 1, founders: 2 },
  receiverAge: 0.1, elapsed: 24.7,
  event: { name: 'Canlı Demo', sub: 'alt', date: '28.09.2026', progress: null },
  clock: '09:22:53', threshold: -72,
  signals: [{ a: '10', b: '11', ab: -46, ba: -50, value: -48, n: 10, above: true, together: true }],
  history: { '10-11': [[2, -67], [0, -66.5]] },
  chartSeconds: 90, rules: { dealAfterS: null },
}

/** Test sunucusu: /state, /events (SSE) ve /control'ü taklit eder. */
function testSunucusu(secenekler = {}) {
  const { stateHatasi = false, sseKapat = 0, satirSonu = '\n' } = secenekler
  const olay = (d) => `data: ${JSON.stringify(d)}${satirSonu}${satirSonu}`
  const durum = structuredClone(ORNEK_DURUM)
  const kayit = { stateIstek: 0, eventsIstek: 0, kontrolGovdeleri: [], adresler: [] }
  const istemciler = new Set()
  const sunucu = http.createServer((istek, yanit) => {
    kayit.adresler.push(istek.url)
    const yol = istek.url.split('?')[0]
    if (yol === '/state') {
      kayit.stateIstek++
      if (stateHatasi) { yanit.writeHead(500); yanit.end('patladı'); return }
      yanit.writeHead(200, { 'Content-Type': 'application/json' })
      yanit.end(JSON.stringify(durum))
    } else if (yol === '/events') {
      kayit.eventsIstek++
      yanit.writeHead(200, { 'Content-Type': 'text/event-stream' })
      yanit.write(olay(durum))
      istemciler.add(yanit)
      if (kayit.eventsIstek <= sseKapat) setTimeout(() => { istemciler.delete(yanit); yanit.end() }, 60)
    } else if (istek.url === '/control') {
      let govde = ''
      istek.on('data', (p) => { govde += p })
      istek.on('end', () => {
        kayit.kontrolGovdeleri.push(govde)
        yanit.writeHead(200, { 'Content-Type': 'application/json' }); yanit.end('{"ok":true}')
      })
    } else { yanit.writeHead(404); yanit.end() }
  })
  return {
    kayit,
    yayinla(yamaFn) {
      yamaFn(durum)
      for (const i of istemciler) i.write(olay(durum))
    },
    async baslat() {
      await new Promise((c) => sunucu.listen(0, c))
      return `http://localhost:${sunucu.address().port}`
    },
    kapat() { for (const i of istemciler) i.end(); sunucu.close() },
  }
}

/** Bağlantıyı dinleyip koşul sağlanan ilk anlık görüntüyü döndürür. */
function durumBekle(baglanti, kosul, sureMs = 3000) {
  return new Promise((coz, red) => {
    const zamanAsimi = setTimeout(() => { birak(); red(new Error('koşul zamanında sağlanmadı')) }, sureMs)
    const birak = baglanti.dinle((anlik) => {
      if (!kosul(anlik)) return
      clearTimeout(zamanAsimi); birak(); coz(anlik)
    })
  })
}

test('ilk durumu /state ile alır ve dinleyiciye verir', async () => {
  const s = testSunucusu()
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  baglanti.basla()
  const anlik = await durumBekle(baglanti, (a) => a.durum !== null)
  assert.equal(anlik.durum.clock, '09:22:53')
  assert.equal(anlik.baglandi, true)
  assert.equal(anlik.hata, null)
  baglanti.kapat(); s.kapat()
})

test('100+ numaralı kartlar kişi listesinden ayıklanır (dinleyici cihaz)', async () => {
  const s = testSunucusu()
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  baglanti.basla()
  const { durum } = await durumBekle(baglanti, (a) => a.durum !== null)
  assert.deepEqual(durum.people.map((k) => k.id), ['10', '11'])
  baglanti.kapat(); s.kapat()
})

test('kişi renkleri açık temaya eşlenir, ham renk saklanır', async () => {
  const s = testSunucusu()
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  baglanti.basla()
  const { durum } = await durumBekle(baglanti, (a) => a.durum !== null)
  assert.equal(durum.people[0].color, PALET.mavi)
  assert.equal(durum.people[0].sunucuColor, '#3987e5')
  assert.equal(durum.people[1].color, PALET.petrol, '#199e70 petrole eşlenmeli')
  baglanti.kapat(); s.kapat()
})

test('bildirimler en yeni üstte sıralanır (brief §7: akışta en yeni en üstte)', async () => {
  const s = testSunucusu()
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  baglanti.basla()
  const { durum } = await durumBekle(baglanti, (a) => a.durum !== null)
  assert.deepEqual(durum.alerts.map((b) => b.t), [2, 1])
  baglanti.kapat(); s.kapat()
})

test('SSE güncellemeleri akar; her mesaj durumun tamamıdır', async () => {
  const s = testSunucusu()
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  baglanti.basla()
  await durumBekle(baglanti, (a) => a.durum !== null)
  s.yayinla((d) => { d.clock = '09:23:10'; d.stats.livePairs = 2 })
  const anlik = await durumBekle(baglanti, (a) => a.durum.clock === '09:23:10')
  assert.equal(anlik.durum.stats.livePairs, 2)
  baglanti.kapat(); s.kapat()
})

test('SSE \\r\\n satır sonlarıyla da akar (EventSource gibi; Python sunucuları)', async () => {
  const s = testSunucusu({ satirSonu: '\r\n', stateHatasi: true })
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  baglanti.basla()
  await durumBekle(baglanti, (a) => a.durum !== null)
  s.yayinla((d) => { d.clock = '09:23:10' })
  const anlik = await durumBekle(baglanti, (a) => a.durum.clock === '09:23:10')
  assert.equal(anlik.durum.clock, '09:23:10')
  baglanti.kapat(); s.kapat()
})

test('\\r\\n parçalar arasında bölünse de tek olay sayılır (sahte olay sınırı yok)', async () => {
  const durum = { people: [], edges: [], alerts: [], clock: '10:00:00' }
  const govde = `data: ${JSON.stringify(durum)}\r\n\r\n`
  const bol = govde.indexOf('\r\n') + 1 // ilk \r bir parçada, \n sonrakinde
  const sunucu = http.createServer((istek, yanit) => {
    if (istek.url !== '/events') { yanit.writeHead(404); yanit.end(); return }
    yanit.writeHead(200, { 'Content-Type': 'text/event-stream' })
    yanit.write(govde.slice(0, bol))
    setTimeout(() => yanit.write(govde.slice(bol)), 40)
  })
  await new Promise((c) => sunucu.listen(0, c))
  const baglanti = new PanoBaglantisi({ adres: `http://localhost:${sunucu.address().port}` })
  let bozuk = 0
  const eski = baglanti.durumAyarla.bind(baglanti)
  baglanti.durumAyarla = (ham) => { if (!ham || !ham.clock) bozuk++; eski(ham) }
  baglanti.basla()
  const anlik = await durumBekle(baglanti, (a) => a.durum !== null)
  assert.equal(anlik.durum.clock, '10:00:00')
  assert.equal(bozuk, 0)
  baglanti.kapat(); sunucu.closeAllConnections(); sunucu.close()
})

test('bağlantı kopunca hata bildirilir ama son veri silinmez', async () => {
  const s = testSunucusu({ sseKapat: 1 })
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres, bekleme: () => 20 })
  baglanti.basla()
  await durumBekle(baglanti, (a) => a.durum !== null)
  const kopuk = await durumBekle(baglanti, (a) => a.baglandi === false)
  assert.equal(kopuk.hata, 'baglanti')
  assert.equal(kopuk.durum.clock, '09:22:53', 'son veri korunmalı')
  const geri = await durumBekle(baglanti, (a) => a.baglandi === true)
  assert.equal(geri.hata, null)
  assert.ok(s.kayit.eventsIstek >= 2, 'yeniden bağlanmalı')
  baglanti.kapat(); s.kapat()
})

test('yeniden deneme bekleme süresi geri çekmeli artar ve üst sınırda durur', () => {
  const baglanti = new PanoBaglantisi({ adres: 'http://yok' })
  const sureler = [0, 1, 2, 3, 4, 9].map((n) => baglanti.beklemeSuresi(n))
  assert.deepEqual(sureler.slice(0, 5), [500, 1000, 2000, 4000, 8000])
  assert.equal(sureler.at(-1), 10000, 'üst sınır 10 sn')
})

test('sessiz akış: belirli süre mesaj gelmezse kopma algılanır (gözcü)', async () => {
  // Sunucu ilk durumu yollar ama sonra susar (soketi kapatmadan) — sessizce
  // ölen bağlantı. Gözcü olmadan client bunu asla fark etmez.
  const s = testSunucusu() // yayinla çağrılmaz → ilk durumdan sonra sessiz
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres, bekleme: () => 50, sessizlikEsigiMs: 200 })
  baglanti.basla()
  await durumBekle(baglanti, (a) => a.durum !== null) // ilk durum geldi
  const kopuk = await durumBekle(baglanti, (a) => a.baglandi === false, 3000)
  assert.equal(kopuk.hata, 'baglanti')
  assert.ok(kopuk.durum !== null, 'sessizlikte de son veri korunur')
  baglanti.kapat(); s.kapat()
})

test('/state hatası akışı durdurmaz, SSE ilk durumu getirir', async () => {
  const s = testSunucusu({ stateHatasi: true })
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres, bekleme: () => 20 })
  baglanti.basla()
  const anlik = await durumBekle(baglanti, (a) => a.durum !== null)
  assert.equal(anlik.durum.clock, '09:22:53')
  baglanti.kapat(); s.kapat()
})

test('eşik ve sıfırlama komutları /control\'e gider', async () => {
  const s = testSunucusu()
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres })
  await baglanti.esikGonder(-70)
  await baglanti.sifirla()
  assert.deepEqual(s.kayit.kontrolGovdeleri.map((g) => JSON.parse(g)), [
    { cmd: 'threshold', value: -70 },
    { cmd: 'reset' },
  ])
  s.kapat()
})

test('kapat(): dinleyici bırakılır, yeni bağlantı denenmez', async () => {
  const s = testSunucusu({ sseKapat: 5 })
  const adres = await s.baslat()
  const baglanti = new PanoBaglantisi({ adres, bekleme: () => 10 })
  baglanti.basla()
  await durumBekle(baglanti, (a) => a.durum !== null)
  baglanti.kapat()
  const istekSayisi = s.kayit.eventsIstek
  await new Promise((c) => setTimeout(c, 150))
  assert.equal(s.kayit.eventsIstek, istekSayisi, 'kapatıldıktan sonra yeniden bağlanmamalı')
  s.kapat()
})

test('durumIsle: 100+ dinleyici cihazlar kişilerden ve bütün çift koleksiyonlarından ayıklanır', () => {
  const d = durumIsle({
    people: [{ id: '10', color: '#3987e5' }, { id: '101', color: '#3987e5' }],
    edges: [{ a: '10', b: '11', min: 3 }, { a: '10', b: '101', min: 2 }],
    live: [{ a: '101', b: '11' }],
    signals: [{ a: '10', b: '11', value: -60 }, { a: '11', b: '120', value: -50 }],
    history: { '10-11': [[0, -60]], '11-101': [[0, -50]] },
    alerts: [],
  })
  assert.deepEqual(d.people.map((k) => k.id), ['10'])
  assert.deepEqual(d.edges.map((e) => `${e.a}-${e.b}`), ['10-11'])
  assert.deepEqual(d.live, [])
  assert.deepEqual(d.signals.map((s) => `${s.a}-${s.b}`), ['10-11'])
  assert.deepEqual(Object.keys(d.history), ['10-11'])
})

test('durumIsle: eksik koleksiyonlar (sunucu göndermediyse) bozulmadan geçer', () => {
  const d = durumIsle({ people: [], alerts: [] })
  assert.equal(d.edges, undefined)
  assert.equal(d.history, undefined)
})

test('durumIsle: aynı anda aynı türden iki bildirim ayrı, kararlı anahtar alır (React key çakışması yok)', () => {
  const alerts = [
    { t: 100, kind: 'idle_investor', people: ['10'] },
    { t: 100, kind: 'idle_investor', people: ['11'] },
    { t: 100, kind: 'deal', people: ['10', '12'] },
    { t: 100, kind: 'deal', people: ['10', '12'] }, // tıpatıp aynı → sıra no ile ayrılır
  ]
  const d1 = durumIsle({ people: [], alerts })
  const anahtarlar = d1.alerts.map((a) => a.anahtar)
  assert.equal(new Set(anahtarlar).size, 4)
  const d2 = durumIsle({ people: [], alerts: [...alerts] })
  assert.deepEqual(d2.alerts.map((a) => a.anahtar), anahtarlar, 'her tikte aynı anahtar')
})

test('grafik istemeyen bağlantı /state ve /events için ?grafik=0 ister; varsayılan tam durum', async () => {
  // Kurulum grafiğinin verisi (history) durumun en büyük parçası; yalnız Kurulum ister (backend B7).
  const s = testSunucusu()
  const adres = await s.baslat()
  const akisAcildi = async (n) => { while (s.kayit.eventsIstek < n) await new Promise((c) => setTimeout(c, 10)) }
  const grafiksiz = new PanoBaglantisi({ adres, grafik: false })
  grafiksiz.basla()
  await akisAcildi(1)
  grafiksiz.kapat()
  const tam = new PanoBaglantisi({ adres })
  tam.basla()
  await akisAcildi(2)
  tam.kapat(); s.kapat()
  assert.deepEqual(s.kayit.adresler, ['/state?grafik=0', '/events?grafik=0', '/state', '/events'])
})
