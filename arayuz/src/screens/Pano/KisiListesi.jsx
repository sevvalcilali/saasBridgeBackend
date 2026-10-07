// Kişi listesi: arama + filtre + rol grupları + kararlı (sakin) sıralama.
// Süzme api/filtre.js, sıralama api/durum.js, yumuşak dizilme useSakinSiralama.
import { useEffect, useMemo, useRef, useState } from 'react'
import { gruplaRol, siralaKisiler } from '../../api/durum.js'
import { filtreleKisiler } from '../../api/filtre.js'
import { useKalici } from '../../api/useKalici.js'
import FiltreCubugu from './FiltreCubugu.jsx'
import KisiSatiri from './KisiSatiri.jsx'
import { useSakinSiralama } from './useSakinSiralama.js'
import './KisiListesi.css'

export default function KisiListesi({ people, vurgulanan = [], seciliId, onKisiSec, onKisiAta }) {
  const [filtre, setFiltre] = useKalici('pano.filtre', 'tumu')
  const [sirala, setSirala] = useKalici('pano.sirala', 'durum') // brief §11: yenilemede korunur
  const [arama, setArama] = useState('')
  const kapRef = useRef(null)
  const vurguSeti = useMemo(() => new Set(vurgulanan), [vurgulanan])

  const gruplar = useMemo(() => {
    const suzulmus = filtreleKisiler(people, { arama, filtre })
    return gruplaRol(suzulmus).map((g) => ({ ...g, kisiler: siralaKisiler(g.kisiler, sirala) }))
  }, [people, arama, filtre, sirala])

  const toplam = gruplar.reduce((n, g) => n + g.kisiler.length, 0)

  // Sıralama değişince (durum sırası) satırlar yumuşak kayar. Tetik: her
  // grubun sıralı id dizisi — yalnız gerçekten sıra değişince yeniden çalışır.
  const siraImzasi = gruplar.map((g) => g.kisiler.map((k) => k.id).join(',')).join('|')
  useSakinSiralama(kapRef, siraImzasi)

  // Vurgulanan kişilerin ilki görünür alana kaydırılır (parıltı görünsün).
  useEffect(() => {
    if (vurgulanan.length === 0) return
    kapRef.current?.querySelector('[data-vurgulu]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [vurgulanan])

  return (
    <div className="kisi-listesi" ref={kapRef}>
      <FiltreCubugu arama={arama} filtre={filtre} sirala={sirala} onArama={setArama} onFiltre={setFiltre} onSirala={setSirala} />

      {toplam === 0 ? (
        <p className="kisi-bos">Bu süzgece uyan kişi yok.</p>
      ) : (
        gruplar.map((grup) => (
          <section key={grup.rol} className="kisi-grup">
            <h2 className="kisi-grup-baslik">
              {grup.baslik}
              <span className="kisi-grup-sayi sayi">{grup.kisiler.length}</span>
            </h2>
            <ul className="kisi-grup-liste">
              {grup.kisiler.map((kisi) => (
                <KisiSatiri
                  key={kisi.id}
                  kisi={kisi}
                  vurgulu={vurguSeti.has(kisi.id)}
                  secili={seciliId === kisi.id}
                  onSec={onKisiSec}
                  onKisiAta={onKisiAta}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
