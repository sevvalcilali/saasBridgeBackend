// "Boştaki kartlar" şeridi (brief §6.4): atanmamış ama açık kartlar — masadaki
// yedekler, stok takibi. Numaraya göre sabit sıralı; yalnız görüntüler.
// Pil yüzdesi masada gösterilmez (Şevval kararı, 2026-10); kart sağlığı Kurulum'da.
import { bostakiKartlar } from '../../api/masaYardim.js'

export default function BostakiKartlar({ kartlar }) {
  if (!kartlar) return null
  const liste = bostakiKartlar(kartlar)
  return (
    <section className="stok" aria-label="Boştaki kartlar" data-test="bostaki-kartlar">
      <h2 className="kontrol-baslik">
        Boştaki kartlar <span className="kartsec-sayi" data-test="bostaki-sayi">{liste.length}</span>
      </h2>
      {liste.length === 0 ? (
        <p className="kartver-iskele">Masada açık, boş kart yok.</p>
      ) : (
        <ul className="stok-liste">
          {liste.map((k) => (
            <li key={k.kart} className="stok-kart" data-test="bostaki-kart">
              <span className="kartsec-acik" aria-hidden="true" />
              <span className="kartsec-no">Kart {k.kart}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
