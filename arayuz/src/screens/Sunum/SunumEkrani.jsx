// Sunum modu (brief §4.5, "?clean=1"): salondaki büyük ekranda katılımcılara
// gösterilen sade ağ görünümü. Menü, liste, bildirim yok; tıklanmaz. İsimli ya da
// isimsiz. Araç çubuğu köşede sakin durur, üzerine gelince belirir.
import { useState } from 'react'
import { usePano } from '../../api/usePano.js'
import { useTema } from '../../api/useTema.js'
import { ozetKutulari, veriCanli } from '../../api/durum.js'
import { isimsizMi, sunumAdresi, SUNUMDAN_CIKIS } from '../../api/useRota.js'
import CanliGruplar from '../../components/CanliGruplar.jsx'
import HataBantlari from '../../components/HataBantlari.jsx'
import TemaSecici from '../../components/TemaSecici.jsx'
import './SunumEkrani.css'

export default function SunumEkrani() {
  const { durum, baglandi, hata } = usePano()
  const [tema, setTema] = useTema()
  const [isimsiz, setIsimsiz] = useState(() => isimsizMi(window.location.search))

  // Seçim adreste durur: salon ekranı yenilense de aynı görünüm gelir.
  function isimsizSec(deger) {
    setIsimsiz(deger)
    window.history.replaceState(null, '', sunumAdresi(deger))
  }

  const araclar = (
    <div className="sunum-araclar" data-test="sunum-araclar">
      <div className="tema-secici" role="group" aria-label="Adlar">
        {[[false, 'İsimli'], [true, 'İsimsiz']].map(([deger, etiket]) => (
          <button key={etiket} type="button" className="tema-secici-dugme" data-test={`sunum-${deger ? 'isimsiz' : 'isimli'}`}
            aria-pressed={isimsiz === deger} onClick={() => isimsizSec(deger)}>
            {etiket}
          </button>
        ))}
      </div>
      <TemaSecici tema={tema} onDegis={setTema} />
      <a className="sunum-cikis" href={SUNUMDAN_CIKIS}>Sunumdan çık</a>
    </div>
  )

  if (!durum) {
    return (
      <main className="sunum sunum--bos">
        {araclar}
        <p className="sunum-bilgi">{hata ? 'Sunucuya bağlanılamıyor, yeniden deneniyor…' : 'Veri bekleniyor…'}</p>
      </main>
    )
  }

  return (
    <main className={`sunum ${veriCanli(durum, baglandi) ? '' : 'sunum--soluk'}`} data-test="sunum">
      <HataBantlari durum={durum} baglandi={baglandi} />
      {araclar}
      <header className="sunum-ust">
        <div>
          <h1 className="sunum-ad">{durum.event.name}</h1>
          {durum.event.sub && <p className="sunum-alt">{durum.event.sub}</p>}
        </div>
        <time className="sunum-saat sayi">{durum.clock.slice(0, 5)}</time>
      </header>

      <CanliGruplar people={durum.people} live={durum.live} sunum isimsiz={isimsiz} />

      <footer className="sunum-alt-serit">
        <ul className="sunum-kutular">
          {ozetKutulari(durum).map((k) => (
            <li key={k.ad} className="sunum-kutu">
              <span className="sunum-deger sayi">{k.deger}</span>
              <span className="sunum-kutu-ad">{k.ad}</span>
            </li>
          ))}
        </ul>
        <p className="sunum-anahtar">
          <span aria-hidden="true">○</span> yatırımcı · <span aria-hidden="true">□</span> girişimci ·{' '}
          <span aria-hidden="true">◇</span> misafir · <span className="sunum-birlikte">yeşil zemin = yatırımcı ile girişimci birlikte · siluet rengi = görüşme süresi</span>
        </p>
      </footer>
    </main>
  )
}
