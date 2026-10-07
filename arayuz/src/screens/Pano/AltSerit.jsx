// Alt şerit: özet sayılar + etkinlik ilerleme çubuğu. Değerler/biçim
// api/durum.js'te; burada yalnız görüntü.
import { ozetKutulari, etkinlikYuzde } from '../../api/durum.js'
import './AltSerit.css'

export default function AltSerit({ durum }) {
  const kutular = ozetKutulari(durum)
  const yuzde = etkinlikYuzde(durum)

  return (
    <div className="alt-serit">
      <div className="alt-kutular">
        {kutular.map((k) => (
          <div key={k.ad} className="alt-kutu">
            <span className="alt-deger sayi">{k.deger}</span>
            <span className="alt-ad">{k.ad}</span>
          </div>
        ))}
      </div>

      {yuzde != null && (
        <div className="alt-ilerleme" title={`Etkinlik ilerlemesi %${yuzde}`}>
          <div
            className="alt-ilerleme-cubuk"
            role="progressbar"
            aria-valuenow={yuzde}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Etkinlik ilerlemesi"
          >
            <div className="alt-ilerleme-dolu" style={{ width: `${yuzde}%` }} />
          </div>
          <span className="alt-ilerleme-yazi sayi">%{yuzde}</span>
        </div>
      )}
    </div>
  )
}
