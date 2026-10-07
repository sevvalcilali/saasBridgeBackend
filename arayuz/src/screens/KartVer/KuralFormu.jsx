// Uyarı kuralı formu: tek cümle gibi kurulur — [kim] ile [kiminle] [ne zaman]. Kim / kiminle: bir grup (yatırımcılar,
// ★4+ yatırımcılar, girişimciler …) ya da belirli kişiler (aramayla seçilir). Altta önizleme cümlesi.
// Sunucunun hata metni (ör. "kim: en az bir kişi seçin") formda gösterilir.
import { useState } from 'react'
import { GRUPLAR, grupDegeri, grupSecimi, kuralCumlesi } from '../../api/kurallar.js'
import { katilimciAra } from '../../api/masaYardim.js'
import { tamAd } from '../../api/ad.js'

const secimFormu = (secim) => (secim?.kisiler
  ? { tur: 'kisiler', kisiler: secim.kisiler, grup: 'investor' }
  : { tur: 'grup', kisiler: [], grup: secim ? grupDegeri(secim) : 'investor' })
const secimGovdesi = (f) => (f.tur === 'kisiler' ? { kisiler: f.kisiler } : grupSecimi(f.grup))

function SecimSecici({ baslik, deger, onDegis, katilimcilar, test }) {
  const [arama, setArama] = useState('')
  const secili = new Set(deger.kisiler)
  const sonuclar = arama.trim() ? katilimciAra(katilimcilar, arama).filter((k) => !secili.has(k.kisiId)).slice(0, 6) : []
  const ad = (id) => { const k = katilimcilar.find((x) => x.kisiId === id); return k ? tamAd(k) : id }
  return (
    <fieldset className="kuralform-taraf" data-test={test}>
      <legend className="kisisec-etiket">{baslik}</legend>
      <div className="tema-secici" role="group" aria-label={`${baslik}: seçim türü`}>
        {[['grup', 'Bir grup'], ['kisiler', 'Belirli kişiler']].map(([tur, etiket]) => (
          <button key={tur} type="button" className="tema-secici-dugme" aria-pressed={deger.tur === tur}
            onClick={() => onDegis({ ...deger, tur })} data-test={`${test}-tur-${tur}`}>{etiket}</button>
        ))}
      </div>
      {deger.tur === 'grup' ? (
        <select className="kisisec-girdi" value={deger.grup} onChange={(e) => onDegis({ ...deger, grup: e.target.value })}
          data-test={`${test}-grup`}>
          {GRUPLAR.map((g) => <option key={g.deger} value={g.deger}>{g.etiket}</option>)}
        </select>
      ) : (
        <div className="kuralform-kisiler">
          {deger.kisiler.length > 0 && (
            <ul className="kuralform-secilen">
              {deger.kisiler.map((id) => (
                <li key={id}>
                  {ad(id)}
                  <button type="button" aria-label={`${ad(id)} çıkar`}
                    onClick={() => onDegis({ ...deger, kisiler: deger.kisiler.filter((x) => x !== id) })}>×</button>
                </li>
              ))}
            </ul>
          )}
          <input className="kisisec-girdi" type="search" placeholder="Kişi ara: ad ya da kurum" value={arama}
            onChange={(e) => setArama(e.target.value)} data-test={`${test}-ara`} />
          {sonuclar.length > 0 && (
            <ul className="kuralform-sonuc">
              {sonuclar.map((k) => (
                <li key={k.kisiId}>
                  <button type="button" onClick={() => { onDegis({ ...deger, kisiler: [...deger.kisiler, k.kisiId] }); setArama('') }}
                    data-test={`${test}-ekle`}>＋ {tamAd(k)}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  )
}

export default function KuralFormu({ baslangic, katilimcilar, onKaydet, onIptal }) {
  const [ad, setAd] = useState(baslangic?.ad ?? '')
  const [kim, setKim] = useState(() => secimFormu(baslangic?.kim))
  const [kiminle, setKiminle] = useState(() => secimFormu(baslangic?.kiminle ?? { rol: 'founder', enAzYildiz: 0 }))
  const [zaman, setZaman] = useState(baslangic?.dakika ? 'dakika' : (baslangic ? 'yanyana' : 'dakika'))
  const [dakika, setDakika] = useState(baslangic?.dakika || 5)
  const [acik, setAcik] = useState(baslangic?.acik ?? true)
  const [hata, setHata] = useState(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const govde = {
    ad: ad.trim(), kim: secimGovdesi(kim), kiminle: secimGovdesi(kiminle),
    dakika: zaman === 'dakika' ? Math.max(1, Number(dakika) || 1) : 0, acik,
  }
  const eksik = (kim.tur === 'kisiler' && kim.kisiler.length === 0) || (kiminle.tur === 'kisiler' && kiminle.kisiler.length === 0)

  async function kaydet() {
    setGonderiliyor(true)
    setHata(null)
    try {
      await onKaydet(govde)
    } catch (e) {
      setHata(e?.hata ? `Kaydedilemedi: ${e.hata}` : 'Kaydedilemedi — sunucuya ulaşılamıyor.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="kisisec-form kuralform" data-test="kural-formu">
      <h2 className="kontrol-baslik">{baslangic ? 'Uyarı kuralını düzenle' : 'Yeni uyarı kuralı'}</h2>
      <label className="kisisec-etiket">Kuralın adı (isteğe bağlı; boşsa cümleden oluşur)
        <input className="kisisec-girdi" value={ad} maxLength={80} placeholder="ör. Önemli yatırımcı uzun görüşmede"
          onChange={(e) => setAd(e.target.value)} data-test="kural-ad" />
      </label>
      <SecimSecici baslik="Kim" deger={kim} onDegis={setKim} katilimcilar={katilimcilar} test="kural-kim" />
      <SecimSecici baslik="Kiminle" deger={kiminle} onDegis={setKiminle} katilimcilar={katilimcilar} test="kural-kiminle" />
      <fieldset className="kuralform-taraf">
        <legend className="kisisec-etiket">Ne zaman</legend>
        <label className="kuralform-secenek">
          <input type="radio" name="zaman" checked={zaman === 'yanyana'} onChange={() => setZaman('yanyana')} data-test="kural-yanyana" />
          Yan yana gelince <span className="kontrol-not">(1 dakika yakın durunca)</span>
        </label>
        <label className="kuralform-secenek">
          <input type="radio" name="zaman" checked={zaman === 'dakika'} onChange={() => setZaman('dakika')} data-test="kural-dakikali" />
          <input className="kisisec-girdi kuralform-dakika" type="number" min={1} max={600} value={dakika}
            onChange={(e) => { setDakika(e.target.value); setZaman('dakika') }} aria-label="Dakika" data-test="kural-dakika" />
          dakikadan uzun birlikte kalınca
        </label>
      </fieldset>
      <label className="kisiform-izin">
        <input type="checkbox" checked={acik} onChange={(e) => setAcik(e.target.checked)} data-test="kural-acik-kutu" />
        Kural açık (kapalıyken uyarmaz)
      </label>
      <p className="kuralform-onizleme" data-test="kural-onizleme">
        <span>Önizleme:</span> {kuralCumlesi(govde, katilimcilar)} → Pano'da açılır uyarı
      </p>
      {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}
      <div className="kisisec-form-dugmeler">
        <button type="button" className="kartver-geri" onClick={onIptal}>İptal</button>
        <button type="button" className="kisisec-ekle" disabled={eksik || gonderiliyor} onClick={kaydet} data-test="kural-kaydet">
          {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}
