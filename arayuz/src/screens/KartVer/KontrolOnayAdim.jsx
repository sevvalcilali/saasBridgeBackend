// Adım 3: kontrol + onay (brief §6.2 adım 3–4).
// Kontrol: kart açık mı, son duyulma, ZATEN BAŞKASINA atanmış mı (pil yüzdesi masada gösterilmez).
// Onay: kişinin rengiyle "Ad → Kart N" özeti; onaylanınca atanır ve ekran sıfırlanır.
import { useEffect, useState } from 'react'
import { onceYazisi, bulunmaEki } from '../../api/format.js'

export default function KontrolOnayAdim({ api, seciliKisi, seciliKart, katilimcilar, onTamam, onGeri }) {
  const [kart, setKart] = useState(undefined) // undefined = yükleniyor, null = duyulmuyor
  const [geriAlindi, setGeriAlindi] = useState(false)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState(null)

  useEffect(() => {
    let iptal = false
    api.kartlariGetir()
      .then((l) => { if (!iptal) setKart(l.find((k) => k.kart === seciliKart) ?? null) })
      .catch(() => { if (!iptal) setKart(null) })
    return () => { iptal = true }
  }, [api, seciliKart])

  const baskaSahip = kart?.atanan && kart.atanan !== seciliKisi.kisiId
    ? katilimcilar?.find((k) => k.kisiId === kart.atanan)
    : null
  const eskiKart = seciliKisi.atananKart && seciliKisi.atananKart !== seciliKart ? seciliKisi.atananKart : null
  const onaylanabilir = kart !== undefined && (!baskaSahip || geriAlindi) && !gonderiliyor

  async function onayla() {
    if (!onaylanabilir) return
    setGonderiliyor(true)
    setHata(null)
    try {
      await api.ata(seciliKisi.kisiId, seciliKart)
      onTamam({ ad: seciliKisi.ad, kart: seciliKart, eskiKart })
    } catch {
      setHata('Atama yapılamadı — sunucuya ulaşılamıyor. Tekrar deneyin.')
      setGonderiliyor(false)
    }
  }

  return (
    <div className="kontrol">
      <h2 className="kontrol-baslik">Kontrol</h2>

      {kart === undefined ? (
        <p className="kartver-iskele">Kart durumu okunuyor…</p>
      ) : (
        <dl className="kontrol-bilgi" data-test="kontrol-bilgi">
          <div><dt>Durum</dt><dd>{kart && kart.seenAgo <= 8 ? 'Açık' : 'Duyulmuyor'}</dd></div>
          <div><dt>Son duyulma</dt><dd>{kart ? onceYazisi(kart.seenAgo) : '—'}</dd></div>
        </dl>
      )}

      {kart === null && (
        <p className="kartsec-uyari" role="status">⚠ Kart {seciliKart} şu an duyulmuyor. Açık olduğundan emin olun.</p>
      )}

      {baskaSahip && (
        <div className="kontrol-uyari" role="alert" data-test="zaten-atanmis">
          <p>Bu kart şu an <strong>{baskaSahip.ad}</strong>{bulunmaEki(baskaSahip.ad)}. Geri alındı mı?</p>
          <label className="kontrol-onay-kutu">
            <input type="checkbox" checked={geriAlindi} onChange={(e) => setGeriAlindi(e.target.checked)}
              data-test="geri-alindi" />
            Evet, kart geri alındı (eski atama kapanacak)
          </label>
        </div>
      )}

      {eskiKart && (
        <p className="kontrol-not" data-test="kart-degisimi">
          <strong>Kart değişimi:</strong> Kart {eskiKart} bırakılır, Kart {seciliKart} verilir.
          Kişinin bugünkü süreleri yeni kartta birleşir.
        </p>
      )}

      <div className="onay-kart" style={{ '--kisi-renk': seciliKisi.renk }} data-test="onay-kart">
        <span className="onay-renk" aria-hidden="true" />
        <span className="onay-metin"><strong>{seciliKisi.ad}</strong> → <strong>Kart {seciliKart}</strong></span>
      </div>

      {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}

      <div className="kisisec-form-dugmeler">
        <button type="button" className="kartver-geri" onClick={onGeri}>← Kart</button>
        <button type="button" className="kisisec-ekle onay-dugme" data-test="onayla"
          disabled={!onaylanabilir} onClick={onayla}>
          {gonderiliyor ? 'Atanıyor…' : 'Onayla'}
        </button>
      </div>
    </div>
  )
}
