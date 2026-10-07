// Canlı gruplar — "salon" görünümü (Şevval, 2026-10-06): şu an yan yana olanlar küçük karikatür figürlerle küme küme
// (arka sıra + ön sıra), hepsi tek yatay salonda; boştakiler salonun kenarında soluk, tek tek dikilir. Böylece
// topluluk tek bakışta görünür. Figürün rengi kişinin o anki görüşmesinin süresi; yatırımcı ile girişimcinin
// buluştuğu kümenin zemini yeşil. Kümeler ekranda yer değiştirmez (api/gruplar.js yerlestir); yerleri salondaki yeri
// DEĞİLDİR. Pano'nun olağan görünümünde adlar kümenin altında tek satır; büyük görünümde ve sunumda her figürün
// altında. Pano ve sunum modunda ortak.
import { memo, useMemo, useRef } from 'react'
import {
  bostakiler, canliGruplar, grupSiralari, siluetGecikmesi, siluetPozu, SURE_RENKLERI, sureRengi, yalnizMi, yerlestir,
} from '../api/gruplar.js'
import { kisaAd } from '../api/ad.js'
import { sureYazisi } from '../api/format.js'
import Siluet from './Siluet.jsx'
import './CanliGruplar.css'

const GRUPTA_EN_COK = 6 // daha kalabalık grupta ilk 5 kişi + "+N"
const kisaSure = (dk) => sureYazisi(dk).replace(/ \d+ sn$/, '')

// Bir kişi: süre renginde figür. `sade` (olağan Pano): yalnız figür, adı ipucunda; değilse altında adı ve süresi.
// Grubun ortasına dönük durur (`i`, `n`: bütün gruptaki sırası).
function Figur({ k, i, n, vurgulu, secili, sade, isimsiz, onSec }) {
  const renk = sureRengi(k.live).degisken
  const icerik = (
    <>
      <Siluet renk={renk} poz={siluetPozu(k.id)} rol={k.role} ayna={i > (n - 1) / 2} gecikme={siluetGecikmesi(k.id)} />
      {!sade && !isimsiz && <span className="figur-ad">{kisaAd(k)}</span>}
      {!sade && (
        <span className="figur-sure sayi" style={{ color: renk }}>
          <span className="grup-renk" style={{ background: k.color }} aria-hidden="true" />{kisaSure(k.live ?? 0)}
        </span>
      )}
    </>
  )
  const sinif = `figur ${vurgulu ? 'figur--vurgulu' : ''} ${secili ? 'figur--secili' : ''}`
  const baslik = `${kisaAd(k)} · ${kisaSure(k.live ?? 0)}`
  if (!onSec) return <li className={sinif} title={sade ? baslik : undefined}>{icerik}</li>
  return (
    <li className="figur-kap">
      <button type="button" className={sinif} title={baslik}
        data-test="grup-uye" data-id={k.id} onClick={(e) => { e.stopPropagation(); onSec(k.id) }}>
        {icerik}
      </button>
    </li>
  )
}

const Grup = memo(function Grup({ g, vurguSet, seciliId, sade, isimsiz, onKisiSec, onGrupSec }) {
  const n = g.uyeler.length
  const gorunen = n > GRUPTA_EN_COK ? g.uyeler.slice(0, GRUPTA_EN_COK - 1) : g.uyeler
  // Küme (arka + ön sıra) yalnız sade görünümde; adlar figürün altındayken tek sıra daha okunur.
  const [arka, on] = sade ? grupSiralari(gorunen.length, gorunen) : [[], gorunen]
  const vurgulu = g.uyeler.some((u) => vurguSet.has(u.id))
  const etiket = `${n} kişi · ${kisaSure(g.dakika)}`
  const figur = (u, i) => (
    <Figur key={u.id} k={u} i={i} n={gorunen.length} vurgulu={vurguSet.has(u.id)} secili={seciliId === u.id}
      sade={sade} isimsiz={isimsiz} onSec={onKisiSec} />
  )
  return (
    <div className={`grup grup--n${Math.min(n, 5)} ${g.karma ? 'grup--karma' : ''} ${vurgulu ? 'grup--vurgulu' : ''}`}
      role="listitem" data-test="grup" data-karma={g.karma || undefined}
      aria-label={`${etiket}${g.karma ? ', yatırımcı ile girişimci' : ''}`}>
      <div className="grup-sahne" onClick={onGrupSec ? () => onGrupSec(g.uyeler.map((u) => u.id)) : undefined}>
        {arka.length > 0 && <ul className="grup-sira grup-sira--arka">{arka.map((u, i) => figur(u, i))}</ul>}
        <ul className="grup-sira grup-sira--on">
          {on.map((u, i) => figur(u, arka.length + i))}
          {n > gorunen.length && <li className="grup-fazla sayi">+{n - gorunen.length}</li>}
        </ul>
      </div>
      <div className="grup-etiket sayi">{etiket}</div>
      {sade && <div className="grup-adlar">{g.uyeler.map(kisaAd).join(' · ')}</div>}
    </div>
  )
})

