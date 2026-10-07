// Ego görünümü yerleşimi: seçili kişi ortada, gün boyu görüştüğü herkes çevresinde bir halkada (en uzun
// görüşülen tepede, saat yönünde azalan). Çizgi kalınlığı süre. Geçmiş çizgileri yalnız istenince ve yalnız
// o kişi için çizilir: eski ağdaki yumak oluşmaz. Konum fiziksel konum DEĞİLDİR.
import { kisiGorusmeleri } from './durum.js'

export const EGO_EN_COK = 16 // daha çok eşte en uzun 16 gösterilir, kalanı "+N"
const KALIN_EN_AZ = 2, KALIN_EN_COK = 12
const anahtar = (a, b) => (Number(a) < Number(b) ? `${a}-${b}` : `${b}-${a}`)

export function egoYerlesimi(kisiId, people, edges, live = [], { w = 1000, h = 640, enCok = EGO_EN_COK } = {}) {
  const kisi = people.find((p) => p.id === kisiId)
  const tum = kisiGorusmeleri(kisiId, edges, people)
  const gorunen = tum.slice(0, enCok)
  const simdi = new Set(live.map((c) => anahtar(c.a, c.b)))
  const enUzun = Math.max(...gorunen.map((g) => g.min), 0)
  const merkez = { kisi, x: w / 2, y: h / 2 }
  const rx = w * 0.25, ry = h * 0.38 // yanlarda ad etiketlerine yer kalsın
  const esler = gorunen.map((g, i) => {
    const aci = -Math.PI / 2 + (2 * Math.PI * i) / gorunen.length
    const roller = new Set([kisi?.role, g.kisi.role])
    const [cos, sin] = [Math.cos(aci), Math.sin(aci)]
    return {
      kisi: g.kisi,
      min: g.min,
      simdi: simdi.has(anahtar(kisiId, g.kisi.id)),
      karma: roller.has('investor') && roller.has('founder'),
      x: merkez.x + rx * cos,
      y: merkez.y + ry * sin,
      // Etiket düğümün dışına: komşu etiketler ve çizgilerle çakışmasın.
      yon: cos > 0.12 ? 'sag' : cos < -0.12 ? 'sol' : sin < 0 ? 'ust' : 'alt',
      cos, sin, // etiket merkezden dışarı, bu yönde itilir
      kalinlik: enUzun > 0 ? KALIN_EN_AZ + ((KALIN_EN_COK - KALIN_EN_AZ) * g.min) / enUzun : KALIN_EN_AZ,
    }
  })
  return { merkez, esler, fazla: tum.length - gorunen.length }
}
