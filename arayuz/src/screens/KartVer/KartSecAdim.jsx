// Adım 2: kartı seç — kartın üstündeki numara yazılır (Şevval kararı 07.10.2026: "yaklaştır ve tanı" yok, yalnız
// numara). Yazarken şu an açık (duyulan) kartlar önerilir; duyulmayan numara da seçilebilir, uyarıyla.
import { useEffect, useState } from 'react'
import { acikKartlar, kartOner } from '../../api/masaYardim.js'
import { kartNoCoz, KART_EN_BUYUK } from '../../api/kartNo.js'

const YOKLAMA_MS = 1000

export default function KartSecAdim({ api, seciliKisi, onKartSec, onGeri }) {
  const [kartlar, setKartlar] = useState(null)
  const [girdi, setGirdi] = useState('')

  useEffect(() => {
    let iptal = false
    const getir = () => api.kartlariGetir().then((k) => { if (!iptal) setKartlar(k) }).catch(() => {})
    getir()
    const z = setInterval(getir, YOKLAMA_MS)
    return () => { iptal = true; clearInterval(z) }
  }, [api])

  const acik = kartlar ? acikKartlar(kartlar) : []
  const oneriler = kartOner(acik, girdi)
  const kartNo = kartNoCoz(girdi) // "007" → "7"; 0, 100+ (dinleyici) → null
  const girdiAcik = kartNo != null && acik.some((k) => k.kart === kartNo)

  return (
    <div className="kartsec">
      <p className="kartver-secili">Kişi: <strong>{seciliKisi?.ad}</strong></p>

      <label className="kisisec-etiket">Kart numarası (kartın üstündeki etiket)
        <input className="kartsec-numara" inputMode="numeric" value={girdi}
          onChange={(e) => setGirdi(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && kartNo) onKartSec(kartNo) }}
          placeholder="Örn. 14" data-test="kart-numara" autoFocus />
      </label>

      {girdi && !kartNo && (
        <p className="kartsec-uyari" role="status" data-test="kart-gecersiz">
          ⚠ Kart numarası 1–{KART_EN_BUYUK} arası olmalı (100 ve üstü dinleyici cihazdır).
        </p>
      )}
      {kartNo && !girdiAcik && (
        <p className="kartsec-uyari" role="status" data-test="kart-duyulmuyor">
          ⚠ Kart {kartNo} şu an duyulmuyor — kart açık mı kontrol edin.
        </p>
      )}

      <div className="kartsec-bas">
        <span>Şu an açık kartlar</span>
        <span className="kartsec-sayi sayi">{kartlar ? acik.length : '…'}</span>
      </div>
      <ul className="kartsec-oneriler" data-test="kart-oneriler">
        {oneriler.slice(0, 24).map((k) => (
          <li key={k.kart}>
            <button type="button" className="kartsec-oge" data-test="kart-oneri" onClick={() => onKartSec(k.kart)}>
              <span className="kartsec-acik" aria-hidden="true" />
              <span className="kartsec-no sayi">Kart {k.kart}</span>
              <span className="kartsec-etiket">{k.atanan ? 'atanmış' : 'boşta'}</span>
            </button>
          </li>
        ))}
        {kartlar && oneriler.length === 0 && <li className="kartver-iskele">Eşleşen açık kart yok.</li>}
      </ul>

      <div className="kisisec-form-dugmeler">
        <button type="button" className="kartver-geri" onClick={onGeri}>← Kişi</button>
        <button type="button" className="kisisec-ekle" data-test="kart-sec-dugme"
          disabled={!kartNo} onClick={() => onKartSec(kartNo)}>Bu kartı seç</button>
      </div>
    </div>
  )
}
