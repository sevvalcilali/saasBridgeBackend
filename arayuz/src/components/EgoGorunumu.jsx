// Ego görünümü (Pano "Gün boyu"): seçili kişi ortada, bugün görüştüğü herkes çevresinde; çizgi kalınlığı
// toplam süre, yeşil kesikli = şu an birlikte, koyu = yatırımcı ile girişimci. Bir eşe tıklayınca o kişiye geçer.
// Konum FİZİKSEL konum DEĞİLDİR (api/ego.js).
import { useMemo } from 'react'
import { egoYerlesimi } from '../api/ego.js'
import { kisaAd } from '../api/ad.js'
import { sureYazisi } from '../api/format.js'
import './EgoGorunumu.css'

const W = 1400, H = 790 // geniş: sağ / sol etiketler sığsın; dipte iki satır etikete yer

function Sekil({ k, x, y, r }) {
  const ortak = { fill: k.color, stroke: 'var(--yuzey)', strokeWidth: 2 }
  if (k.role === 'founder') return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={5} {...ortak} />
  if (k.role === 'guest') return <rect x={x - r * 0.8} y={y - r * 0.8} width={r * 1.6} height={r * 1.6} transform={`rotate(45 ${x} ${y})`} {...ortak} />
  return <circle cx={x} cy={y} r={r} {...ortak} />
}

const kisa = (sure) => sure.replace(/ \d+ sn$/, '')
// Etiket merkezden dışarı itilir (düğümün yönünde): komşu etiketler halka boyunca açılır, çizgiyle çakışmaz.
// Ad ve süre iki satır; üst yarıda düğümün üstüne, alt yarıda altına, yanlarda yanına.
function etiketYeri(e) {
  const x = e.x + e.cos * 40, y = e.y + e.sin * 40
  const hiza = e.cos > 0.1 ? 'start' : e.cos < -0.1 ? 'end' : 'middle' // ortalı yalnız tam tepe ve dip
  const [ad, sure] = e.sin < -0.25 ? [-30, -2] : e.sin > 0.25 ? [20, 48] : [2, 30]
  return { x, ad: y + ad, sure: y + sure, hiza }
}

export default function EgoGorunumu({ kisi, people, edges, live, onKisiSec }) {
  const { merkez, esler, fazla } = useMemo(
    () => egoYerlesimi(kisi.id, people, edges, live, { w: W, h: H }), [kisi.id, people, edges, live],
  )
  return (
    <div className="ego" data-test="ego">
      <p className="ego-ozet">
        <strong>{kisaAd(kisi)}</strong>{' '}
        {esler.length === 0
          ? 'bugün henüz kimseyle görüşmedi.'
          : <>bugün <strong className="sayi">{esler.length + fazla}</strong> kişiyle görüştü · toplam <span className="sayi">{kisa(sureYazisi(kisi.min))}</span></>}
      </p>
      <svg className="ego-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${kisaAd(kisi)} ve bugün görüştükleri`}>
        {esler.map((e) => (
          <line key={e.kisi.id} x1={merkez.x} y1={merkez.y} x2={e.x} y2={e.y} strokeWidth={e.kalinlik}
            className={`ego-cizgi ${e.karma ? 'ego-cizgi--karma' : ''} ${e.simdi ? 'ego-cizgi--simdi' : ''}`} />
        ))}
        {esler.map((e) => (
          <g key={e.kisi.id} className="ego-es" role="button" tabIndex={-1} aria-label={`${kisaAd(e.kisi)}, ${sureYazisi(e.min)}`}
            data-test="ego-es" data-id={e.kisi.id} data-simdi={e.simdi || undefined}
            onClick={() => onKisiSec(e.kisi.id)}>
            <Sekil k={e.kisi} x={e.x} y={e.y} r={22} />
            <text x={etiketYeri(e).x} y={etiketYeri(e).ad} textAnchor={etiketYeri(e).hiza} className="ego-ad">{kisaAd(e.kisi)}</text>
            <text x={etiketYeri(e).x} y={etiketYeri(e).sure} textAnchor={etiketYeri(e).hiza}
              className={`ego-sure sayi ${e.simdi ? 'ego-sure--simdi' : ''}`}>
              {kisa(sureYazisi(e.min))}{e.simdi ? ' · şu an' : ''}
            </text>
          </g>
        ))}
        <g className="ego-merkez">
          <Sekil k={kisi} x={merkez.x} y={merkez.y} r={36} />
          <text x={merkez.x} y={merkez.y + 76} textAnchor="middle" className="ego-ad ego-ad--merkez">{kisaAd(kisi)}</text>
        </g>
      </svg>
      {fazla > 0 && <p className="ego-not">En uzun {esler.length} görüşme gösteriliyor; {fazla} kişi daha var (Rapor'da tamamı).</p>}
      <p className="ag-not">Konumlar salondaki yeri göstermez. Çizgi kalınlığı = bugün birlikte geçen süre.</p>
    </div>
  )
}
