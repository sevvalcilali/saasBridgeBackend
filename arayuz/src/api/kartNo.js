// Kart numarası kuralları tek yerde (brief §3): kişi kartları 1–99; 100 ve üstü
// dinleyici cihazdır, kişi değildir — hiçbir kişi/kart listesinde gösterilmez.
export const KART_EN_BUYUK = 99

/** Kişi kartı mı? (sayısal 1–99) */
export const kisiKartiMi = (id) => {
  const n = Number(id)
  return Number.isInteger(n) && n >= 1 && n <= KART_EN_BUYUK
}

/** Elle yazılan kart no → sunucunun kullandığı biçim ("007" → "7"); geçersizse null. */
export function kartNoCoz(girdi) {
  const m = String(girdi ?? '').trim()
  if (!/^\d{1,3}$/.test(m)) return null
  return kisiKartiMi(m) ? String(Number(m)) : null
}
