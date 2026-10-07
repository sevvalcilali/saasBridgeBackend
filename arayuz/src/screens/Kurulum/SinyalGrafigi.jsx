// Canlı sinyal grafiği (brief §8): son 90 sn, her çift bir çizgi (iki kişinin
// renkleri, dönüşümlü), eşik yatay kesikli çizgi, eşik üstü bölge NÖTR tonda
// (yeşil değil — eşik üstü ≠ birlikte; Şevval kararı), çizgi sonunda "3 · 4"
// etiketi, üzerine gelince değerler. Eksen sabit: veri gelince oynamaz.
// Görünürlük (2026-10): büyük alan (ekranın ~yarısı, tam ekran seçeneği), kalın çizgi, eşik altındaki
// çiftler soluk, çizgi sonunda kart no yerine ad, üzerine gelinen çift öne çıkar.
// Okunabilirlik (Şevval kararı 2026-10): varsayılan yalnız 1 dk+ birlikte sayılan çiftler (girip çıkan yok),
// çizgi 10 sn ortancası (sistemin karar verdiği değer), ekran 2 sn'de bir tazelenir (KurulumEkrani).
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  grafikSerileri, olcekX, olcekY, xdenSaniye, etiketleriAyir, anlikDegerler, ciftEtiketi, ciftAdi,
  grafikYuksekligi, birlikteAnahtarlari, Y_ALT, Y_UST,
} from '../../api/grafik.js'
import { dbmYazisi } from '../../api/sinyal.js'

// Grafik kabın gerçek piksel genişliğinde çizilir (ölçeklenmez): yazılar her ekranda
// gerçek boyutunda kalır. Kenar boşlukları px; sağda çizgi sonu etiketleri.
const SOL = 40, SAG_DAR = 86, SAG_GENIS = 280, UST = 10, ALT = 26
const IZGARA = [-90, -80, -70, -60, -50, -40]
const NOTR = 'var(--metin-soluk)'

