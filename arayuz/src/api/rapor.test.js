// Rapor: kişi/çift toplamları, girişimci → yatırımcı, en uzunlar, ayrılanlar, saat.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { raporHesapla, kisiOturumlari, oturumSuresiSn, etkinlikSaati, raporAdi, kisaAd, kisiDurumYazisi, cizelgeAraligi, cizelgeYuzde, yatirimciMatrisi, kisiRaporu, ilgiEslesir,
  gunIciYogunluk, gucluEslesmeler, onerilenTanistirmalar, takipListesi } from './rapor.js'

const K = [
  { kisiId: 'k1', ad: 'Ayşe Demir', rol: 'investor', kurum: 'Atlas', atananKart: '10', ayrildi: false },
  { kisiId: 'k2', ad: 'Cem Erdem', rol: 'founder', kurum: 'Nova Robotik', atananKart: null, ayrildi: true }, // ayrıldı
  { kisiId: 'k3', ad: 'Deniz Koç', rol: 'founder', kurum: 'Peak', atananKart: '12', ayrildi: false },
  { kisiId: 'k4', ad: 'Ece Şen', rol: 'guest', kurum: '', atananKart: '13', ayrildi: false },
  { kisiId: 'k5', ad: 'Onur Tan', rol: 'founder', kurum: 'Gök', atananKart: null, ayrildi: false },   // kart almadı
]
const O = [
  { a: 'k1', b: 'k2', start: 100, end: 400 },     // 300 sn, karma
  { a: 'k2', b: 'k1', start: 900, end: 1000 },    // 100 sn, aynı çift (ters yön)
  { a: 'k1', b: 'k3', start: 1000, end: null },   // sürüyor: simdi 1600 → 600 sn, karma
  { a: 'k3', b: 'k4', start: 200, end: 260 },     // 60 sn, karma değil
  { a: 'kart:14', b: 'k4', start: 300, end: 330 },// kayıtsız kart
]
const SIMDI = 1600

test('oturumSuresiSn: sürmekte olan şimdiye kadar', () => {
  assert.equal(oturumSuresiSn(O[0], SIMDI), 300)
  assert.equal(oturumSuresiSn(O[2], SIMDI), 600)
})

test('raporHesapla: özet; ayrılan kişi raporda; hiç görüşmeyen de listede', () => {
  const r = raporHesapla(K, O, SIMDI)
  assert.deepEqual(r.ozet, { gorusme: 5, suren: 1, karmaSn: 1000, ulasan: 2, girisimci: 3, yatirimci: 1, misafir: 1, kisi: 5, ayrilan: 1, ortalamaSn: 218 })
  const cem = r.kisiSatirlari.find((x) => x.kisi.kisiId === 'k2')
  assert.equal(cem.toplamSn, 400, 'ayrılan kişinin süresi silinmez')
  assert.equal(cem.gorusmeSayisi, 2); assert.equal(cem.kisiSayisi, 1); assert.equal(cem.karsiRolSayisi, 1)
  const ayse = r.kisiSatirlari[0]
  assert.equal(ayse.kisi.kisiId, 'k1', 'en uzun toplam üstte'); assert.equal(ayse.toplamSn, 1000)
  assert.equal(r.kisiSatirlari.find((x) => x.kisi.kisiId === 'k5').toplamSn, 0)
  assert.equal(r.kisiSatirlari.length, K.length, 'katılımcı tablosu yalnız kayıtlılar (özetle aynı sayı)')
  assert.ok(r.ciftler.some((c) => c.a.ad === 'Kart 14 (kayıtsız)' || c.b.ad === 'Kart 14 (kayıtsız)'), 'kayıtsız kartın görüşmesi çiftlerde kalır')
})

