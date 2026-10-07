// Görüşme zaman çizelgesi (brief §7, §9-6): her görüşme ortak zaman ekseninde bir
// çubuk; karşı kişi adı, saat aralığı ve süre yazılı. Sürmekte olan görüşme açık
// uçlu ve "birlikte" renginde (yeşil yalnız şu an birlikte olan için). Sıra
// başlangıca göre sabit — yeni görüşme alta eklenir, satırlar zıplamaz.
import { RolSekli } from './KisiRozeti.jsx'
import { cizelgeAraligi, cizelgeYuzde, etkinlikSaati, raporAdi, kisaAd } from '../api/rapor.js'
import { sureYazisi } from '../api/format.js'
import './ZamanCizelgesi.css'

export default function ZamanCizelgesi({ oturumlar, simdi, saat }) {
  if (oturumlar.length === 0) return <p className="zc-bos">Henüz görüşme kaydı yok.</p>
  const aralik = cizelgeAraligi(oturumlar, simdi)
  const s = (sn) => etkinlikSaati(sn, saat, simdi)
  return (
    <div className="zc" data-test="zaman-cizelgesi">
      <div className="zc-eksen" aria-hidden="true">
        <span>{s(aralik.bas)}</span><span>şimdi · {s(simdi)}</span>
      </div>
      <ol className="zc-liste">
        {oturumlar.map((o, i) => {
          const sol = cizelgeYuzde(o.start, aralik)
          const gen = Math.max(1.5, cizelgeYuzde(o.end ?? simdi, aralik) - sol)
          return (
            <li key={`${o.start}-${i}`} className="zc-satir" data-test="zc-satir" data-suruyor={o.suruyor || undefined}>
              <span className="zc-ad" title={raporAdi(o.karsi)}>
                <span className="zc-renk" style={o.karsi.renk ? { background: o.karsi.renk } : undefined} aria-hidden="true" />
                <RolSekli rol={o.karsi.rol} />
                {kisaAd(o.karsi)}
              </span>
              <span className="zc-yol" aria-hidden="true">
                <span className={`zc-cubuk ${o.suruyor ? 'zc-cubuk--suruyor' : ''}`} style={{ left: `${sol}%`, width: `${gen}%` }} />
              </span>
              <span className="zc-zaman sayi">
                {s(o.start)}–{o.suruyor ? 'sürüyor' : s(o.end)} · {sureYazisi(o.sureSn / 60)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
