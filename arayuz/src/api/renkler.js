// Sunucunun koyu-zemin kişi paleti (brief §10) → temanın kişi rengi token'ı.
// Renk kişiyi takip eder: eşleme sabittir, sıraya bakmaz. Dönen değer bir CSS
// değişkenidir (var(--kisi-*)), böylece açık/koyu temada aynı kişi aynı renk
// ailesinde kalır ve değer tema değişince kendiliğinden güncellenir.
// #199e70 özel durum: yeşil yalnız "birlikte" demek olduğundan petrole
// eşlenir (PLAN B.1 kararının sunucudan-gelen-renk ayağı).

export const KISI_RENK_ADLARI = ['mavi', 'turuncu', 'petrol', 'hardal', 'pembe', 'mor', 'mercan', 'gri']

const tokenRengi = (ad) => `var(--kisi-${ad})`

export const PALET = Object.fromEntries(KISI_RENK_ADLARI.map((ad) => [ad, tokenRengi(ad)]))

const ESLEME = new Map([
  ['#3987e5', PALET.mavi],
  ['#d95926', PALET.turuncu],
  ['#199e70', PALET.petrol],
  ['#c98500', PALET.hardal],
  ['#d55181', PALET.pembe],
  ['#9085e9', PALET.mor],
  ['#e66767', PALET.mercan],
  ['#898781', PALET.gri],
])

/** Sunucudan gelen kişi rengini temanın kişi rengi token'ına çevirir; bilinmeyen renk aynen geçer. */
export function sunucuRengi(hex) {
  if (!hex) return PALET.gri
  return ESLEME.get(hex.toLowerCase()) ?? hex
}

// Kayıt defterindeki katılımcının rengi (masa / rapor): panodakiyle aynı eşleme.
// Renk kişiyi takip eder ve yeşil yalnız "birlikte" demektir (brief §10).
export const katilimciRengiUyarla = (k) => ({ ...k, renk: sunucuRengi(k.renk) })
