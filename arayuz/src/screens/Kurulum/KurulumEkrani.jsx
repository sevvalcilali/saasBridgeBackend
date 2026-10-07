// Kurulum / eşik ekranı (brief §4.3, §8) — teknik kişi etkinlik öncesi kullanır:
// eşik ayarı, canlı sinyal grafiği, çift tablosu, kalibrasyon, kart sağlığı.
// Veri panoyla aynı kaynaktan (usePano / SSE); dBm burada gösterilebilir, metre yok.
import { useEffect, useRef, useState } from 'react'
import { usePano } from '../../api/usePano.js'
import { ciftSayisi } from '../../api/sinyal.js'
import { veriCanli } from '../../api/durum.js'
import { KurulumApi } from '../../api/kurulumApi.js'
import { useKartlar } from '../../api/useKartlar.js'
import { useSeyrekDurum } from '../../api/useSeyrek.js'
import { onceYazisi } from '../../api/format.js'
import { useKalici } from '../../api/useKalici.js'
import HataBantlari from '../../components/HataBantlari.jsx'
import EsikAyari from './EsikAyari.jsx'
import CiftTablosu from './CiftTablosu.jsx'
import SinyalGrafigi from './SinyalGrafigi.jsx'
import PerspektifSecici from './PerspektifSecici.jsx'
import KalibrasyonSihirbazi from './KalibrasyonSihirbazi.jsx'
import KartSagligi from './KartSagligi.jsx'
import './KurulumEkrani.css'

// Grafik ve çift tablosu dakikada bir birlikte tazelenir (Şevval kararı, 2026-10: hızlı değişen ekran okunmuyor).
// Kaydırıcı, eşik çizgisi ve "şu an N çift eşiğin üstünde" sayısı anında kalır (kalibrasyon geri bildirimi).
// Beklemek istemeyen "Şimdi güncelle"ye basar.
const TAZELEME_MS = 60000

export default function KurulumEkrani() {
  const { durum, baglandi, hata, baglanti } = usePano({ grafik: true }) // sinyal grafiği yalnız burada
  const [taslakEsik, setTaslakEsik] = useState(null) // kaydırılırken grafik anında izler
  const [perspektif, setPerspektif] = useKalici('kurulum.perspektif', null) // seçili kişinin kart no'su; yenilemede korunur
  const apiRef = useRef(null)
  if (apiRef.current === null) apiRef.current = new KurulumApi()
  const { kartlar } = useKartlar(apiRef.current)
  const [yenile, setYenile] = useState(0)
  const { deger: anlik, zaman: tazelendi } = useSeyrekDurum(
    durum && { history: durum.history, people: durum.people, signals: durum.signals }, TAZELEME_MS, true, yenile,
  )
  // Eşik + grafik paneli tam ekrana açılabilir (kalibrasyonda laptop ya da salon ekranı).
  const sinyalRef = useRef(null)
  const [tamEkran, setTamEkran] = useState(false)
  useEffect(() => {
    const degisti = () => setTamEkran(document.fullscreenElement != null && document.fullscreenElement === sinyalRef.current)
    document.addEventListener('fullscreenchange', degisti)
    return () => document.removeEventListener('fullscreenchange', degisti)
  }, [])
  const tamEkranDegistir = () => (tamEkran ? document.exitFullscreen() : sinyalRef.current?.requestFullscreen?.())

  if (!durum) {
    return (
      <main className="kurulum kurulum--bos">
        <p className="kartver-iskele">{hata ? 'Sunucuya bağlanılamıyor, yeniden deneniyor…' : 'Veri bekleniyor…'}</p>
      </main>
    )
  }

  return (
    <main className={`kurulum ${veriCanli(durum, baglandi) ? '' : 'kurulum--soluk'}`}>
      <HataBantlari durum={durum} baglandi={baglandi} />
      <header className="kurulum-bas">
        <h1>Kurulum</h1>
        <p className="kurulum-alt">Teknik ekran — eşik ayarı, sinyaller ve kart sağlığı. Etkinlik öncesi kullanılır.</p>
      </header>

      {/* Eşik ve canlı sinyal tek, tam genişlikte panelde: kaydırınca eşik çizgisi hemen altında hareket eder. */}
      <section className="kurulum-kutu kurulum-sinyal" ref={sinyalRef} aria-labelledby="k-grafik" data-test="kutu-grafik">
        <div className="kurulum-sinyal-bas">
          <h2 id="k-grafik" className="kurulum-baslik">Eşik ve canlı sinyal (son {durum.chartSeconds} sn)</h2>
          <p className="kurulum-tazeleme" data-test="kurulum-tazeleme">
            Son güncelleme: {onceYazisi((Date.now() - tazelendi) / 1000)} · dakikada bir
          </p>
          <button type="button" className="kartver-geri grafik-dugme" onClick={() => setYenile((n) => n + 1)} data-test="kurulum-simdi">
            Şimdi güncelle
          </button>
          {document.fullscreenEnabled && (
            <button type="button" className="kartver-geri grafik-dugme" onClick={tamEkranDegistir} data-test="grafik-tam-ekran">
              {tamEkran ? 'Tam ekrandan çık' : 'Tam ekran'}
            </button>
          )}
        </div>
        <div className="kurulum-sinyal-esik" data-test="kutu-esik">
          <EsikAyari esik={durum.threshold} signals={durum.signals} onGonder={(v) => baglanti.esikGonder(v)} onTaslak={setTaslakEsik} />
        </div>
        <PerspektifSecici signals={durum.signals} people={durum.people} secili={perspektif} onSec={setPerspektif} />
        <SinyalGrafigi history={anlik.history} people={anlik.people} signals={anlik.signals} esik={taslakEsik ?? durum.threshold}
          pencere={durum.chartSeconds} kisiId={perspektif} tamEkran={tamEkran} />
      </section>

      <div className="kurulum-govde">
        <div className="kurulum-ana">
          <section className="kurulum-kutu" aria-labelledby="k-ciftler" data-test="kutu-ciftler">
            <h2 id="k-ciftler" className="kurulum-baslik">Çiftler <span className="kartsec-sayi">{ciftSayisi(anlik.signals, perspektif)}</span></h2>
            <p className="kurulum-not" data-test="tablo-seyrek">Tablo grafikle birlikte dakikada bir güncellenir. Bir kişiye odaklanmak için adına tıklayın.</p>
            <CiftTablosu signals={anlik.signals} people={anlik.people} kisiId={perspektif} onKisiSec={setPerspektif} />
          </section>
        </div>
        <div className="kurulum-yan">
          <section className="kurulum-kutu" aria-labelledby="k-kalibrasyon" data-test="kutu-kalibrasyon">
            <h2 id="k-kalibrasyon" className="kurulum-baslik">Kalibrasyon</h2>
            <KalibrasyonSihirbazi signals={durum.signals} people={durum.people} esik={durum.threshold}
              api={apiRef.current} onEsikGonder={(v) => baglanti.esikGonder(v)} />
          </section>
          <section className="kurulum-kutu" aria-labelledby="k-saglik" data-test="kutu-saglik">
            <h2 id="k-saglik" className="kurulum-baslik">Kart sağlığı</h2>
            <KartSagligi kartlar={kartlar} people={durum.people} />
          </section>
        </div>
      </div>
    </main>
  )
}
