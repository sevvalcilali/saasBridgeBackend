// Açık / koyu tema seçimi: iki düğmeli grup, seçili olan aria-pressed ile belirtilir.
import './TemaSecici.css'

const ETIKET = { acik: 'Açık', koyu: 'Koyu' }

export default function TemaSecici({ tema, onDegis }) {
  return (
    <div className="tema-secici" role="group" aria-label="Tema">
      {Object.entries(ETIKET).map(([t, etiket]) => (
        <button key={t} type="button" className="tema-secici-dugme" data-test={`tema-${t}`}
          aria-pressed={tema === t} onClick={() => onDegis(t)}>
          {etiket}
        </button>
      ))}
    </div>
  )
}