export default function SinyalGrafigi({ history, people, signals = [], esik, pencere, kisiId = null, tamEkran = false }) {
  const [hepsi, setHepsi] = useState(false)
  const [imlec, setImlec] = useState(null) // saniyeÖnce
  const [odak, setOdak] = useState(null) // üzerine gelinen çiftin anahtarı
  const [genislik, setGenislik] = useState(900)
  const [ekranY, setEkranY] = useState(() => window.innerHeight)
  const kapRef = useRef(null)
  useEffect(() => {
    const ro = new ResizeObserver(([g]) => setGenislik(Math.round(g.contentRect.width)))
    ro.observe(kapRef.current)
    const boyut = () => setEkranY(window.innerHeight)
    window.addEventListener('resize', boyut)
    return () => { ro.disconnect(); window.removeEventListener('resize', boyut) }
  }, [])
  const dar = genislik < 640
  const SAG = dar ? SAG_DAR : SAG_GENIS // genişte çizgi sonunda ad yazılır, darda kart no
  const G = Math.max(160, genislik - SOL - SAG)
  const Y = grafikYuksekligi(genislik, ekranY, tamEkran)
  const etiket = dar ? ciftEtiketi : ciftAdi

  const { seriler, toplam, birlikteSayisi } = useMemo(
    () => grafikSerileri(history, people, { hepsi, kisiId, birlikte: birlikteAnahtarlari(signals), yumusak: true }),
    [history, people, signals, hepsi, kisiId],
  )

  const x = (sn) => SOL + olcekX(sn, G, pencere)
  const y = (v) => UST + olcekY(v, Y)
  const yol = (s) => s.noktalar.map(([sn, v], i) => `${i ? 'L' : 'M'}${x(sn).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const etiketY = etiketleriAyir(seriler.map((s) => y(s.son)), 18, UST + 6, UST + Y - 2)
  const odakAyarla = (anahtar) => ({ onPointerEnter: () => setOdak(anahtar), onPointerLeave: () => setOdak(null) })
  const anlik = imlec === null ? [] : anlikDegerler(seriler, imlec)

  function hareket(e) {
    const vx = e.clientX - e.currentTarget.getBoundingClientRect().left - SOL
    setImlec(vx < 0 || vx > G ? null : xdenSaniye(vx, G, pencere))
  }

  return (
    <div className="grafik" ref={kapRef} data-test="sinyal-grafigi">
      {toplam === 0 ? (
        <p className="kartver-iskele">{kisiId ? 'Bu kişinin şu an duyulan çifti yok.' : 'Henüz sinyal yok.'}</p>
      ) : (<>
      <div className="grafik-ust">
        <p className="grafik-ozet" data-test="grafik-ozet">
          {kisiId ? <><strong>{seriler.length}</strong> çift gösteriliyor.</>
            : hepsi ? <>Duyulan <strong>{toplam}</strong> çiftin hepsi gösteriliyor.</>
            : <>
                1 dakikadan uzun yakın duran (birlikte) <strong>{birlikteSayisi}</strong> çift
                {birlikteSayisi > seriler.length && <>; ilk {seriler.length} tanesi — kişi seçerek daraltın</>}
                {' '}· toplam {toplam} çift duyuluyor.
              </>}
        </p>
        {!kisiId && (
          <button type="button" className="kartver-geri grafik-dugme" aria-pressed={hepsi}
            onClick={() => setHepsi((h) => !h)} data-test="grafik-hepsi">
            {hepsi ? 'Yalnız birlikte olanlar' : `Tümünü göster (${toplam})`}
          </button>
        )}
      </div>
      {seriler.length === 0 ? (
        <p className="kartver-iskele" data-test="grafik-birlikte-yok">
          Şu an 1 dakikadan uzun yakın duran çift yok. Bütün çiftleri görmek için "Tümünü göster".
        </p>
      ) : (

      <div className="grafik-kutu" onPointerMove={hareket} onPointerLeave={() => setImlec(null)}>
        <svg data-odak={odak || undefined} width={SOL + G + SAG} height={UST + Y + ALT} viewBox={`0 0 ${SOL + G + SAG} ${UST + Y + ALT}`} role="img"
          aria-label={`Son ${pencere} saniyede ${seriler.length} çiftin sinyal gücü; eşik ${esik} dBm. Değerler aşağıdaki çift tablosunda.`}>
          {/* eşik üstü bölge: nötr ton */}
          <rect x={SOL} y={y(Y_UST)} width={G} height={y(esik) - y(Y_UST)} className="grafik-bolge" />
          {IZGARA.map((v) => (
            <g key={v}>
              <line x1={SOL} x2={SOL + G} y1={y(v)} y2={y(v)} className="grafik-izgara" />
              <text x={SOL - 6} y={y(v) + 4} className="grafik-eksen" textAnchor="end">{v}</text>
            </g>
          ))}
          {[pencere, pencere * 2 / 3, pencere / 3, 0].map((sn) => (
            <text key={sn} x={x(sn)} y={UST + Y + 18} className="grafik-eksen"
              textAnchor={sn === 0 ? 'end' : sn === pencere ? 'start' : 'middle'}>
              {sn === 0 ? 'şimdi' : `${Math.round(sn)} sn önce`}
            </text>
          ))}
          <text x={SOL + 6} y={y(Y_UST) + 14} className="grafik-bolge-yazi">eşik üstü — yakın</text>

          {seriler.map((s) => (
            // Eşik altındaki çift soluk: göz önce "yakın" sayılanlara gider.
            <g key={s.anahtar} data-test="grafik-cizgi" data-cift={s.anahtar} data-ust={s.son >= esik || undefined}
              className={`grafik-seri ${s.son >= esik ? '' : 'grafik-seri--alt'} ${odak === s.anahtar ? 'grafik-seri--odak' : ''}`}
              {...odakAyarla(s.anahtar)}>
              <path d={yol(s)} className="grafik-vurus" />
              <path d={yol(s)} className="grafik-cizgi" stroke={s.a.color ?? NOTR} />
              <path d={yol(s)} className="grafik-cizgi grafik-cizgi--ikinci" stroke={s.b.color ?? NOTR} />
            </g>
          ))}

          <line x1={SOL} x2={SOL + G} y1={y(esik)} y2={y(esik)} className="grafik-esik" data-test="grafik-esik" />
          <text x={SOL + G - 4} y={y(esik) - 5} className="grafik-esik-yazi" textAnchor="end">eşik {esik}</text>

          {seriler.map((s, i) => (
            <g key={s.anahtar} data-test="grafik-etiket"
              className={`grafik-etiket grafik-seri ${s.son >= esik ? '' : 'grafik-seri--alt'} ${odak === s.anahtar ? 'grafik-seri--odak' : ''}`}
              {...odakAyarla(s.anahtar)}>
              <line x1={x(s.noktalar[s.noktalar.length - 1][0])} x2={SOL + G + 6}
                y1={y(s.son)} y2={etiketY[i]} className="grafik-etiket-bag" />
              <circle cx={SOL + G + 12} cy={etiketY[i]} r={4} fill={s.a.color ?? NOTR} />
              <circle cx={SOL + G + 22} cy={etiketY[i]} r={4} fill={s.b.color ?? NOTR} />
              <text x={SOL + G + 30} y={etiketY[i] + 4} className="grafik-etiket-yazi">{etiket(s)}</text>
            </g>
          ))}

          {imlec !== null && <line x1={x(imlec)} x2={x(imlec)} y1={UST} y2={UST + Y} className="grafik-imlec" />}
        </svg>

        {imlec !== null && anlik.length > 0 && (
          <div className="grafik-ipucu" role="status" data-test="grafik-ipucu"
            style={{ left: `${Math.min(78, Math.max(22, (x(imlec) / (SOL + G + SAG)) * 100))}%` }}>
            <p className="grafik-ipucu-zaman">{Math.round(imlec)} sn önce</p>
            <ul>
              {anlik.map(({ seri, deger }) => (
                <li key={seri.anahtar}>
                  <span className="grafik-nokta" style={{ background: seri.a.color ?? NOTR }} />
                  <span className="grafik-nokta" style={{ background: seri.b.color ?? NOTR }} />
                  <span className="grafik-ipucu-cift">{ciftAdi(seri)} <span className="grafik-ipucu-kart">({ciftEtiketi(seri)})</span></span>
                  <span className="sayi">{dbmYazisi(deger)} dBm</span>
                  <span className={`grafik-ipucu-durum ${deger >= esik ? 'grafik-ipucu-durum--ust' : ''}`}>
                    {deger >= esik ? 'eşik üstü' : 'altı'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}
      </>)}
    </div>
  )
}
