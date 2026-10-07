// Testler için: tokens.css'teki iki temanın hex token'larını ayrı ayrı okur.
// Açık = ilk :root bloğu; koyu = :root[data-tema="koyu"] bloğu (açık üstüne yazılır).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cssYolu = fileURLToPath(new URL('./tokens.css', import.meta.url))

function blokTokenlari(blok) {
  const t = {}
  for (const [, ad, deger] of blok.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) t[ad] = deger.toLowerCase()
  return t
}

export function temaTokenlari() {
  const css = readFileSync(cssYolu, 'utf8')
  const acik = blokTokenlari(css.match(/:root\s*\{([^}]*)\}/)[1])
  const koyuBlok = css.match(/:root\[data-tema="koyu"\]\s*\{([^}]*)\}/)
  const koyu = { ...acik, ...blokTokenlari(koyuBlok ? koyuBlok[1] : '') }
  return { acik, koyu }
}
