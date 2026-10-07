// Kişi ayrıntı paneli için ek veri (kayıt defteri, görüşme kayıtları). Kartlar istenmez (yalnız pil içindi; 07.10.2026).
// Panel açıkken 5 sn'de bir yoklanır; yoklama başarısız olursa son veri korunur.
import { useEffect, useState } from 'react'

export function usePanelVerisi(api, aralikMs = 5000) {
  const [veri, setVeri] = useState(null) // { kisiler, oturumlar }
  const [hata, setHata] = useState(false) // ör. gerçek sunucuda uçlar henüz yok → "alınamadı"
  useEffect(() => {
    let iptal = false
    const yokla = () => Promise.all([api.kisileriGetir(), api.oturumlariGetir()])
      .then(([kisiler, oturumlar]) => { if (!iptal) { setVeri({ kisiler, oturumlar }); setHata(false) } })
      .catch(() => { if (!iptal) setHata(true) })
    yokla()
    const z = setInterval(yokla, aralikMs)
    return () => { iptal = true; clearInterval(z) }
  }, [api, aralikMs])
  return { veri, hata }
}
