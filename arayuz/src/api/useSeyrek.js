// Yoğun ya da hızlı değişen bir görünümü seyrek tazelemek için: `etkin` iken değer en çok `aralikMs`'de bir
// yenilenir, arada son değer (aynı referans) döner → memo'lu bileşen yeniden çizilmez. Etkin değilse değer her
// zaman günceldir. `zorla`: süre dolmadan hemen yenile ("Şimdi güncelle").
import { useRef } from 'react'

export function seyrekDeger(onceki, deger, simdi, aralikMs, etkin, zorla = false) {
  if (zorla || !etkin || onceki?.deger == null || simdi - onceki.zaman >= aralikMs) return { deger, zaman: simdi }
  return onceki
}

/** { deger, zaman }: son tazelenen değer ve ne zaman tazelendiği (ms). `yenile` değişince hemen tazelenir. */
export function useSeyrekDurum(deger, aralikMs, etkin, yenile = 0) {
  const ref = useRef(null)
  const yenileRef = useRef(yenile)
  const zorla = yenileRef.current !== yenile
  yenileRef.current = yenile
  ref.current = seyrekDeger(ref.current, deger, Date.now(), aralikMs, etkin, zorla)
  return ref.current
}

export function useSeyrek(deger, aralikMs, etkin) {
  return useSeyrekDurum(deger, aralikMs, etkin).deger
}
