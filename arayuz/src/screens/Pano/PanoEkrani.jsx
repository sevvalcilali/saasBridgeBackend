// Organizatör canlı panosu — üst düzey ekran (PLAN Faz 1).
// Bölge iskeleti: üst şerit (1.2 hazır), gövde (sol · orta · sağ), alt şerit.
// Orta bölgeler adım adım doldurulur (1.3–1.16).
import { useCallback, useEffect, useState } from 'react'
import { usePano } from '../../api/usePano.js'
import { useKalici } from '../../api/useKalici.js'
import UstSerit from './UstSerit.jsx'
import KisiListesi from './KisiListesi.jsx'
import BildirimAkisi from './BildirimAkisi.jsx'
import AltSerit from './AltSerit.jsx'
import HataBantlari from '../../components/HataBantlari.jsx'
import EgoGorunumu from '../../components/EgoGorunumu.jsx'
import CanliGruplar from '../../components/CanliGruplar.jsx'
import DetayPaneli from './DetayPaneli.jsx'
import UyariPenceresi from './UyariPenceresi.jsx'
import { kartVerAdresi, KURULUM_ADRESI } from '../../api/useRota.js'
import { veriCanli } from '../../api/durum.js'
import './PanoEkrani.css'

export default function PanoEkrani() {
  const { durum, baglandi, hata, baglanti } = usePano()
  // Bir bildirime tıklayınca ilgili kişiler vurgulanır (liste satırları; ağ 1.13).
  const [vurgulanan, setVurgulanan] = useState([])
  // Satıra/düğüme tıklayınca açılan detay paneli (tek panel).
  const [seciliId, setSeciliId] = useState(null)
  // Telefonda (≤600px) tek bölge gösterilir; son sekme korunur (brief §11).
  const [sekme, setSekme] = useKalici('pano.sekme', 'kisiler')
  // Orta bölge: "Şimdi" canlı gruplar (varsayılan), "Gün boyu" seçili kişinin gün boyu görüştükleri (ego).
  const [agGorunum, setAgGorunum] = useKalici('pano.agGorunum', 'simdi')
  // "Büyük görünüm": kişi listesi ve bildirimler katlanır, figürler ekranın tamamında (Esc ile çıkılır).
  const [buyuk, setBuyuk] = useKalici('pano.buyuk', false)
  useEffect(() => {
    if (!buyuk) return
    const tus = (e) => { if (e.key === 'Escape') setBuyuk(false) }
    window.addEventListener('keydown', tus)
    return () => window.removeEventListener('keydown', tus)
  }, [buyuk, setBuyuk])

  // Parıltı 3 sn sonra kendiliğinden söner (brief §7 tıkla-vurgula, sakin).
  useEffect(() => {
    if (vurgulanan.length === 0) return
    const zaman = setTimeout(() => setVurgulanan([]), 3000)
    return () => clearTimeout(zaman)
  }, [vurgulanan])

  // Kararlı referanslar: memo'lu satır/düğümler her tik yeniden çizilmesin.
  const kisiSec = useCallback((id) => {
    setSeciliId((onceki) => (onceki === id ? null : id))
  }, [])

  const bildirimTikla = useCallback((bildirim) => {
    // Telefonda (≤600px) tek bölge görünür: vurgulanan kişiler görünsün diye Kişiler'e geç.
    if (window.matchMedia?.('(max-width: 600px)').matches) setSekme('kisiler')
    setVurgulanan((onceki) =>
      onceki.length === bildirim.people.length && onceki.every((x, i) => x === bildirim.people[i])
        ? [] // aynı bildirime tekrar tıkla → vurguyu kaldır
        : bildirim.people,
    )
  }, [setSekme])

  // Bir gruba tıklayınca üyeleri listede ve gruplarda parlar (bildirim tıklamasıyla aynı vurgu).
  const grupTikla = useCallback((idler) => {
    setVurgulanan((onceki) => (onceki.length === idler.length && onceki.every((x, i) => x === idler[i]) ? [] : idler))
  }, [])

  // Atanmamış kart ("Kart N") → karşılama masası o kartla açılır, kişi seçilir.
  const kisiAta = useCallback((kisi) => { window.location.hash = kartVerAdresi(kisi.id) }, [])
  // Eşik rozeti → Kurulum sayfası (eşik ayarı, Faz 3).
  const esikAc = useCallback(() => { window.location.hash = KURULUM_ADRESI }, [])

  const seciliKisi = durum?.people.find((k) => k.id === seciliId)

  if (!durum) {
    return (
      <main className="pano pano--bos">
        <p className="bilgi">
          {hata ? 'Sunucuya bağlanılamıyor, yeniden deneniyor…' : 'Veri bekleniyor…'}
        </p>
      </main>
    )
  }

  function sifirlaIste() {
    // Yıkıcı işlem: brief §5, tüm süre/geçmiş/bildirim silinir → önce onay.
    const onay = window.confirm(
      'Tüm süreler, geçmiş ve bildirimler sıfırlanacak. Emin misiniz?',
    )
    if (onay) baglanti.sifirla()
  }

  return (
    <div className={`pano ${veriCanli(durum, baglandi) ? '' : 'pano--soluk'} ${buyuk ? 'pano--buyuk' : ''}`}>
      <HataBantlari durum={durum} baglandi={baglandi} />
      <UyariPenceresi alerts={durum.alerts} people={durum.people} onGoster={setVurgulanan} />
      <UstSerit durum={durum} onSifirla={sifirlaIste} onEsikTikla={esikAc} />

      <nav className="pano-sekmeler" role="tablist" aria-label="Bölüm">
        {[['kisiler', 'Kişiler'], ['ag', 'Ağ'], ['bildirimler', 'Bildirimler']].map(([deger, etiket]) => (
          <button
            key={deger}
            type="button"
            role="tab"
            aria-selected={sekme === deger}
            className={`pano-sekme ${sekme === deger ? 'pano-sekme--secili' : ''}`}
            onClick={() => setSekme(deger)}
          >
            {etiket}
          </button>
        ))}
      </nav>

      <div className="pano-govde" data-sekme={sekme}>
        <section className="pano-sol" data-bolge="sol" aria-label="Kişiler">
          <KisiListesi
            people={durum.people}
            vurgulanan={vurgulanan}
            seciliId={seciliId}
            onKisiSec={kisiSec}
            onKisiAta={kisiAta}
          />
        </section>
        <section className="pano-orta" data-bolge="orta" aria-label="Ağ görünümü">
          <div className="pano-ag-ust">
            <div className="tema-secici pano-ag-secici" role="group" aria-label="Görünüm">
              {[['simdi', 'Şimdi'], ['gun', 'Gün boyu']].map(([deger, etiket]) => (
                <button key={deger} type="button" className="tema-secici-dugme" data-test={`ag-${deger}`}
                  aria-pressed={agGorunum === deger} onClick={() => setAgGorunum(deger)}>
                  {etiket}
                </button>
              ))}
            </div>
            <button type="button" className="kartver-geri pano-buyut" aria-pressed={buyuk} data-test="pano-buyut"
              onClick={() => setBuyuk((b) => !b)} title={buyuk ? 'Küçült (Esc)' : 'Figürleri büyük göster'}>
              {buyuk ? '⤡ Küçült' : '⤢ Büyük görünüm'}
            </button>
          </div>
          {agGorunum === 'gun' ? (
            seciliKisi
              ? <EgoGorunumu kisi={seciliKisi} people={durum.people} edges={durum.edges} live={durum.live} onKisiSec={kisiSec} />
              : <p className="ego-sec" data-test="ego-sec">Bir kişinin gün boyu kiminle ne kadar görüştüğünü görmek için soldaki listeden ya da bir daireden onu seçin. Bütün etkinliğin özeti Rapor'da.</p>
          ) : (
            <CanliGruplar
              buyuk={buyuk}
              people={durum.people}
              live={durum.live}
              vurgulanan={vurgulanan}
              seciliId={seciliId}
              onKisiSec={kisiSec}
              onGrupSec={grupTikla}
            />
          )}
        </section>
        <aside className="pano-sag" data-bolge="sag" aria-label="Bildirimler">
          <BildirimAkisi alerts={durum.alerts} vurgulanan={vurgulanan} onBildirimTikla={bildirimTikla} />
        </aside>
      </div>

      <footer className="pano-alt" data-bolge="alt">
        <AltSerit durum={durum} />
      </footer>

      {seciliKisi && <DetayPaneli kisi={seciliKisi} durum={durum} onKapat={() => setSeciliId(null)} />}
    </div>
  )
}
