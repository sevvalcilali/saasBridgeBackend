// Uygulama kökü + hafif yönlendirme. Pano ↔ Kart Ver ↔ Kurulum ↔ Rapor;
// ?clean=1 → menüsüz sunum modu (salon ekranı, brief §4.5).
import { useRota, sunumModuMu, sunumAdresi } from './api/useRota.js'
import { useTema } from './api/useTema.js'
import TemaSecici from './components/TemaSecici.jsx'
import PanoEkrani from './screens/Pano/PanoEkrani.jsx'
import KartVerEkrani from './screens/KartVer/KartVerEkrani.jsx'
import KurulumEkrani from './screens/Kurulum/KurulumEkrani.jsx'
import RaporEkrani from './screens/Rapor/RaporEkrani.jsx'
import SunumEkrani from './screens/Sunum/SunumEkrani.jsx'
import './App.css'

const SEKMELER = [
  { rota: 'pano', yol: '#/', etiket: 'Pano' },
  { rota: 'kart-ver', yol: '#/kart-ver', etiket: 'Kart Ver' },
  { rota: 'kurulum', yol: '#/kurulum', etiket: 'Kurulum' },
  { rota: 'rapor', yol: '#/rapor', etiket: 'Rapor' },
]

export default function App() {
  if (sunumModuMu(window.location.search)) return <SunumEkrani />
  return <Uygulama />
}

function Uygulama() {
  const rota = useRota()
  const [tema, setTema] = useTema()
  return (
    <div className="uygulama">
      <nav className="uyg-nav" aria-label="Ekranlar">
        {SEKMELER.map((s) => (
          <a
            key={s.rota}
            href={s.yol}
            className={`uyg-nav-bag ${rota === s.rota ? 'uyg-nav-bag--secili' : ''}`}
            aria-current={rota === s.rota ? 'page' : undefined}
          >
            {s.etiket}
          </a>
        ))}
        <span className="uyg-nav-sag">
          <a className="uyg-nav-sunum" href={sunumAdresi()} target="_blank" rel="noreferrer"
            title="Salon ekranı için sade ağ görünümü (yeni sekmede)">Sunum modu ↗</a>
          <TemaSecici tema={tema} onDegis={setTema} />
        </span>
      </nav>
      {rota === 'kart-ver' && <KartVerEkrani />}
      {rota === 'kurulum' && <KurulumEkrani />}
      {rota === 'rapor' && <RaporEkrani />}
      {rota === 'pano' && <PanoEkrani />}
    </div>
  )
}
