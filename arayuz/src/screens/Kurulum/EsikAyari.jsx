// Eşik kaydırıcısı (brief §8): -95…-35 dBm, anlık değer büyük yazıyla. Sürüklerken
// gönderilmez; bırakınca ~250 ms sonra tek istek. Hata olursa sunucudaki değere döner.
import { useEffect, useRef, useState } from 'react'
import { ESIK_ALT, ESIK_UST, esikSinirla, gecikmeliGonderici, esikUstuCiftSayisi } from '../../api/esik.js'

// onTaslak: sürüklenen değer (ya da null) — grafik eşik çizgisini anında taşısın diye.
export default function EsikAyari({ esik, signals, onGonder, onTaslak }) {
  const [taslak, setTaslak] = useState(null) // sürüklenen / kaydedilmeyi bekleyen değer
  const [kayit, setKayit] = useState('bos')  // bos | kaydediliyor | kaydedildi | hata

  const gonderRef = useRef(onGonder)
  gonderRef.current = onGonder
  const gondericiRef = useRef(null)
  if (gondericiRef.current === null) {
    gondericiRef.current = gecikmeliGonderici(
      (v) => gonderRef.current(v),
      ({ hata }) => {
        if (hata) { setTaslak(null); setKayit('hata') } else setKayit('kaydedildi')
      },
    )
  }
  useEffect(() => () => gondericiRef.current.iptal(), [])
  useEffect(() => { onTaslak?.(taslak) }, [taslak, onTaslak])

  // Sunucu yeni değeri yayınlayınca taslak bırakılır: gösterilen değer artık sunucunun.
  useEffect(() => {
    if (kayit === 'kaydedildi' && taslak !== null && esik === taslak) setTaslak(null)
  }, [esik, taslak, kayit])

  useEffect(() => {
    if (kayit !== 'kaydedildi') return
    const z = setTimeout(() => setKayit('bos'), 2500)
    return () => clearTimeout(z)
  }, [kayit])

  const gosterilen = taslak ?? esik
  const ustte = esikUstuCiftSayisi(signals, gosterilen)

  function kaydir(v) {
    setTaslak(esikSinirla(v))
    setKayit('bos')
  }
  function birak(v) {
    const deger = esikSinirla(v)
    if (deger === esik && (taslak === null || kayit === 'kaydedildi')) return
    if (deger === taslak && kayit === 'kaydediliyor') return
    setTaslak(deger)
    setKayit('kaydediliyor')
    gondericiRef.current.planla(deger)
  }

  return (
    <div className="esik">
      <div className="esik-ust">
        <p className="esik-deger" aria-live="polite">
          <span className="sayi" data-test="esik-deger">{gosterilen}</span> <span className="esik-birim">dBm</span>
        </p>
        <p className="esik-baglam">
          Şu an <strong className="sayi" data-test="esik-ustu">{ustte}</strong> çift eşiğin üstünde.
        </p>
      </div>

      <div className="esik-kaydirici">
        <button type="button" className="kartver-geri esik-adim" aria-label="Eşiği 1 dBm düşür"
          disabled={gosterilen <= ESIK_ALT} onClick={() => birak(gosterilen - 1)} data-test="esik-eksi">−1</button>
        <input
          type="range" min={ESIK_ALT} max={ESIK_UST} step={1}
          value={gosterilen}
          aria-label="Eşik (dBm)" aria-valuetext={`${gosterilen} dBm`}
          onChange={(e) => kaydir(e.target.value)}
          onPointerUp={(e) => birak(e.currentTarget.value)}
          onKeyUp={(e) => birak(e.currentTarget.value)}
          onPointerCancel={(e) => birak(e.currentTarget.value)}
          onBlur={(e) => birak(e.currentTarget.value)}
          data-test="esik-kaydirici"
        />
        <button type="button" className="kartver-geri esik-adim" aria-label="Eşiği 1 dBm yükselt"
          disabled={gosterilen >= ESIK_UST} onClick={() => birak(gosterilen + 1)} data-test="esik-arti">+1</button>
      </div>
      <div className="esik-olcek" aria-hidden="true">
        <span>{ESIK_ALT} · gevşek: uzaktakiler de yakın sayılır</span>
        <span>sıkı: yalnız çok yakındakiler · {ESIK_UST}</span>
      </div>

      <p className={`esik-kayit esik-kayit--${kayit}`} role="status" data-test="esik-kayit">
        {kayit === 'kaydediliyor' && 'Kaydediliyor…'}
        {kayit === 'kaydedildi' && '✓ Kaydedildi — pano ve eşleşmeler yeni eşikle çalışıyor.'}
        {kayit === 'hata' && `⚠ Kaydedilemedi — eşik ${esik} dBm olarak kaldı. Tekrar deneyin.`}
      </p>
    </div>
  )
}