// Süre renklerinin açıklaması: renk tek başına bilgi değildir.
function SureAnahtari() {
  return (
    <p className="sure-anahtari" data-test="sure-anahtari">
      <span className="sure-anahtari-bas">Süre:</span>
      {SURE_RENKLERI.map((r) => (
        <span key={r.ad} className="sure-anahtari-oge">
          <span className="sure-anahtari-renk" style={{ background: r.degisken }} aria-hidden="true" />{r.etiket}
        </span>
      ))}
    </p>
  )
}

export default function CanliGruplar({
  people, live = [], vurgulanan = [], seciliId, onKisiSec, onGrupSec, sunum = false, isimsiz = false, buyuk = false,
}) {
  const gruplar = useMemo(() => canliGruplar(people, live), [people, live])
  const imza = gruplar.map((g) => g.anahtar).join('|')
  // Önceki çizimin yerleri: grup büyüyüp küçülse de aynı yerde kalır, yeni grup boş yere çıkar.
  const yerRef = useRef({ yerler: [], atama: new Map() })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gruplar yerine üyelik imzası izlenir
  const { yerler, atama } = useMemo(() => (yerRef.current = yerlestir(yerRef.current.yerler, gruplar)), [imza])
  const yerdeki = new Map(gruplar.map((g) => [atama.get(g.anahtar), g]))
  const { bosta, gorunmeyen } = useMemo(() => bostakiler(people, gruplar), [people, gruplar])
  const vurguSet = useMemo(() => new Set(vurgulanan), [vurgulanan])
  const tiklanir = !sunum && onKisiSec
  const sade = !sunum && !buyuk

  return (
    <div className={`gruplar ${sunum ? 'gruplar--sunum' : ''} ${buyuk ? 'gruplar--buyuk' : ''} ${sade ? 'gruplar--sade' : ''}`}
      data-vurgu={vurgulanan.length > 0 || undefined}>
      <div className="salon">
        {gruplar.length === 0
          ? <p className="gruplar-yok">Şu an birlikte olan kimse yok.</p>
          : (
            <div className="gruplar-alan" role="list" aria-label="Şu an birlikte olanlar">
              {yerler.map((_, yi) => {
                const g = yerdeki.get(yi)
                return g
                  ? <Grup key={g.anahtar} g={g} vurguSet={vurguSet} seciliId={seciliId} sade={sade} isimsiz={isimsiz}
                      onKisiSec={tiklanir ? onKisiSec : undefined} onGrupSec={tiklanir ? onGrupSec : undefined} />
                  : <div key={`bos-${yi}`} className="grup grup--bos" aria-hidden="true" />
              })}
            </div>
          )}

        {/* Salonun kenarı: boştakiler soluk figürlerle tek tek. Sunumda (salon ekranı) kimin boşta olduğu yazılmaz. */}
        <section className="bosta" aria-label="Boşta olanlar" data-test="bosta">
          <h3 className="bosta-baslik">
            Boşta · <span className="sayi">{bosta.length}</span> kişi
            {gorunmeyen.length > 0 && <span className="bosta-gorunmeyen"> · görünmüyor <span className="sayi">{gorunmeyen.length}</span></span>}
          </h3>
          {!sunum && bosta.length > 0 && (
            <ul className="bosta-liste">
              {bosta.map((k) => {
                const yalniz = yalnizMi(k)
                const bekleme = yalniz ? `yalnız · ${sureYazisi(k.idleSinceS / 60).replace(/ \d+ sn$/, '')}` : ''
                return (
                  <li key={k.id}>
                    <button type="button"
                      className={`bosta-kisi ${yalniz ? 'bosta-kisi--yalniz' : ''} ${vurguSet.has(k.id) ? 'figur--vurgulu' : ''}`}
                      data-test="bosta-kisi" data-id={k.id} data-yalniz={yalniz || undefined}
                      title={[kisaAd(k), bekleme].filter(Boolean).join(' · ')}
                      onClick={onKisiSec ? () => onKisiSec(k.id) : undefined}>
                      <Siluet renk={yalniz ? 'var(--uyari)' : 'var(--metin-soluk)'} poz={siluetPozu(k.id)} rol={k.role}
                        className="siluet--bosta" />
                      <span className="bosta-ad">{kisaAd(k)}</span>
                      {yalniz && <span className="bosta-yalniz sayi">{bekleme}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {gruplar.length > 0 && <SureAnahtari />}

      <p className="ag-not">Grupların yeri salondaki yeri göstermez; yalnız şu an kimlerin birlikte olduğunu gösterir.</p>
    </div>
  )
}
