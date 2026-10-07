// Kişi arama + filtre mantığı — JSX içinde değil, saf ve test edilebilir.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filtreleKisiler, FILTRELER } from './filtre.js'

const KISILER = [
  { id: '10', role: 'investor', name: 'Ayşe Demir', org: 'Atlas Ventures', status: 'talking', invPeers: 2 },
  { id: '11', role: 'investor', name: 'Mehmet Kılıç', org: 'Boğaz Capital', status: 'idle', invPeers: 0 },
  { id: '12', role: 'founder', name: 'Cem Erdem', org: 'Nova Robotik', status: 'talking', invPeers: 1 },
  { id: '13', role: 'founder', name: 'İrem Korkmaz', org: 'Peak Enerji', status: 'idle', invPeers: 0 },
  { id: '14', role: 'founder', name: 'Onur Çelik', org: 'Bitki Teknoloji', status: 'away', invPeers: 0 },
  { id: '15', role: 'guest', name: 'Kerem Tekin', org: '', status: 'idle', invPeers: 0 },
]

const idler = (l) => l.map((k) => k.id)

test('varsayılan: hepsi', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, {})), ['10', '11', '12', '13', '14', '15'])
})

test('rol filtresi: yatırımcı / girişimci', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'investor' })), ['10', '11'])
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'founder' })), ['12', '13', '14'])
})

test('durum filtresi: birlikte / boşta / görünmüyor', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'talking' })), ['10', '12'])
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'idle' })), ['11', '13', '15'])
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'away' })), ['14'])
})

test('hiç görüşmemiş: yalnız invPeers=0 girişimciler (misafir/yatırımcı hariç)', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'gorusmemis' })), ['13', '14'])
})

test('misafir filtresi', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'guest' })), ['15'])
})

test('yalnız kaldı: şu an boşta olan yatırımcılar (girişimci/misafir ve birlikte olanlar hariç)', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'yalniz' })), ['11'])
})

test('arama: ad, kurum ve kart no üzerinde', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { arama: 'nova' })), ['12'])       // kurum
  assert.deepEqual(idler(filtreleKisiler(KISILER, { arama: 'kılıç' })), ['11'])      // ad
  assert.deepEqual(idler(filtreleKisiler(KISILER, { arama: '14' })), ['14'])         // kart no
})

test('arama: Türkçe büyük-küçük harf duyarsız', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { arama: 'AYŞE' })), ['10'])
  assert.deepEqual(idler(filtreleKisiler(KISILER, { arama: 'irem' })), ['13'])
  assert.deepEqual(idler(filtreleKisiler(KISILER, { arama: 'İREM' })), ['13'])
})

test('arama boşlukları kırpar, boş arama hepsini bırakır', () => {
  assert.equal(filtreleKisiler(KISILER, { arama: '   ' }).length, 6)
})

test('arama + filtre birlikte uygulanır', () => {
  assert.deepEqual(idler(filtreleKisiler(KISILER, { filtre: 'founder', arama: 'peak' })), ['13'])
})

test('FILTRELER listesi UI için sıralı ve etiketli', () => {
  assert.equal(FILTRELER[0].deger, 'tumu')
  assert.ok(FILTRELER.every((f) => typeof f.etiket === 'string' && f.etiket.length))
  assert.deepEqual(
    FILTRELER.map((f) => f.deger),
    ['tumu', 'investor', 'founder', 'guest', 'talking', 'idle', 'away', 'yalniz', 'gorusmemis'],
  )
})
