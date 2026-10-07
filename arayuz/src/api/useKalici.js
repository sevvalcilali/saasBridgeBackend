// localStorage'a yansıyan useState. Sayfa yenilenince değer korunur
// (brief §11). Depolama erişimi try/catch ile korunur (gizli sekme vb.).
import { useState, useEffect } from 'react'

function oku(anahtar, varsayilan) {
  try {
    const ham = localStorage.getItem(anahtar)
    return ham === null ? varsayilan : JSON.parse(ham)
  } catch {
    return varsayilan
  }
}

export function useKalici(anahtar, varsayilan) {
  const [deger, setDeger] = useState(() => oku(anahtar, varsayilan))
  useEffect(() => {
    try {
      localStorage.setItem(anahtar, JSON.stringify(deger))
    } catch {
      /* depolama yoksa sessizce geç */
    }
  }, [anahtar, deger])
  return [deger, setDeger]
}
