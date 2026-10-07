// Testler için renk ölçümleri: WCAG kontrastı, OKLab ΔE (×100) ve renk körlüğü
// benzetimi (Machado-Oliveira-Fernandes 2009, şiddet 1.0). Eşikler dataviz
// doğrulayıcısıyla aynı: normal görüş ΔE ≥15, protan/deutan ΔE ≥8.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const dogrusal = (k) => (k <= 0.04045 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4)
const sinirla = (c) => Math.max(0, Math.min(1, c))

function luminans(hex) {
  const [r, g, b] = rgb(hex).map(dogrusal)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function kontrast(a, b) {
  const [l1, l2] = [luminans(a), luminans(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
}

function benzet(hex, tur) {
  const d = rgb(hex).map(dogrusal)
  if (!tur) return d
  return MACHADO[tur].map((s) => sinirla(s[0] * d[0] + s[1] * d[1] + s[2] * d[2]))
}

/** OKLab ΔE ×100; tur: undefined (normal) | 'protan' | 'deutan'. */
export function farkOklab(a, b, tur) {
  const [x, y] = [oklab(benzet(a, tur)), oklab(benzet(b, tur))]
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** OKLCH kroma (renklilik); 0.10 altı gri okunur. */
export function kroma(hex) {
  const [, a, b] = oklab(rgb(hex).map(dogrusal))
  return Math.hypot(a, b)
}
