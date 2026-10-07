// Canlı sinyal grafiği geometrisi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { grafikSerileri, olcekY, olcekX, xdenSaniye, etiketleriAyir, anlikDegerler, ciftEtiketi, ciftAdi, grafikYuksekligi, yumusat, birlikteAnahtarlari, Y_ALT, Y_UST } from './grafik.js'

const PEOPLE = [
  { id: '3', name: 'Cem', role: 'founder', color: '#c25022' },
  { id: '4', name: 'Deniz', role: 'guest', color: '#6a5cd0' },
  { id: '10', name: 'Ayşe', role: 'investor', color: '#2f6fc0' },
]
const H = {
  '3-4': [[90, -80], [2, -60]],
  '3-10': [[90, -70], [0, -50]],
  '4-10': [[4, -85]],
  '10-11': [[0, -45]],
  '5-6': [],
}

test('grafikSerileri: en güçlü N, çizim sırası kart no ile; boş seriler atlanır', () => {
  const { seriler, toplam } = grafikSerileri(H, PEOPLE, { n: 2 })
  assert.equal(toplam, 4)
  assert.deepEqual(seriler.map((s) => s.anahtar), ['3-10', '10-11'], 'en güçlü ikisi (-50, -45), kart no sırasıyla')
  assert.equal(seriler[1].b.name, 'Kart 11', 'bilinmeyen kart yer tutucu')
})

test('grafikSerileri: hepsi ve kişi perspektifi', () => {
  assert.equal(grafikSerileri(H, PEOPLE, { n: 2, hepsi: true }).seriler.length, 4)
  const p = grafikSerileri(H, PEOPLE, { kisiId: '4' })
  assert.deepEqual(p.seriler.map((s) => s.anahtar), ['3-4', '4-10'])
  assert.equal(p.toplam, 2)
})

test('ölçekler: sabit eksen, aralık dışı kenara yapışır; x sağda şimdi', () => {
  assert.equal(olcekY(Y_UST, 300), 0)
  assert.equal(olcekY(Y_ALT, 300), 300)
  assert.equal(olcekY(-20, 300), 0)
  assert.equal(olcekY(-120, 300), 300)
  assert.equal(olcekY(-65, 300), 150)
  assert.equal(olcekX(0, 900, 90), 900)
  assert.equal(olcekX(90, 900, 90), 0)
  assert.equal(xdenSaniye(450, 900, 90), 45)
})

test('etiketleriAyir: en az aralık kadar açılır, sınır içinde, giriş sırası korunur', () => {
  const y = etiketleriAyir([100, 102, 50, 101], 12, 0, 300)
  const sirali = [...y].sort((a, b) => a - b)
  for (let i = 1; i < sirali.length; i++) assert.ok(sirali[i] - sirali[i - 1] >= 12 - 1e-9)
  assert.equal(y[2], 50, 'uzaktaki etiket yerinde kalır')
  const alt = etiketleriAyir([298, 299, 300], 12, 0, 300)
  assert.ok(Math.max(...alt) <= 300 && Math.min(...alt) >= 0)
})

test('anlikDegerler: o ana en yakın nokta, tolerans dışı yok; güçlü üstte', () => {
  const { seriler } = grafikSerileri(H, PEOPLE, { hepsi: true })
  const a = anlikDegerler(seriler, 1)
  assert.deepEqual(a.map((x) => ciftEtiketi(x.seri)), ['10 · 11', '3 · 10', '3 · 4'])
  assert.equal(anlikDegerler(seriler, 45).length, 0)
})

test('ciftAdi: çizgi sonunda kart no yerine kısa ad; girişimcide kurum, uzun ad kısaltılır', () => {
  const s = (a, b) => ({ a, b })
  assert.equal(ciftAdi(s({ id: '10', name: 'Ayşe Demir', role: 'investor' }, { id: '3', name: 'Cem', org: 'Nova Robotik', role: 'founder' })),
    'Ayşe Demir · Nova Robotik')
  assert.equal(ciftAdi(s({ id: '1', name: 'Çok Uzun Bir Kişi Adı', role: 'guest' }, { id: '2', name: 'Kart 2' })),
    'Çok Uzun Bir… · Kart 2')
})

test('grafikYuksekligi: dar ekranda kısa, genişte ekranın ~yarısı (sınırlı), tam ekranda ekran kadar', () => {
  assert.equal(grafikYuksekligi(500, 900, false), 240)
  assert.equal(grafikYuksekligi(1200, 900, false), 405)
  assert.equal(grafikYuksekligi(1200, 2000, false), 520)
  assert.equal(grafikYuksekligi(1200, 600, false), 340)
  assert.equal(grafikYuksekligi(1800, 1080, true), 820)
})

test('yumusat: her nokta, o ana kadarki son 10 sn ortancası (sistemin "birlikte" kararıyla aynı)', () => {
  const ham = [[12, -90], [10, -50], [8, -52], [6, -88], [4, -51], [2, -53], [0, -50]]
  assert.deepEqual(yumusat(ham).map(([, v]) => v), [-90, -70, -52, -70, -52, -52, -52])
  assert.deepEqual(yumusat(ham).map(([sn]) => sn), [12, 10, 8, 6, 4, 2, 0])
})

test('grafikSerileri birlikte: yalnız 1 dk+ birlikte sayılan çiftler; kalabalıkta kart no sırasıyla ilk N (sabit)', () => {
  const birlikte = new Set(['3-10', '4-10', '10-11'])
  const { seriler, toplam, birlikteSayisi } = grafikSerileri(H, PEOPLE, { birlikte, enCok: 2 })
  assert.deepEqual(seriler.map((s) => s.anahtar), ['3-10', '4-10'], 'güce göre değil kart no sırasıyla: değer oynasa da liste değişmez')
  assert.equal(toplam, 4)
  assert.equal(birlikteSayisi, 3)
  assert.deepEqual(grafikSerileri(H, PEOPLE, { birlikte, hepsi: true }).seriler.length, 4, '"Tümünü göster" hepsini çizer')
  assert.deepEqual(grafikSerileri(H, PEOPLE, { birlikte, kisiId: '3' }).seriler.map((s) => s.anahtar), ['3-4', '3-10'],
    'kişi seçilince o kişinin bütün çiftleri')
})

test('birlikteAnahtarlari: signals[].together → history anahtarı ("küçük-büyük")', () => {
  const s = [{ a: '10', b: '3', together: true }, { a: '4', b: '10', together: false }]
  assert.deepEqual([...birlikteAnahtarlari(s)], ['3-10'])
})
