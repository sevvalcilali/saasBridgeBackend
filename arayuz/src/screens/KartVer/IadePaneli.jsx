// Kart iadesi (brief §6): kişi ayrılınca kartı geri alınır, kart boşa çıkar.
// Geçmiş süreleri silinmez, raporda kalır. Kişi aranır/seçilir → tek onay → iade.
import { tamAd } from '../../api/ad.js'
import { useState } from 'react'
import { iadeAdaylari } from '../../api/masaYardim.js'

// baslangicKart: kişi ayrıntı panelindeki "Kartı iade al" kısayolu — o kişinin onayıyla açılır.
export default function IadePaneli({ api, katilimcilar, baslangicKart = null, onIade }) {
  const [arama, setArama] = useState('')
  const [secili, setSecili] = useState(() =>
    (baslangicKart && katilimcilar?.find((k) => k.atananKart === baslangicKart)) || null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState(null)

  async function iadeAl() {
    if (!secili || gonderiliyor) return
    setGonderiliyor(true)
    setHata(null)
    try {
      await api.iade(secili.atananKart)
      onIade({ ad: secili.ad, kart: secili.atananKart })
      setSecili(null)
      setArama('')
    } catch {
      setHata('İade yapılamadı — sunucuya ulaşılamıyor. Tekrar deneyin.')
    } finally {
      setGonderiliyor(false)
    }
  }

  if (katilimcilar === null) return <p className="kartver-iskele">Kişiler yükleniyor…</p>

  if (secili) {
    return (
      <div className="kontrol" data-test="iade-onay">
        <div className="onay-kart" style={{ '--kisi-renk': secili.renk }}>
          <span className="onay-renk" aria-hidden="true" />
          <span className="onay-metin"><strong>{secili.ad}</strong> · <strong>Kart {secili.atananKart}</strong></span>
        </div>
        <p className="kontrol-not">
          Kişi ayrıldı mı? Kart boşa çıkar, kişi panodan düşer. Bugünkü görüşme süreleri silinmez, raporda kalır.
        </p>
        {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}
        <div className="kisisec-form-dugmeler">
          <button type="button" className="kartver-geri" onClick={() => setSecili(null)}>Vazgeç</button>
          <button type="button" className="kisisec-ekle onay-dugme" data-test="iade-al"
            disabled={gonderiliyor} onClick={iadeAl}>
            {gonderiliyor ? 'Alınıyor…' : 'Kartı iade al'}
          </button>
        </div>
      </div>
    )
  }

  const liste = iadeAdaylari(katilimcilar, arama)
  return (
    <div className="kisisec">
      <input
        type="search"
        className="kisisec-arama"
        placeholder="Kart no, ad veya kurum"
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        aria-label="İade edilecek kişiyi ara"
      />
      <ul className="kisisec-liste" data-test="iade-liste">
        {liste.map((k) => (
          <li key={k.kisiId}>
            <button type="button" className="kisisec-oge" data-test="iade-oge" onClick={() => setSecili(k)}>
              <span className="kisisec-renk" style={{ background: k.renk }} aria-hidden="true" />
              <span className="kisisec-ad">
                <strong>{tamAd(k)}</strong>
              </span>
              <span className="kartsec-etiket kartsec-no">Kart {k.atananKart}</span>
            </button>
          </li>
        ))}
        {liste.length === 0 && <li className="kartver-iskele">Kartı olan eşleşen kişi yok.</li>}
      </ul>
    </div>
  )
}
