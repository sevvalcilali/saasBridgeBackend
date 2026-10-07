// Panoda açılır uyarı (Şevval isteği 2026-10-06): organizatörün uyarı kuralı tetiklenince (bildirim kind "kural")
// ekranın üstünde bir kutu çıkar; "Tamam" ile kapanır, birden çoksa sırayla gelir. Görülenler tarayıcıda hatırlanır
// (yenilemede yeniden açılmaz); sayfa açılırken yalnız son 2 dakikanınkiler açılır. Salon ekranında (Sunum) yoktur.
import { useMemo, useRef } from 'react'
import { useKalici } from '../../api/useKalici.js'
import { acilacakUyarilar } from '../../api/kurallar.js'
import { gorunenAd } from '../../api/durum.js'
import BildirimIkon from './bildirimIkonlari.jsx'
import './UyariPenceresi.css'

const HATIRLA_EN_COK = 300

export default function UyariPenceresi({ alerts, people, onGoster }) {
  const [goruldu, setGoruldu] = useKalici('pano.uyariGoruldu', [])
  const acilis = useRef(Date.now() / 1000) // bundan 2 dk öncesinden eski uyarılar açılmaz
  const sira = useMemo(
    () => acilacakUyarilar(alerts, new Set(goruldu), acilis.current, { ilk: true }),
    [alerts, goruldu],
  )
  if (sira.length === 0) return null

  const uyari = sira[0]
  const kisi = new Map(people.map((p) => [p.id, p]))
  const adlar = uyari.people.map((kart) => (kisi.has(kart) ? gorunenAd(kisi.get(kart)) : `Kart ${kart}`))
  const kapat = () => setGoruldu((g) => [...g, uyari.anahtar].slice(-HATIRLA_EN_COK))

  return (
    <div className="uyari-pencere" role="alert" aria-live="assertive" data-test="uyari-pencere">
      <span className="uyari-pencere-ikon" aria-hidden="true"><BildirimIkon kind="kural" /></span>
      <div className="uyari-pencere-metin">
        <p className="uyari-pencere-ust">Uyarı kuralı · {uyari.clock}</p>
        <p className="uyari-pencere-baslik">{uyari.title}</p>
        <p className="uyari-pencere-ayrinti">{uyari.detail}</p>
        <p className="uyari-pencere-kisiler">{adlar.join(' · ')}</p>
      </div>
      <div className="uyari-pencere-dugmeler">
        <button type="button" className="kartver-geri" onClick={() => { onGoster(uyari.people); kapat() }}
          data-test="uyari-goster">Kişileri göster</button>
        <button type="button" className="kisisec-ekle" onClick={kapat} data-test="uyari-tamam">Tamam</button>
        {sira.length > 1 && <span className="uyari-pencere-sira" data-test="uyari-sira">+{sira.length - 1} uyarı daha</span>}
      </div>
    </div>
  )
}