test('raporHesapla: çift toplamları yönden bağımsız; girişimci → yatırımcı; en uzunlar', () => {
  const r = raporHesapla(K, O, SIMDI)
  const ac = r.ciftler.find((c) => [c.a.kisiId, c.b.kisiId].sort().join() === 'k1,k2')
  assert.equal(ac.toplamSn, 400); assert.equal(ac.adet, 2)
  assert.equal(r.ciftler[0].toplamSn, 600)
  const g = Object.fromEntries(r.girisimciler.map((x) => [x.kisi.kisiId, x]))
  assert.deepEqual(g.k3.yatirimcilar.map((y) => [y.kisi.kisiId, y.toplamSn]), [['k1', 600]])
  assert.equal(g.k5.yatirimcilar.length, 0, 'hiç ulaşamayan')
  assert.equal(r.girisimciler.at(-1).kisi.kisiId, 'k5', 'ulaşamayan en altta')
  assert.deepEqual(r.enUzun.map((x) => x.sureSn), [600, 300, 100, 60, 30])
  assert.equal(r.enUzun[0].suruyor, true)
})

test('kisiOturumlari: başlangıca göre, karşı kişi ve süre', () => {
  const l = kisiOturumlari('k1', O, K, SIMDI)
  assert.deepEqual(l.map((x) => [x.karsi.kisiId, x.sureSn, x.suruyor]), [['k2', 300, false], ['k2', 100, false], ['k3', 600, true]])
  assert.equal(kisiOturumlari('k4', O, K, SIMDI)[1].karsi.ad, 'Kart 14 (kayıtsız)')
})

test('etkinlikSaati: şimdiki saat − elapsed + sn; gece yarısını sarar', () => {
  assert.equal(etkinlikSaati(0, '14:05:30', 3600), '13:05')
  assert.equal(etkinlikSaati(1800, '14:05:30', 3600), '13:35')
  assert.equal(etkinlikSaati(0, '00:30:00', 3600), '23:30')
})

test('raporAdi / kisiDurumYazisi', () => {
  assert.equal(raporAdi(K[1]), 'Nova Robotik · Cem Erdem')
  assert.equal(raporAdi(K[0]), 'Ayşe Demir')
  assert.equal(kisaAd(K[1]), 'Nova Robotik')
  assert.equal(kisaAd(K[0]), 'Ayşe Demir')
  assert.equal(kisiDurumYazisi(K[0]), 'Kart 10')
  assert.equal(kisiDurumYazisi(K[1]), 'ayrıldı')
  assert.equal(kisiDurumYazisi(K[4]), 'kart almadı')
})

test('cizelgeAraligi / cizelgeYuzde: ilk görüşme → şimdi; boşta en az 1 dk', () => {
  const a = cizelgeAraligi(O, SIMDI)
  assert.deepEqual(a, { bas: 100, son: 1600 })
  assert.equal(cizelgeYuzde(100, a), 0)
  assert.equal(cizelgeYuzde(1600, a), 100)
  assert.equal(cizelgeYuzde(850, a), 50)
  assert.deepEqual(cizelgeAraligi([], 10), { bas: 0, son: 60 })
})

test('yatirimciMatrisi: satır yatırımcı, sütun girişimci, hücre birlikte geçen sn; görüşmeyen de listede', () => {
  const kisiler = [...K, { kisiId: 'k6', ad: 'Fuat Ak', rol: 'investor', kurum: 'Fon', atananKart: '15', ayrildi: false }]
  const m = yatirimciMatrisi(raporHesapla(kisiler, O, SIMDI), kisiler)
  assert.deepEqual(m.satirlar.map((k) => k.kisiId), ['k1', 'k6'], 'en çok görüşen yatırımcı üstte; hiç görüşmeyen de var')
  assert.deepEqual(m.sutunlar.map((k) => k.kisiId), ['k3', 'k2', 'k5'], 'girişimciler rapordaki sırayla')
  assert.equal(m.hucre.get('k1|k2'), 400)
  assert.equal(m.hucre.get('k1|k3'), 600)
  assert.equal(m.hucre.get('k6|k3'), undefined)
  assert.equal(m.enCok, 600)
})

