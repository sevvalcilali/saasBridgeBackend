// Rapor CSV dışa aktarma (brief §4.4, §9-9). Türkçe Excel uyumlu: UTF-8 BOM, ";"
// ayraç, ondalıkta virgül, gerekirse tırnak. Tarayıcıda üretilir (sunucu beklenmez).
import { raporAdi, kisiDurumYazisi, etkinlikSaati, oturumSuresiSn } from './rapor.js'

const ROL = { investor: 'Yatırımcı', founder: 'Girişimci', guest: 'Misafir' }

export function csvAlan(v) {
  const s = v == null ? '' : String(v)
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const csvMetni = (basliklar, satirlar) =>
  '﻿' + [basliklar, ...satirlar].map((r) => r.map(csvAlan).join(';')).join('\r\n') + '\r\n'

// Dakika, tek ondalık, Türkçe virgül: 1540 sn → "25,7"
export const dakikaCsv = (sn) => (Math.round((sn / 60) * 10) / 10).toFixed(1).replace('.', ',')

const ASAMA = { fikir: 'Fikir', mvp: 'MVP', gelir: 'Gelir', buyume: 'Büyüme' }

export function katilimcilarCsv(rapor) {
  return csvMetni(
    ['Ad', 'Rol', 'Kurum', 'Yıldız', 'Kart', 'Toplam (dk)', 'Görüşme', 'Görüştüğü kişi', 'Karşı rolden kişi',
      'Sektör / ilgi alanı', 'Aşama', 'E-posta', 'Paylaşım izni'],
    rapor.kisiSatirlari.map((r) => [
      r.kisi.ad, ROL[r.kisi.rol] ?? '', r.kisi.kurum ?? '', r.kisi.yildiz || '',
      kisiDurumYazisi(r.kisi), dakikaCsv(r.toplamSn), r.gorusmeSayisi, r.kisiSayisi,
      r.kisi.rol === 'investor' || r.kisi.rol === 'founder' ? r.karsiRolSayisi : '',
      r.kisi.sektor ?? '', ASAMA[r.kisi.asama] ?? '', r.kisi.eposta ?? '', r.kisi.paylasim ? 'evet' : 'hayır',
    ]),
  )
}

// Görüşmeler: kişi kimliği → kayıt; saat "HH:MM" (etkinlik saati), sürmekte olan "sürüyor".
export function gorusmelerCsv(oturumlar, kisiler, simdi, saat) {
  const harita = new Map(kisiler.map((k) => [k.kisiId, k]))
  const ad = (id) => (harita.has(id) ? raporAdi(harita.get(id)) : `Kart ${id.replace('kart:', '')} (kayıtsız)`)
  return csvMetni(
    ['Kişi', 'Kiminle', 'Başlangıç', 'Bitiş', 'Süre (dk)'],
    [...oturumlar].sort((p, q) => p.start - q.start).map((o) => [
      ad(o.a), ad(o.b), etkinlikSaati(o.start, saat, simdi),
      o.end === null ? 'sürüyor' : etkinlikSaati(o.end, saat, simdi), dakikaCsv(oturumSuresiSn(o, simdi)),
    ]),
  )
}

// Dosya adı: "katilimcilar-30-09-2026.csv" (tarih rapor anından).
export function dosyaAdi(on, d) {
  const iki = (n) => String(n).padStart(2, '0')
  return `${on}-${iki(d.getDate())}-${iki(d.getMonth() + 1)}-${d.getFullYear()}.csv`
}

// Tarayıcıda dosya indir (DOM; testte çağrılmaz).
export function csvIndir(dosyaAdi, metin) {
  const url = URL.createObjectURL(new Blob([metin], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: dosyaAdi })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
