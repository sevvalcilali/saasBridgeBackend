// Kişi detay paneli: kişi satırına ya da ağ düğümüne tıklayınca sağda açılır.
// Ad/rol/kurum/yıldız/kart no + "kiminle ne kadar" + kart durumu. Tek panel.
// Faz 4 (brief §7): görüşme zaman çizelgesi, "kartı değiştir / iade al" kısayolları (pil gösterilmez, 07.10.2026).
import { useEffect, useRef } from 'react'
import { durumCumlesi, kisiGorusmeleri, gorunenAd } from '../../api/durum.js'
import { sureYazisi, onceYazisi } from '../../api/format.js'
import { RaporApi } from '../../api/raporApi.js'
import { usePanelVerisi } from '../../api/usePanelVerisi.js'
import { kisiOturumlari } from '../../api/rapor.js'
import { kartVerAdresi, kartDegistirAdresi, kartIadeAdresi } from '../../api/useRota.js'
import ZamanCizelgesi from '../../components/ZamanCizelgesi.jsx'
import { RolSekli } from '../../components/KisiRozeti.jsx'
import './DetayPaneli.css'

const ROL_ADI = { investor: 'Yatırımcı', founder: 'Girişimci', guest: 'Misafir' }

export default function DetayPaneli({ kisi, durum, onKapat }) {
  const gorusmeler = kisiGorusmeleri(kisi.id, durum.edges, durum.people)
  const apiRef = useRef(null)
  if (apiRef.current === null) apiRef.current = new RaporApi()
  const { veri, hata: veriHatasi } = usePanelVerisi(apiRef.current)
  // Pano kişisi kart no'yu bilir; görüşme kayıtları kişi kimliğiyle — kayıt defterinden eşle.
  const kayit = veri?.kisiler.find((k) => k.atananKart === kisi.id) ?? null
  const kimlik = kayit?.kisiId ?? `kart:${kisi.id}`
  const oturumlar = veri ? kisiOturumlari(kimlik, veri.oturumlar, veri.kisiler, durum.elapsed) : null

  // Klavye (D14): açılınca odak "Kapat"a geçer, Escape kapatır, kapanınca odak
  // paneli açan satıra/düğüme döner. Kişi değişince (panel açıkken) odak yerinde kalır.
  const kapatRef = useRef(null)
  const onKapatRef = useRef(onKapat)
  onKapatRef.current = onKapat
  useEffect(() => {
    const onceki = document.activeElement
    kapatRef.current?.focus()
    const tus = (e) => { if (e.key === 'Escape') onKapatRef.current() }
    document.addEventListener('keydown', tus)
    return () => {
      document.removeEventListener('keydown', tus)
      if (onceki instanceof HTMLElement && onceki.isConnected) onceki.focus()
    }
  }, [])

  return (
    <aside className="detay" role="dialog" aria-label={`${kisi.name} ayrıntısı`} data-test="detay">
        <header className="detay-bas">
          <span className="detay-renk" style={{ background: kisi.color }} aria-hidden="true" />
          <span className={`kisi-rol kisi-rol--${kisi.role}`} aria-hidden="true" />
          <div className="detay-ad-blok">
            <strong className="detay-ad">{gorunenAd(kisi)}</strong>
            <span className="detay-rol">
              {ROL_ADI[kisi.role]}{kisi.stars ? ` · ${kisi.stars}` : ''}
            </span>
          </div>
          <button type="button" className="detay-kapat" ref={kapatRef} onClick={onKapat} aria-label="Kapat (Esc)" data-test="detay-kapat">✕</button>
        </header>

        <dl className="detay-bilgi">
          <div><dt>Kart no</dt><dd className="sayi">{kisi.id}</dd></div>
          <div><dt>Durum</dt><dd>{durumCumlesi(kisi)}</dd></div>
          <div><dt>Son duyulma</dt><dd>{onceYazisi(kisi.seenAgo)}</dd></div>
          <div><dt>Bugünkü toplam</dt><dd className="sayi">{sureYazisi(kisi.min)}</dd></div>
        </dl>

        <nav className="detay-kisayol" aria-label="Kart işlemleri" data-test="detay-kisayol">
          {kayit ? (
            <>
              <a className="detay-kisayol-bag" href={kartDegistirAdresi(kisi.id)} data-test="kisayol-degistir">Kartı değiştir</a>
              <a className="detay-kisayol-bag" href={kartIadeAdresi(kisi.id)} data-test="kisayol-iade">Kartı iade al</a>
            </>
          ) : veri && (
            <a className="detay-kisayol-bag" href={kartVerAdresi(kisi.id)} data-test="kisayol-ata">Bu karta kişi ata</a>
          )}
        </nav>

        <h3 className="detay-baslik">Bugün kiminle</h3>
        {gorusmeler.length === 0 ? (
          <p className="detay-bos">Henüz kimseyle görüşmedi.</p>
        ) : (
          <ul className="detay-gorusmeler" data-test="detay-gorusme-liste">
            {gorusmeler.map((g) => (
              <li key={g.kisi.id}>
                <span className="detay-g-renk" style={{ background: g.kisi.color }} aria-hidden="true" />
                <RolSekli rol={g.kisi.role} />
                <span className="detay-g-ad">{gorunenAd(g.kisi)}</span>
                <span className="detay-g-sure sayi">{sureYazisi(g.min)}</span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="detay-baslik">Görüşme zaman çizelgesi</h3>
        {oturumlar === null
          ? <p className="detay-bos">{veriHatasi ? 'Görüşme kayıtları alınamadı.' : 'Yükleniyor…'}</p>
          : <ZamanCizelgesi oturumlar={oturumlar} simdi={durum.elapsed} saat={durum.clock} />}
    </aside>
  )
}