test('kisiRaporu: karşı rol süreye göre, ilk saat, anlaşma; aynı rol ayrı; gelip görüşülmeyenler "kaçırdıkların"', () => {
  const kisiler = [...K, { kisiId: 'k7', ad: 'Gül Ay', rol: 'founder', kurum: 'Mavi', atananKart: '20', ayrildi: false }]
  const alerts = [{ kind: 'deal', kisiler: ['k3', 'k1'] }, { kind: 'repeat', kisiler: ['k2', 'k1'] }]
  const r = kisiRaporu('k1', kisiler, O, SIMDI, { saat: '10:00:00', elapsed: SIMDI, alerts })

  assert.equal(r.kisi.kisiId, 'k1')
  assert.deepEqual(r.karsi.map((x) => [x.kisi.kisiId, x.toplamSn, x.adet, x.ilkSaat, x.anlasma]),
    [['k3', 600, 1, '09:50', true], ['k2', 400, 2, '09:35', false]])
  assert.deepEqual(r.diger, [])
  assert.deepEqual(r.kacirilan.map((k) => k.kisiId), ['k7'], 'k5 hiç kart almadı (gelmedi): kaçırılan sayılmaz')
  assert.deepEqual(r.ozet, { karsiSayisi: 2, karsiSn: 1000, toplamSn: 1000, anlasma: 1 })
})

test('kisiRaporu girişimci için: karşı rol yatırımcılar, misafir "diğer"', () => {
  const r = kisiRaporu('k3', K, O, SIMDI, { saat: '10:00:00', elapsed: SIMDI, alerts: [] })
  assert.deepEqual(r.karsi.map((x) => x.kisi.kisiId), ['k1'])
  assert.deepEqual(r.diger.map((x) => [x.kisi.kisiId, x.toplamSn]), [['k4', 60]])
})

test('kisiRaporu: kayıtsız kart ("kart:N") katılımcıya gösterilmez', () => {
  const r = kisiRaporu('k4', K, O, SIMDI, {})
  assert.deepEqual(r.diger.map((x) => x.kisi.kisiId), ['k3'])
})

test('ilgiEslesir: yatırımcının ilgi alanları (virgüllü) girişimin sektörünü içeriyor mu; büyük-küçük ve Türkçe harf farkı yok', () => {
  assert.equal(ilgiEslesir('Sağlık, Enerji', 'sağlık'), true)
  assert.equal(ilgiEslesir('SAĞLIK;Enerji', 'Enerji'), true)
  assert.equal(ilgiEslesir('Fintek', 'Sağlık'), false)
  assert.equal(ilgiEslesir('', 'Sağlık'), false)
  assert.equal(ilgiEslesir('Sağlık', ''), false)
})

test('kisiRaporu kaçırılanlar: yatırımcının ilgi alanındaki girişimler önde ve işaretli', () => {
  const kisiler = [
    { ...K[0], sektor: 'Sağlık, Enerji' },
    ...K.slice(1),
    { kisiId: 'k7', ad: 'Gül Ay', rol: 'founder', kurum: 'Ağaç', sektor: 'Tarım', atananKart: '20', ayrildi: false },
    { kisiId: 'k8', ad: 'Ali Su', rol: 'founder', kurum: 'Zirve', sektor: 'Sağlık', atananKart: '21', ayrildi: false },
  ]
  const r = kisiRaporu('k1', kisiler, O, SIMDI, {})
  assert.deepEqual(r.kacirilan.map((k) => k.kisiId), ['k8', 'k7'], 'ad sırası Ağaç < Zirve olsa da ilgi alanındaki önde')
  assert.deepEqual([...r.ilgiAlaninda], ['k8'])
})

test('raporHesapla yatırımcılar: görüştüğü girişimciler süreye göre; hiç görüşmeyen en altta', () => {
  const kisiler = [...K, { kisiId: 'k6', ad: 'Fuat Ak', rol: 'investor', kurum: 'Fon', atananKart: '15', ayrildi: false }]
  const r = raporHesapla(kisiler, O, SIMDI)
  assert.deepEqual(r.yatirimcilar.map((y) => [y.kisi.kisiId, y.girisimciler.map((g) => [g.kisi.kisiId, g.toplamSn]), y.girisimciSn]),
    [['k1', [['k3', 600], ['k2', 400]], 1000], ['k6', [], 0]])
})

