// Bildirim akışı: en yeni üstte (sunucu tarafında sıralı gelir), türe göre
// ikon, severity'ye göre sol kenar rengi. Tıklayınca ilgili kişileri vurgular
// (vurgu efekti kişi listesi + ağda). Varsayılan son 20; "Tümünü göster" ile hepsi.
// Önem süzgeci (Ciddi / Uyarı / Olumlu): kart kayboldu gibi ciddi bildirimler çok sayıda
// anlaşma bildiriminin altında kaybolmasın. Mantık api/bildirim.js'te.
import { memo, useState } from 'react'
import { ONEM_SUZGECLERI, GORUNEN_VARSAYILAN, onemSayilari, gorunenBildirimler } from '../../api/bildirim.js'
import { useKalici } from '../../api/useKalici.js'
import BildirimIkon from './bildirimIkonlari.jsx'
import './BildirimAkisi.css'

function ayniKisiler(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

// memo: her SSE tikinde yeni bildirim nesneleri gelir; anahtar + seçim değişmedikçe öğe çizilmez
// (97 kişide yüzlerce bildirim "Tümünü göster" ile açıkken 2 Hz yeniden çizim olmasın).
const BildirimOge = memo(function BildirimOge({ b, secili, onTikla }) {
  return (
    <button
      type="button"
      className={`bildirim bildirim--${b.severity} ${secili ? 'bildirim--secili' : ''}`}
      onClick={() => onTikla?.(b)}
      data-test="bildirim"
      data-kind={b.kind}
      data-people={b.people.join(',')}
    >
      <span className="bildirim-ikon" aria-hidden="true"><BildirimIkon kind={b.kind} /></span>
      <span className="bildirim-govde">
        <span className="bildirim-ust">
          <strong className="bildirim-title">{b.title}</strong>
          <time className="bildirim-saat sayi">{b.clock}</time>
        </span>
        <span className="bildirim-detay">{b.detail}</span>
      </span>
    </button>
  )
}, (p, n) => p.b.anahtar === n.b.anahtar && p.secili === n.secili && p.onTikla === n.onTikla)

export default function BildirimAkisi({ alerts, vurgulanan = [], onBildirimTikla }) {
  const [onem, setOnem] = useKalici('pano.bildirimOnem', 'tumu') // brief §11: süzgeç korunur
  const [hepsi, setHepsi] = useState(false)
  const sayilar = onemSayilari(alerts)
  const { liste, kalan, toplam } = gorunenBildirimler(alerts, { onem, hepsi })

  return (
    <div className="bildirim-akisi">
      <h2 className="bildirim-baslik">
        Bildirimler <span className="bildirim-sayi sayi">{alerts.length}</span>
      </h2>

      <div className="bildirim-suzgec" role="group" aria-label="Önem">
        {ONEM_SUZGECLERI.map((s) => (
          <button key={s.deger} type="button" className={`bildirim-suzgec-dugme ${onem === s.deger ? 'bildirim-suzgec-dugme--secili' : ''}`}
            aria-pressed={onem === s.deger} onClick={() => setOnem(s.deger)} data-test={`bildirim-onem-${s.deger}`}>
            {s.etiket} <span className="sayi">{sayilar[s.deger]}</span>
          </button>
        ))}
      </div>

      {toplam === 0 ? (
        <p className="bildirim-bos">{alerts.length === 0 ? 'Henüz bildirim yok.' : 'Bu önemde bildirim yok.'}</p>
      ) : (
        <ul className="bildirim-liste">
          {liste.map((b) => (
            <li key={b.anahtar}>
              <BildirimOge b={b} secili={ayniKisiler(vurgulanan, b.people)} onTikla={onBildirimTikla} />
            </li>
          ))}
        </ul>
      )}

      {kalan > 0 && (
        <button type="button" className="bildirim-kalan" onClick={() => setHepsi(true)} data-test="bildirim-tumu">
          Tümünü göster (+{kalan} daha eski)
        </button>
      )}
      {hepsi && toplam > GORUNEN_VARSAYILAN && (
        <button type="button" className="bildirim-kalan" onClick={() => setHepsi(false)} data-test="bildirim-azalt">
          Yalnız son {GORUNEN_VARSAYILAN} bildirimi göster
        </button>
      )}
    </div>
  )
}
