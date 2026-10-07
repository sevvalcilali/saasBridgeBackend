// Kalibrasyon sihirbazı (brief §8): yüz yüze ve sırt sırta ölçümlerinin ortası
// eşik olarak önerilir. Saf fonksiyonlar.
import { esikSinirla } from './esik.js'

export const KALIBRASYON_SN = 10 // signals.value = son 10 sn ortancası: 10 sn tutulunca tam o pencere
export const MIN_FARK_DB = 6     // iki ölçüm bundan yakınsa eşik ikisini güvenilir ayıramaz

// → { deger, fark, uyari: null | 'kucuk' | 'ters' }
//   ters: sırt sırta ölçümü yüz yüzeden güçlü (ölçümler karışmış) — öneri yok.
export function onerilenEsik(yuzyuze, sirtsirta) {
  if (yuzyuze == null || sirtsirta == null) return null
  const fark = Math.round((yuzyuze - sirtsirta) * 10) / 10
  if (fark <= 0) return { deger: null, fark, uyari: 'ters' }
  return { deger: esikSinirla((yuzyuze + sirtsirta) / 2), fark, uyari: fark < MIN_FARK_DB ? 'kucuk' : null }
}

// Geri sayım: başlangıçtan bu yana geçen ms → kalan tam saniye (0'da biter).
export const kalanSaniye = (baslangic, simdi, sure = KALIBRASYON_SN) =>
  Math.max(0, Math.ceil(sure - (simdi - baslangic) / 1000))
