// Alıcının duyduğu kartları (/api/cards) aralıklı yoklar: boştaki kartlar şeridi
// ve kayıp kart uyarısı bunu okur. Bir yoklama başarısız olursa son liste korunur,
// `hata` true olur (ekran "sunucuya bağlanılamıyor" der); sonraki başarıda düşer.
import { useEffect, useState } from 'react'

export function useKartlar(api, aralikMs = 3000) {
  const [kartlar, setKartlar] = useState(null)
  const [hata, setHata] = useState(false)
  useEffect(() => {
    let iptal = false
    const yokla = () => api.kartlariGetir()
      .then((l) => { if (!iptal) { setKartlar(l); setHata(false) } })
      .catch(() => { if (!iptal) setHata(true) })
    yokla()
    const z = setInterval(yokla, aralikMs)
    return () => { iptal = true; clearInterval(z) }
  }, [api, aralikMs])
  return { kartlar, hata }
}
