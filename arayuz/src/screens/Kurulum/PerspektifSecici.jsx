// Perspektif (brief §8): bir kişi seçilince grafik ve çift tablosu yalnız onun
// çiftlerini gösterir. Seçenekler: şu an en az bir çifti duyulan kişiler.
import { perspektifKisileri } from '../../api/sinyal.js'
import { kisaAd } from '../../api/ad.js'
import KisiRozeti from '../../components/KisiRozeti.jsx'

export default function PerspektifSecici({ signals, people, secili, onSec }) {
  const kisiler = perspektifKisileri(signals, people, secili)
  const seciliKisi = kisiler.find((k) => k.id === secili)
  return (
    <div className="perspektif" data-test="perspektif">
      <label className="perspektif-etiket">
        Perspektif
        <select value={secili ?? ''} onChange={(e) => onSec(e.target.value || null)} data-test="perspektif-sec">
          <option value="">Tüm çiftler</option>
          {kisiler.map((k) => (
            <option key={k.id} value={k.id}>{kisaAd(k)} ({k.id})</option>
          ))}
        </select>
      </label>
      {seciliKisi && (
        <span className="perspektif-secili">
          Yalnız <KisiRozeti kisi={seciliKisi} /> ile olan çiftler
          <button type="button" className="kartver-geri perspektif-temizle" onClick={() => onSec(null)} data-test="perspektif-temizle">
            ✕ Tüm çiftler
          </button>
        </span>
      )}
    </div>
  )
}
