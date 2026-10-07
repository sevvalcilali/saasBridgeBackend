// tokens.css sözleşme testi — iki tema (açık varsayılan, koyu) ayrı ayrı:
// WCAG kontrastı, durum renkleri ve kişi paletinin ayırt edilebilirliği.
// Kişi paleti dataviz doğrulayıcısının ölçütleriyle denetlenir (Faz 5):
// normal görüşte TÜM çiftler OKLab ΔE ≥15; renk körlüğünde (protan/deutan)
// sunucu sırasındaki komşular ≥8; her renk yüzeyde ≥3:1; kroma ≥0.10.
// Yeşil yalnız "birlikte" durumunun rengi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { temaTokenlari } from './tokenOku.js'
import { kontrast, farkOklab, kroma } from './renkOlcum.js'

// Sunucu paletinin sırası (brief §10): mavi, turuncu, [yeşilimsi→petrol], hardal, pembe, mor, mercan.
const SIRALI = ['kisi-mavi', 'kisi-turuncu', 'kisi-petrol', 'kisi-hardal', 'kisi-pembe', 'kisi-mor', 'kisi-mercan']
const KISI_PALETI = [...SIRALI, 'kisi-gri']
const TEMALAR = Object.entries(temaTokenlari())

for (const [tema, t] of TEMALAR) {
  test(`${tema}: temel token seti tanımlı`, () => {
    const gerekli = [
      'zemin', 'yuzey', 'yuzey-2', 'cizgi', 'metin', 'metin-2', 'metin-ters', 'vurgu',
      'birlikte', 'birlikte-zemin', 'olumlu', 'olumlu-zemin',
      'uyari', 'uyari-zemin', 'ciddi', 'ciddi-zemin', ...KISI_PALETI,
    ]
    for (const ad of gerekli) assert.ok(t[ad], `--${ad} eksik`)
  })

  test(`${tema}: metin renkleri zeminde okunur (WCAG)`, () => {
    for (const yzy of ['zemin', 'yuzey', 'yuzey-2']) {
      assert.ok(kontrast(t.metin, t[yzy]) >= 7, `metin/${yzy}: ${kontrast(t.metin, t[yzy]).toFixed(2)} < 7`)
      assert.ok(kontrast(t['metin-2'], t[yzy]) >= 4.5, `metin-2/${yzy}: ${kontrast(t['metin-2'], t[yzy]).toFixed(2)} < 4.5`)
    }
    assert.ok(kontrast(t['metin-ters'], t.vurgu) >= 4.5, `metin-ters/vurgu: ${kontrast(t['metin-ters'], t.vurgu).toFixed(2)}`)
  })

  test(`${tema}: durum renkleri kendi zemininde ve yüzeyde okunur`, () => {
    for (const durum of ['birlikte', 'olumlu', 'uyari', 'ciddi']) {
      assert.ok(kontrast(t[durum], t[`${durum}-zemin`]) >= 4.5,
        `${durum} / ${durum}-zemin: ${kontrast(t[durum], t[`${durum}-zemin`]).toFixed(2)} < 4.5`)
      assert.ok(kontrast(t[durum], t.yuzey) >= 4.5,
        `${durum} / yuzey: ${kontrast(t[durum], t.yuzey).toFixed(2)} < 4.5`)
    }
  })

  test(`${tema}: kişi paleti yüzeyde görünür (≥3:1) ve gri okunmaz (kroma ≥0.10)`, () => {
    for (const ad of KISI_PALETI) {
      for (const yzy of ['zemin', 'yuzey', 'yuzey-2']) {
        assert.ok(kontrast(t[ad], t[yzy]) >= 3, `--${ad}/${yzy}: ${kontrast(t[ad], t[yzy]).toFixed(2)} < 3`)
      }
    }
    for (const ad of SIRALI) assert.ok(kroma(t[ad]) >= 0.1, `--${ad} kroma ${kroma(t[ad]).toFixed(3)}`)
  })

  test(`${tema}: yeşil paletten çıkarıldı — hiçbir kişi rengi "birlikte" yeşiline yakın değil`, () => {
    for (const ad of KISI_PALETI) {
      const d = farkOklab(t[ad], t.birlikte)
      assert.ok(d >= 15, `--${ad} birlikte-yeşiline çok yakın (ΔE ${d.toFixed(1)})`)
    }
  })

  test(`${tema}: kişi renkleri normal görüşte birbirinden ayırt edilir (tüm çiftler ΔE ≥15)`, () => {
    for (let i = 0; i < KISI_PALETI.length; i++) {
      for (let j = i + 1; j < KISI_PALETI.length; j++) {
        const d = farkOklab(t[KISI_PALETI[i]], t[KISI_PALETI[j]])
        assert.ok(d >= 15, `${KISI_PALETI[i]} ↔ ${KISI_PALETI[j]}: ΔE ${d.toFixed(1)} < 15`)
      }
    }
  })

  test(`${tema}: renk körlüğünde sıra komşuları ayırt edilir (protan/deutan ΔE ≥8)`, () => {
    for (let i = 0; i < SIRALI.length; i++) {
      const [a, b] = [SIRALI[i], SIRALI[(i + 1) % SIRALI.length]]
      for (const tur of ['protan', 'deutan']) {
        const d = farkOklab(t[a], t[b], tur)
        assert.ok(d >= 8, `${a} ↔ ${b} (${tur}): ΔE ${d.toFixed(1)} < 8`)
      }
    }
  })
}