test('gunIciYogunluk: dilim başına süren görüşme sayısı; en yoğun dilim; boşta boş', () => {
  const y = gunIciYogunluk(O, SIMDI)
  assert.equal(y.dilimSn, 300, '25 dk aralık → 5 dk dilim')
  assert.deepEqual(y.dilimler.map((d) => [d.bas, d.son, d.adet]),
    [[100, 400, 3], [400, 700, 0], [700, 1000, 1], [1000, 1300, 1], [1300, 1600, 1]])
  assert.deepEqual(y.enYogun, { bas: 100, son: 400, adet: 3 })
  assert.deepEqual(gunIciYogunluk([], 50), { dilimSn: 300, dilimler: [], enYogun: null })
})

test('gunIciYogunluk: dilimler saatin katlarına hizalanır; uzun etkinlikte dilim büyür', () => {
  const y = gunIciYogunluk(O, SIMDI, { saat: '10:00:10', elapsed: SIMDI })
  assert.equal(y.dilimler[0].bas, 90, 'etkinlik 0. sn = 09:33:30 → ilk görüşme (100) 09:35:10; dilim 09:35:00 başlar')
  assert.ok(y.dilimler.at(-1).son >= SIMDI)
  assert.equal(gunIciYogunluk([{ a: 'k1', b: 'k2', start: 0, end: 4 * 3600 }], 4 * 3600).dilimSn, 900)
  assert.equal(gunIciYogunluk([{ a: 'k1', b: 'k2', start: 0, end: 8 * 3600 }], 8 * 3600).dilimSn, 1800)
})

test('gucluEslesmeler: yalnız yatırımcı–girişimci çiftleri, toplam süreye göre; anlaşma işareti', () => {
  const r = raporHesapla(K, O, SIMDI)
  const e = gucluEslesmeler(r, [{ kind: 'deal', kisiler: ['k3', 'k1'] }])
  assert.deepEqual(e.map((x) => [x.yatirimci.kisiId, x.girisimci.kisiId, x.toplamSn, x.adet, x.anlasma]),
    [['k1', 'k3', 600, 1, true], ['k1', 'k2', 400, 2, false]])
  assert.equal(gucluEslesmeler(r, [], 1).length, 1)
})

test('onerilenTanistirmalar: ilgi alanı tutan ama hiç yan yana gelmemiş, ikisi de gelmiş çiftler', () => {
  const kisiler = [
    { ...K[0], sektor: 'Sağlık, Enerji', yildiz: 3 },
    { ...K[1], sektor: 'Enerji' }, // görüştü
    { ...K[2], sektor: 'Sağlık' }, // görüştü
    K[3],
    { ...K[4], sektor: 'Sağlık' }, // kart almadı: gelmedi
    { kisiId: 'k8', ad: 'Ali Su', rol: 'founder', kurum: 'Zirve', sektor: 'Sağlık', atananKart: '21', ayrildi: false },
    { kisiId: 'k9', ad: 'Can Er', rol: 'founder', kurum: 'Bulut', sektor: 'Fintek', atananKart: '22', ayrildi: false },
  ]
  assert.deepEqual(onerilenTanistirmalar(kisiler, O).map((x) => [x.yatirimci.kisiId, x.girisimci.kisiId, x.sektor]),
    [['k1', 'k8', 'Sağlık']])
})

test('takipListesi: gelmiş ama karşı rolle hiç görüşmemiş girişimci ve yatırımcılar', () => {
  const kisiler = [...K,
    { kisiId: 'k6', ad: 'Fuat Ak', rol: 'investor', kurum: 'Fon', atananKart: '15', ayrildi: false },
    { kisiId: 'k7', ad: 'Gül Ay', rol: 'founder', kurum: 'Mavi', atananKart: '20', ayrildi: false }]
  const t = takipListesi(raporHesapla(kisiler, O, SIMDI))
  assert.deepEqual(t.girisimciler.map((k) => k.kisiId), ['k7'], 'k5 kart almadı (gelmedi): listede yok')
  assert.deepEqual(t.yatirimcilar.map((k) => k.kisiId), ['k6'])
})

test('gunIciYogunluk: tam şimdi başlayan (sıfır süreli) görüşme de sayılır', () => {
  const y = gunIciYogunluk([{ a: 'k1', b: 'k2', start: 500, end: null }], 500)
  assert.equal(y.dilimler.reduce((t, d) => t + d.adet, 0), 1)
  assert.equal(y.enYogun.adet, 1)
})
