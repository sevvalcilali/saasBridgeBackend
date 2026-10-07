// demoVarMi: demo düğmeleri yalnız mock'ta (GET /api/demo 200); gerçek sunucuda 404 → gizli.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { demoVarMi, jsonIstek } from './http.js'

async function sunucu(kod) {
  const s = http.createServer((i, y) => { y.writeHead(i.url === '/api/demo' ? kod : 404); y.end('{}') })
  await new Promise((c) => s.listen(0, c))
  return { adres: `http://localhost:${s.address().port}`, kapat: () => s.close() }
}

test('mock (200) → demo var; gerçek sunucu (404) → yok; ulaşılamayan → yok', async () => {
  const mock = await sunucu(200)
  const gercek = await sunucu(404)
  assert.equal(await demoVarMi(mock.adres), true)
  assert.equal(await demoVarMi(gercek.adres), false)
  assert.equal(await demoVarMi('http://localhost:1'), false)
  mock.kapat(); gercek.kapat()
})

test('jsonIstek: gövdesiz başarı (204 / boş 200) hata değildir; JSON gövde okunur; 4xx istisna', async () => {
  const { jsonIstek } = await import('./http.js')
  const s = http.createServer((i, y) => {
    if (i.url === '/bos204') { y.writeHead(204); y.end(); return }
    if (i.url === '/bos200') { y.writeHead(200); y.end(); return }
    if (i.url === '/json') { y.writeHead(200, { 'Content-Type': 'application/json' }); y.end('{"ok":true}'); return }
    y.writeHead(400); y.end('{}')
  })
  await new Promise((c) => s.listen(0, c))
  const a = `http://localhost:${s.address().port}`
  assert.equal(await jsonIstek(a, '/bos204', 'POST', { kart: '7' }), null)
  assert.equal(await jsonIstek(a, '/bos200', 'POST', { kart: '7' }), null)
  assert.deepEqual(await jsonIstek(a, '/json'), { ok: true })
  await assert.rejects(jsonIstek(a, '/hata', 'POST', {}))
  s.close()
})

test('jsonIstek: hata yanıtındaki sunucu metni hataya eklenir (form gösterir)', async () => {
  const sunucu = http.createServer((_, y) => { y.writeHead(400, { 'Content-Type': 'application/json' }); y.end('{"ok":false,"hata":"kim: en az bir kişi seçin"}') })
  await new Promise((c) => sunucu.listen(0, c))
  try {
    await assert.rejects(jsonIstek(`http://localhost:${sunucu.address().port}`, '/api/rules', 'POST', {}),
      (e) => e.hata === 'kim: en az bir kişi seçin' && e.durum === 400)
  } finally { sunucu.close() }
})
