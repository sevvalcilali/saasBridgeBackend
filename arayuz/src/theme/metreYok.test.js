// Brief §1 (pazarlıksız): arayüzde hiçbir yerde metre/cm olmayacak — sinyal gücü
// mesafeye güvenilir biçimde çevrilemez. Ekran metinlerinde (yorumlar hariç) mesafe birimi aranır.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('..', import.meta.url))
function dosyalar(dizin) {
  return readdirSync(dizin).flatMap((a) => {
    const yol = join(dizin, a)
    if (statSync(yol).isDirectory()) return dosyalar(yol)
    return /\.(jsx|js)$/.test(a) && !a.endsWith('.test.js') ? [yol] : []
  })
}

test('arayüz kaynağında metre/cm/mm yok', () => {
  const ihlal = []
  for (const yol of dosyalar(SRC)) {
    readFileSync(yol, 'utf8').split('\n').forEach((ham, i) => {
      // Yorumlar ekranda görünmez (kuralı hatırlatan "metre yok" gibi notlar serbest)
      if (/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(ham)) return
      const satir = ham.replace(/\s\/\/.*$/, '')
      if (/\d\s*[–-]?\s*\d*\s*(cm|mm|km)\b/i.test(satir) || /\bmetre/i.test(satir)) {
        ihlal.push(`${yol.replace(SRC, 'src/')}:${i + 1}: ${ham.trim()}`)
      }
    })
  }
  assert.deepEqual(ihlal, [])
})
