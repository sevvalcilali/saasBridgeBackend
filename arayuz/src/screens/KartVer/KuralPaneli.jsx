// Uyarı kuralları (Kart Ver → "Uyarılar"; Şevval isteği 2026-10-06): organizatör her etkinlik için kural kurar —
// "[kim] ile [kiminle] [yan yana gelince | N dakikadan uzun birlikte kalınca]" → panoda açılır uyarı. Kurallar
// sunucuda saklanır (etkinliğe özel; "Sıfırla"da kalır). Silme onaylıdır (tarayıcı penceresi açılmaz, satırda sorulur).
import { useCallback, useEffect, useState } from 'react'
import { kuralCumlesi } from '../../api/kurallar.js'
import KuralFormu from './KuralFormu.jsx'

export default function KuralPaneli({ api, katilimcilar }) {
  const [kurallar, setKurallar] = useState(null)
  const [duzenlenen, setDuzenlenen] = useState(null) // null | 'yeni' | kural
  const [silinecek, setSilinecek] = useState(null)
  const [hata, setHata] = useState(null)

  const yukle = useCallback(async () => {
    try { setKurallar(await api.kurallariGetir()); setHata(null) } catch { setHata('Kurallar alınamadı — sunucuya ulaşılamıyor.') }
  }, [api])
  useEffect(() => { yukle() }, [yukle])

  async function kaydet(govde) {
    if (duzenlenen === 'yeni') await api.kuralEkle(govde)
    else await api.kuralGuncelle(duzenlenen.kuralId, govde)
    setDuzenlenen(null)
    await yukle()
  }
  async function acikDegistir(kural) {
    try { await api.kuralGuncelle(kural.kuralId, { acik: !kural.acik }); await yukle() } catch { setHata('Kural güncellenemedi.') }
  }
  async function sil(kural) {
    try { await api.kuralSil(kural.kuralId); setSilinecek(null); await yukle() } catch { setHata('Kural silinemedi.') }
  }

  if (duzenlenen) {
    return (
      <KuralFormu baslangic={duzenlenen === 'yeni' ? null : duzenlenen} katilimcilar={katilimcilar ?? []}
        onKaydet={kaydet} onIptal={() => setDuzenlenen(null)} />
    )
  }

  return (
    <div className="kurallar" data-test="kural-paneli">
      <div className="kurallar-bas">
        <p className="kontrol-not">
          Koşul sağlanınca <strong>Pano'da açılır uyarı</strong> çıkar ve bildirim akışına düşer. Bir çift için bir
          görüşmede bir kez uyarır. Kurallar bu etkinliğe özeldir; "Sıfırla"da kalır.
        </p>
        <button type="button" className="kisisec-ekle" onClick={() => setDuzenlenen('yeni')} data-test="kural-yeni">
          ＋ Yeni uyarı kuralı
        </button>
      </div>
      {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}
      {kurallar === null ? <p className="kartver-iskele">Kurallar yükleniyor…</p>
        : kurallar.length === 0 ? (
          <p className="kartver-iskele" data-test="kural-yok">
            Henüz kural yok. Örnek: <em>★4+ yatırımcılar ile girişimciler 5 dakikadan uzun birlikte kalınca</em>.
          </p>
        ) : (
          <ul className="kurallar-liste">
            {kurallar.map((k) => (
              <li key={k.kuralId} className={`kural ${k.acik ? '' : 'kural--kapali'}`} data-test="kural" data-id={k.kuralId}>
                <div className="kural-metin">
                  <strong className="kural-ad">{k.ad}</strong>
                  <span className="kural-cumle">{kuralCumlesi(k, katilimcilar ?? [])} → açılır uyarı</span>
                </div>
                {silinecek === k.kuralId ? (
                  <div className="kural-dugmeler" role="group" aria-label="Silmeyi onayla">
                    <span className="kural-soru">Silinsin mi?</span>
                    <button type="button" className="kural-sil-onay" onClick={() => sil(k)} data-test="kural-sil-onay">Sil</button>
                    <button type="button" className="kartver-geri" onClick={() => setSilinecek(null)}>Vazgeç</button>
                  </div>
                ) : (
                  <div className="kural-dugmeler">
                    <button type="button" className={`kural-acik ${k.acik ? 'kural-acik--acik' : ''}`} aria-pressed={k.acik}
                      onClick={() => acikDegistir(k)} data-test="kural-acik">{k.acik ? 'Açık' : 'Kapalı'}</button>
                    <button type="button" className="kartver-geri" onClick={() => setDuzenlenen(k)} data-test="kural-duzenle">Düzenle</button>
                    <button type="button" className="kartver-geri" onClick={() => setSilinecek(k.kuralId)} data-test="kural-sil">Sil</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}
