// Kalibrasyon sihirbazı (brief §8): 1) iki kart yüz yüze → Kaydet (10 sn ortanca)
// 2) sırt sırta ya da 2–3 adım uzakta → Kaydet 3) ikisinin ortası eşik önerilir → onayla.
// Ölçüm: "Kaydet" 10 sn geri sayar; sonunda çiftin `value`'su (son 10 sn ortancası)
// tam tutulan pencereyi verir.
import { memo, useEffect, useRef, useState } from 'react'
import { ciftSatirlari, dbmYazisi } from '../../api/sinyal.js'
import { kisaAd } from '../../api/ad.js'
import { onerilenEsik, kalanSaniye, KALIBRASYON_SN } from '../../api/kalibrasyon.js'
import { ESIK_ALT, ESIK_UST } from '../../api/esik.js'
import KisiRozeti from '../../components/KisiRozeti.jsx'
import { useDemo } from '../../api/useDemo.js'
import KalibrasyonCizim from './KalibrasyonCizim.jsx'

const ADIMLAR = [
  { tur: 'yuzyuze', baslik: 'Yüz yüze', yonerge: 'İki kartı iki kişi göğüs hizasında, yüz yüze ve konuşur gibi tutsun.' },
  { tur: 'sirtsirta', baslik: 'Sırt sırta', yonerge: 'Şimdi sırt sırta dursunlar (ya da 2–3 adım uzaklaşsınlar).' },
]
// Çift seçenekleri yalnız çift listesi (ve adlar) değişince yeniden çizilir; değerler her
// tik değişse de seçenek metni değişmez (kalabalıkta yüzlerce <option>).
const CiftSecenekleri = memo(
  ({ satirlar }) => satirlar.map((r) => (
    <option key={r.anahtar} value={r.anahtar}>{r.a.id} · {r.b.id} — {kisaAd(r.a)} · {kisaAd(r.b)}</option>
  )),
  (p, n) => p.imza === n.imza,
)
const secenekImzasi = (satirlar) => satirlar.map((r) => `${r.anahtar}:${kisaAd(r.a)}:${kisaAd(r.b)}`).join('|')

const yuzde = (v) => `${((v - ESIK_ALT) / (ESIK_UST - ESIK_ALT)) * 100}%`

