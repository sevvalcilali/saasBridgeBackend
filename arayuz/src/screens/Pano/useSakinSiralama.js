// FLIP ile yumuşak yeniden dizilme — kütüphane yok, Web Animations API.
// Satırlar durum değişince yer değiştirdiğinde zıplamadan kayar. Hareketi
// azalt tercihine saygılıdır (prefers-reduced-motion → animasyon yok).
import { useLayoutEffect, useRef } from 'react'

export function useSakinSiralama(kapRef, tetik) {
  const oncekiKonum = useRef(new Map())

  useLayoutEffect(() => {
    const kap = kapRef.current
    if (!kap) return

    const azalt = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const satirlar = kap.querySelectorAll('[data-id]')
    const yeniKonum = new Map()
    satirlar.forEach((s) => yeniKonum.set(s.dataset.id, s.getBoundingClientRect().top))

    if (!azalt) {
      const onceki = oncekiKonum.current
      satirlar.forEach((s) => {
        const eski = onceki.get(s.dataset.id)
        const yeni = yeniKonum.get(s.dataset.id)
        const fark = eski == null ? 0 : eski - yeni
        if (Math.abs(fark) > 1) {
          s.animate(
            [{ transform: `translateY(${fark}px)` }, { transform: 'translateY(0)' }],
            { duration: 300, easing: 'ease' },
          )
        }
      })
    }
    oncekiKonum.current = yeniKonum
  }, [kapRef, tetik])
}
