// CSV dışa aktarma: Türkçe Excel biçimi, tırnaklama, geri okunabilirlik.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvAlan, csvMetni, dakikaCsv, katilimcilarCsv, gorusmelerCsv, dosyaAdi } from './csvDisa.js'
import { raporHesapla } from './rapor.js'

// Basit ";" CSV okuyucu (tırnaklı alanlar dahil) — üretilen dosyayı geri okumak için.
function oku(metin) {
  const satirlar = []; let satir = [], alan = '', tirnak = false
  const m = metin.replace(/^﻿/, '')
  for (let i = 0; i < m.length; i++) {
    const c = m[i]
    if (tirnak) { if (c === '"' && m[i + 1] === '"') { alan += '"'; i++ } else if (c === '"') tirnak = false; else alan += c }
    else if (c === '"') tirnak = true
    else if (c === ';') { satir.push(alan); alan = '' }
    else if (c === '\r') continue
    else if (c === '\n') { satir.push(alan); satirlar.push(satir); satir = []; alan = '' }
    else alan += c
  }
  return satirlar
}

test('csvAlan / csvMetni: BOM, ";" ayraç, CRLF, gerektiğinde tırnak', () => {
  assert.equal(csvAlan('Veri; Köprüsü'), '"Veri; Köprüsü"')
  assert.equal(csvAlan('5"lik'), '"5""lik"')
  assert.equal(csvAlan(null), '')
  const m = csvMetni(['A', 'B'], [['x', 'y;z']])
  assert.ok(m.startsWith('﻿A;B\r\n'))
  assert.deepEqual(oku(m), [['A', 'B'], ['x', 'y;z']])
})

test('dakikaCsv: tek ondalık, virgül', () => {
  assert.equal(dakikaCsv(1540), '25,7')
  assert.equal(dakikaCsv(0), '0,0')
})

const K = [
  { kisiId: 'k1', ad: 'Ayşe Şahin', rol: 'investor', kurum: 'Atlas', yildiz: 3, atananKart: '10', ayrildi: false },
  { kisiId: 'k2', ad: 'Cem Öz', rol: 'founder', kurum: 'Veri; Köprüsü', yildiz: 0, atananKart: null, ayrildi: true },
]
const O = [{ a: 'k1', b: 'k2', start: 60, end: 660 }, { a: 'k2', b: 'kart:14', start: 700, end: null }]

test('katilimcilarCsv: her kayıtlı kişi bir satır, Türkçe ve tırnaklı alan geri okunur', () => {
  const r = oku(katilimcilarCsv(raporHesapla(K, O, 1000)))
  assert.equal(r.length, 1 + K.length)
  assert.deepEqual(r[0], ['Ad', 'Rol', 'Kurum', 'Yıldız', 'Kart', 'Toplam (dk)', 'Görüşme', 'Görüştüğü kişi', 'Karşı rolden kişi',
    'Sektör / ilgi alanı', 'Aşama', 'E-posta', 'Paylaşım izni'])
  const cem = r.find((x) => x[0] === 'Cem Öz')
  assert.deepEqual(cem, ['Cem Öz', 'Girişimci', 'Veri; Köprüsü', '', 'ayrıldı', '15,0', '2', '2', '1', '', '', '', 'hayır'])
})

test('gorusmelerCsv: başlangıca göre; saat; sürüyor; kayıtsız kart', () => {
  const r = oku(gorusmelerCsv(O, K, 1000, '14:00:00'))
  assert.deepEqual(r[1], ['Ayşe Şahin', 'Veri; Köprüsü · Cem Öz', '13:44', '13:54', '10,0'])
  assert.deepEqual(r[2], ['Veri; Köprüsü · Cem Öz', 'Kart 14 (kayıtsız)', '13:55', 'sürüyor', '5,0'])
})

test('dosyaAdi', () => {
  assert.equal(dosyaAdi('katilimcilar', new Date(2026, 8, 30, 14, 5)), 'katilimcilar-30-09-2026.csv')
})