export default function KalibrasyonSihirbazi({ signals, people, esik, api, onEsikGonder }) {
  const [cift, setCift] = useState('')
  const demoVar = useDemo(api) // demo düğmeleri yalnız mock sunucuda
  const [olcum, setOlcum] = useState({ yuzyuze: null, sirtsirta: null })
  const [olcuyor, setOlcuyor] = useState(null) // { tur, baslangic }
  const [simdi, setSimdi] = useState(() => Date.now())
  const [hata, setHata] = useState(null)
  const [uygula, setUygula] = useState('bos') // bos | gonderiliyor | tamam | hata
  const demoRef = useRef(null) // { a, b } — zorlanan demo çifti (bırakmak için)

  const satirlar = ciftSatirlari(signals, people)
  const secili = satirlar.find((r) => r.anahtar === cift)
  const degerRef = useRef(null)
  degerRef.current = secili?.value ?? null

  const adim = olcum.yuzyuze == null ? 0 : olcum.sirtsirta == null ? 1 : 2
  const oneri = onerilenEsik(olcum.yuzyuze, olcum.sirtsirta)

  // Geri sayım: bitince o anki 10 sn ortancası kaydedilir.
  useEffect(() => {
    if (!olcuyor) return
    const z = setInterval(() => {
      const t = Date.now()
      setSimdi(t)
      if (kalanSaniye(olcuyor.baslangic, t) === 0) {
        clearInterval(z)
        const v = degerRef.current
        if (v == null) setHata('Bu çift şu an duyulmuyor — kartların açık olduğundan emin olup tekrar deneyin.')
        else setOlcum((o) => ({ ...o, [olcuyor.tur]: v }))
        setOlcuyor(null)
      }
    }, 250)
    return () => clearInterval(z)
  }, [olcuyor])

  // Ayrılırken demo çiftini serbest bırak (yalnız mock).
  useEffect(() => () => { if (demoRef.current) api.demoTut(demoRef.current.a, demoRef.current.b, null).catch(() => {}) }, [api])

  function cifteGec(anahtar) {
    setCift(anahtar)
    setOlcum({ yuzyuze: null, sirtsirta: null })
    setOlcuyor(null); setHata(null); setUygula('bos')
  }
  function olc(tur) {
    setHata(null)
    const t = Date.now()
    setSimdi(t)
    setOlcuyor({ tur, baslangic: t })
  }
  function demo(tur) {
    // Başka bir çift zorlanıyorsa önce onu bırak; yoksa oturum boyunca "yakın" kalıp sahte görüşme üretir.
    const onceki = demoRef.current
    if (onceki && (onceki.a !== secili.a.id || onceki.b !== secili.b.id)) api.demoTut(onceki.a, onceki.b, null).catch(() => {})
    demoRef.current = { a: secili.a.id, b: secili.b.id }
    api.demoTut(secili.a.id, secili.b.id, tur).catch(() => setHata('Demo çalışmadı (yalnız mock sunucuda var).'))
  }
  async function esigiUygula() {
    setUygula('gonderiliyor')
    try {
      const oldu = await onEsikGonder(oneri.deger)
      setUygula(oldu === false ? 'hata' : 'tamam')
    } catch { setUygula('hata') }
  }

  return (
    <div className="kalib" data-test="kalibrasyon">
      <label className="perspektif-etiket kalib-sec">
        Kalibrasyon kartları
        <select value={cift} onChange={(e) => cifteGec(e.target.value)} data-test="kalib-cift">
          <option value="">— çift seçin —</option>
          <CiftSecenekleri satirlar={satirlar} imza={secenekImzasi(satirlar)} />
          {cift && !secili && <option value={cift}>{cift.replace('-', ' · ')} — şu an duyulmuyor</option>}
        </select>
      </label>

      {!cift && <p className="kartver-iskele">Elinizdeki iki kartın çiftini seçin. Çift listede yoksa kartlar açık mı, alıcı duyuyor mu kontrol edin.</p>}

      {cift && (
        <>
          <p className="kalib-canli">
            {secili ? <><KisiRozeti kisi={secili.a} /> · <KisiRozeti kisi={secili.b} /> şu an <strong className="sayi">{dbmYazisi(secili.value)} dBm</strong></>
              : '⚠ Bu çift şu an duyulmuyor.'}
          </p>

          <ol className="kalib-adimlar">
            {ADIMLAR.map((a, i) => (
              <li key={a.tur} className={`kalib-adim ${adim === i ? 'kalib-adim--etkin' : ''}`} data-test={`kalib-${a.tur}`}>
                <KalibrasyonCizim tur={a.tur} />
                <div className="kalib-adim-govde">
                  <p className="kalib-adim-baslik">{i + 1}. {a.baslik}</p>
                  {olcum[a.tur] != null ? (
                    <p className="kalib-sonuc">✓ <strong className="sayi">{dbmYazisi(olcum[a.tur])} dBm</strong>
                      <button type="button" className="kartver-geri kalib-kucuk" disabled={!!olcuyor} onClick={() => olc(a.tur)}>Tekrarla</button>
                    </p>
                  ) : adim === i && (
                    <>
                      <p className="kalib-yonerge">{a.yonerge}</p>
                      {olcuyor?.tur === a.tur ? (
                        <p className="kalib-sayac" role="status" data-test="kalib-sayac">
                          Tutmaya devam edin… <strong className="sayi">{kalanSaniye(olcuyor.baslangic, simdi)}</strong> sn
                        </p>
                      ) : (
                        <button type="button" className="kisisec-ekle" disabled={!secili} onClick={() => olc(a.tur)} data-test="kalib-kaydet">
                          Kaydet ({KALIBRASYON_SN} sn)
                        </button>
                      )}
                      {demoVar && (
                        <div className="yaklastir-demo">
                          <span className="yaklastir-demo-etiket">Demo — donanım yok, bu duruşu taklit et:</span>
                          <button type="button" className="kartver-geri" disabled={!secili} onClick={() => demo(a.tur)} data-test={`kalib-demo-${a.tur}`}>
                            Çifti {a.baslik.toLocaleLowerCase('tr')} tut
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}

          {oneri && (
            <div className="kalib-oneri" data-test="kalib-oneri">
              <p className="kalib-adim-baslik">3. Eşiği ortaya koy</p>
              <div className="kalib-olcek" aria-hidden="true">
                <span className="kalib-isaret kalib-isaret--ss" style={{ left: yuzde(olcum.sirtsirta) }}>sırt sırta</span>
                <span className="kalib-isaret kalib-isaret--yy" style={{ left: yuzde(olcum.yuzyuze) }}>yüz yüze</span>
                {oneri.deger != null && <span className="kalib-isaret kalib-isaret--oneri" style={{ left: yuzde(oneri.deger) }}>öneri</span>}
                <span className="kalib-isaret kalib-isaret--simdi" style={{ left: yuzde(esik) }}>şu an</span>
              </div>
              {oneri.uyari === 'ters' ? (
                <p className="kartsec-uyari" role="alert">⚠ Sırt sırta ölçüm yüz yüzeden güçlü çıktı — ölçümler karışmış olabilir. İki adımı tekrarlayın.</p>
              ) : (
                <>
                  <p>Fark <strong className="sayi">{oneri.fark} dB</strong> · önerilen eşik <strong className="sayi" data-test="kalib-onerilen">{oneri.deger} dBm</strong> (şu an {esik}).</p>
                  {oneri.uyari === 'kucuk' && (
                    <p className="kartsec-uyari" role="alert">⚠ İki ölçüm birbirine çok yakın: eşik yüz yüze ile sırt sırtayı güvenilir ayıramaz. Kartları kontrol edip tekrarlayın.</p>
                  )}
                  <button type="button" className="kisisec-ekle" onClick={esigiUygula}
                    disabled={uygula === 'gonderiliyor' || oneri.deger === esik} data-test="kalib-uygula">
                    {oneri.deger === esik ? 'Eşik zaten bu değerde' : `Eşiği ${oneri.deger} dBm yap`}
                  </button>
                  {uygula === 'tamam' && <p className="esik-kayit" role="status">✓ Eşik {oneri.deger} dBm olarak kaydedildi.</p>}
                  {uygula === 'hata' && <p className="esik-kayit esik-kayit--hata" role="alert">⚠ Kaydedilemedi, eşik değişmedi. Tekrar deneyin.</p>}
                </>
              )}
              <button type="button" className="kartver-geri kalib-kucuk" onClick={() => cifteGec(cift)}>Baştan başla</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
