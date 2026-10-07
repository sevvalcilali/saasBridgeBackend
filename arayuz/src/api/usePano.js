// React ile api/client.js arasındaki tek köprü. Bileşenler bağlantıyı
// kendileri kurmaz; bu kancadan { durum, baglandi, hata, baglanti } alır.
// grafik: sinyal grafiğinin verisini (history) iste — yalnız Kurulum; diğer ekranlarda boş gelir.
import { useEffect, useRef, useState } from 'react'
import { PanoBaglantisi, SUNUCU_ADRESI } from './client.js'

export function usePano({ adres = SUNUCU_ADRESI, grafik = false } = {}) {
  const baglantiRef = useRef(null)
  const [anlik, setAnlik] = useState({ durum: null, baglandi: false, hata: null })

  if (baglantiRef.current === null) {
    baglantiRef.current = new PanoBaglantisi({ adres, grafik })
  }

  useEffect(() => {
    const baglanti = new PanoBaglantisi({ adres, grafik })
    baglantiRef.current = baglanti
    const birak = baglanti.dinle(setAnlik)
    baglanti.basla()
    return () => { birak(); baglanti.kapat() }
  }, [adres, grafik])

  return { ...anlik, baglanti: baglantiRef.current }
}
