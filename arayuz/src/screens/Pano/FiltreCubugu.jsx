// Kişi listesi arama kutusu + filtre düğmeleri + sıralama seçici. Yalnız görüntüler ve
// seçimi üst bileşene iletir; süzme api/filtre.js'te, sıralama api/durum.js'te.
import { FILTRELER } from '../../api/filtre.js'
import { SIRALAMALAR } from '../../api/durum.js'

export default function FiltreCubugu({ arama, filtre, sirala, onArama, onFiltre, onSirala }) {
  return (
    <div className="filtre-cubugu">
      <input
        type="search"
        className="filtre-arama"
        placeholder="Ara: ad, kurum, kart no"
        value={arama}
        onChange={(e) => onArama(e.target.value)}
        aria-label="Kişi ara"
      />
      <div className="filtre-dugmeler" role="group" aria-label="Filtre">
        {FILTRELER.map((f) => (
          <button
            key={f.deger}
            type="button"
            className={`filtre-dugme ${filtre === f.deger ? 'filtre-dugme--secili' : ''}`}
            aria-pressed={filtre === f.deger}
            onClick={() => onFiltre(f.deger)}
          >
            {f.etiket}
          </button>
        ))}
      </div>
      <label className="filtre-sirala">
        Sırala
        <select value={sirala} onChange={(e) => onSirala(e.target.value)} data-test="sirala-sec">
          {SIRALAMALAR.map((s) => <option key={s.deger} value={s.deger}>{s.etiket}</option>)}
        </select>
      </label>
    </div>
  )
}
