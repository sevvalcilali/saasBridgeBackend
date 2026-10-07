// Kişi listesi satırı: renk + rol şekli + ad (girişimcide kurum öne) +
// yıldız + durum (ikon+renk+yazı) + toplam süre + karşı rol sayısı. Kimlik renk+şekil+ad ile;
// durum renk+ikon+yazı üçlüsüyle verilir (renk körlüğü — brief §10).
import { memo } from 'react'
import { durumCumlesi, atanmamisKartMi, karsiRolYazisi, bostaDakika } from '../../api/durum.js'
import { sureYazisi } from '../../api/format.js'

const ROL_ADI = { investor: 'Yatırımcı', founder: 'Girişimci', guest: 'Misafir' }
const DURUM_IKON = { talking: '●', idle: '○', away: '◌' }

function KisiSatiri({ kisi, vurgulu, secili, onSec, onKisiAta }) {
  const atanmamis = atanmamisKartMi(kisi)
  const karsi = karsiRolYazisi(kisi)

  return (
    <li
      className={`kisi-satiri ${vurgulu ? 'kisi-satiri--vurgulu' : ''} ${secili ? 'kisi-satiri--secili' : ''}`}
      data-id={kisi.id}
      data-durum={kisi.status}
      data-atanmamis={atanmamis || undefined}
      data-vurgulu={vurgulu || undefined}
      data-secili={secili || undefined}
      data-test="kisi-satiri"
      role="button"
      tabIndex={0}
      aria-pressed={secili || false}
      onClick={() => onSec?.(kisi.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSec?.(kisi.id) }
      }}
    >
      <span className="kisi-renk" style={{ background: kisi.color }} aria-hidden="true" />
      <span
        className={`kisi-rol kisi-rol--${kisi.role}`}
        title={ROL_ADI[kisi.role]}
        aria-hidden="true"
      />

      <span className="kisi-ad">
        {kisi.role === 'founder' && kisi.org ? (
          <>
            <strong>{kisi.org}</strong>
            <span className="kisi-ad-kisi"> · {kisi.name}</span>
          </>
        ) : (
          <strong>{kisi.name}</strong>
        )}
        {kisi.stars && <span className="kisi-yildiz" aria-label={`${kisi.tier} yıldız`}> {kisi.stars}</span>}
      </span>

      {atanmamis ? (
        <span className="kisi-durum kisi-durum--atanmamis">
          <span className="kisi-durum-ikon" aria-hidden="true">⚠</span>
          Atanmamış kart
        </span>
      ) : (
        <span className="kisi-durum">
          <span className="kisi-durum-ikon" aria-hidden="true">{DURUM_IKON[kisi.status]}</span>
          {durumCumlesi(kisi)}
        </span>
      )}

      {atanmamis ? (
        <button
          type="button"
          className="kisi-ata-dugme"
          onClick={(e) => { e.stopPropagation(); onKisiAta?.(kisi) }}
        >
          Kişi ata
        </button>
      ) : (
        <span className="kisi-sure">
          <span className="sayi" title="bugünkü toplam süre">{sureYazisi(kisi.min)}</span>
          {karsi && (
            <span className="kisi-karsi sayi" title="bugün kaç farklı karşı rol kişisiyle görüştü" data-test="kisi-karsi">{karsi}</span>
          )}
        </span>
      )}
    </li>
  )
}

// Saniyede 2 güncelleme × çok kişi: SSE her tik yeni kisi NESNESİ ürettiği için
// referans karşılaştırması yetmez; render edilen alanları alan alan karşılaştırıp
// değeri değişmeyen satırların yeniden çizimini atlarız (idle/away satırları).
function esit(a, b) {
  const k = a.kisi, m = b.kisi
  return (
    a.vurgulu === b.vurgulu && a.secili === b.secili &&
    a.onSec === b.onSec && a.onKisiAta === b.onKisiAta &&
    k.id === m.id && k.status === m.status && k.withName === m.withName &&
    k.name === m.name && k.org === m.org && k.color === m.color &&
    k.stars === m.stars && k.min === m.min && k.live === m.live && k.seenAgo === m.seenAgo &&
    k.invPeers === m.invPeers && bostaDakika(k) === bostaDakika(m) // idleSinceS her tik artar; satır dakikada bir
  )
}

export default memo(KisiSatiri, esit)
