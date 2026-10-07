// Açık / koyu tema (brief §10; PLAN Bölüm 1: açık varsayılan). Seçim cihazda
// saklanır (brief §11) ve <html data-tema="…"> ile uygulanır; token'lar gerisini yapar.
import { useEffect } from 'react'
import { useKalici } from './useKalici.js'

export const TEMA_ANAHTARI = 'uyg.tema'
export const TEMALAR = ['acik', 'koyu']

export const gecerliTema = (t) => (TEMALAR.includes(t) ? t : 'acik')

// İlk boyamadan önce (main.jsx): yanıp sönme olmasın diye kayıtlı temayı hemen uygula.
export function kayitliTemayiUygula() {
  let t = 'acik'
  try { t = gecerliTema(JSON.parse(localStorage.getItem(TEMA_ANAHTARI))) } catch { /* depolama yok */ }
  document.documentElement.dataset.tema = t
}

export function useTema() {
  const [tema, setTema] = useKalici(TEMA_ANAHTARI, 'acik')
  const gecerli = gecerliTema(tema)
  useEffect(() => { document.documentElement.dataset.tema = gecerli }, [gecerli])
  return [gecerli, setTema]
}
