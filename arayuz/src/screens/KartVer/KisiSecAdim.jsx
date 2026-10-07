// Adım 1: kayıtlı kişilerde ara ve seç, ya da hızlı formla yeni kişi oluştur.
// Kayıtlı kişinin bilgisi (ad/rol/kurum/yıldız) buradan düzenlenir (2.11).
// Kartı olmayanlar "kart bekliyor", iade edilenler "ayrıldı" (2.12); CSV ile toplu yükleme.
// Dokunmatik-ayakta: büyük hedefler, az yazı, klavye en son çare.
import { tamAd } from '../../api/ad.js'
import { useState } from 'react'
import { katilimciAra, duzenlemeFarki, kisiDurumu, kartBekleyenler } from '../../api/masaYardim.js'
import KisiFormu from './KisiFormu.jsx'
import CsvYukle from './CsvYukle.jsx'

const BOS_FORM = { ad: '', rol: 'founder', kurum: '', yildiz: 0, not: '', sektor: '', asama: '', tanitim: '', web: '', eposta: '', paylasim: false }

export default function KisiSecAdim({ api, katilimcilar, kayipKisiIdler, onYenile, onKisiSec, onDuzenlendi }) {
  const [arama, setArama] = useState('')
  const [form, setForm] = useState(null) // null | { yeni: true } | { kisi } | { csv: true }
  // Kalıcı DEĞİL: CSV yükleyince kendiliğinden açılır; atamadan sonra "Tümü"ne dönmezse kartı olan
  // kişi (kart değişimi) aramada bulunamaz. (Tarama turunda denendi, Faz 2 gerileme testi yakaladı.)
  const [sadeceBekleyen, setSadeceBekleyen] = useState(false)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState(null)

  const bekleyenler = katilimcilar ? kartBekleyenler(katilimcilar) : []
  const liste = katilimcilar ? katilimciAra(sadeceBekleyen ? bekleyenler : katilimcilar, arama) : []

  function formAc(yeni) {
    setHata(null)
    setForm(yeni)
  }

  async function yeniKisiEkle(veri) {
    if (gonderiliyor) return
    setGonderiliyor(true)
    try {
      const kisi = await api.kisiEkle(veri)
      await onYenile()
      onKisiSec(kisi)
    } catch {
      setHata('Kişi eklenemedi — sunucuya ulaşılamıyor. Tekrar deneyin.')
    } finally {
      setGonderiliyor(false)
    }
  }

  async function kisiKaydet(veri) {
    if (gonderiliyor) return
    const fark = duzenlemeFarki(form.kisi, veri)
    if (Object.keys(fark).length === 0) { setForm(null); return }
    setGonderiliyor(true)
    try {
      const guncel = await api.kisiGuncelle(form.kisi.kisiId, fark)
      await onYenile()
      onDuzenlendi?.(guncel)
      setForm(null)
    } catch {
      setHata('Kaydedilemedi — sunucuya ulaşılamıyor. Tekrar deneyin.')
    } finally {
      setGonderiliyor(false)
    }
  }

  async function csvYuklendi(sonuc) {
    await onYenile()
    if (sonuc.eklenen > 0) setSadeceBekleyen(true)
  }

  if (katilimcilar === null) return <p className="kartver-iskele">Kişiler yükleniyor…</p>

  if (form?.csv) return <CsvYukle api={api} onYuklendi={csvYuklendi} onKapat={() => setForm(null)} />

  if (form?.yeni) {
    return (
      <KisiFormu baslangic={{ ...BOS_FORM }} kaydetEtiket="Ekle ve devam" gonderiliyor={gonderiliyor}
        hata={hata} onKaydet={yeniKisiEkle} onIptal={() => setForm(null)} />
    )
  }

  if (form?.kisi) {
    const k = form.kisi
    // Eski (sürüm 1) kayıtta profil alanı yoksa boş başlar.
    const baslangic = { ...BOS_FORM, ad: k.ad, rol: k.rol, kurum: k.kurum, yildiz: k.yildiz, not: k.not,
      sektor: k.sektor ?? '', asama: k.asama ?? '', tanitim: k.tanitim ?? '', web: k.web ?? '', eposta: k.eposta ?? '',
      paylasim: Boolean(k.paylasim) }
    return (
      <KisiFormu baslangic={baslangic} renk={form.kisi.renk} kaydetEtiket="Kaydet"
        gonderiliyor={gonderiliyor} hata={hata} onKaydet={kisiKaydet} onIptal={() => setForm(null)} />
    )
  }

  return (
    <div className="kisisec">
      <input
        type="search"
        className="kisisec-arama"
        placeholder="Kayıtlı kişilerde ara: ad veya kurum"
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        aria-label="Kişi ara"
      />

      <div className="kartsec-mod" role="group" aria-label="Liste">
        <button type="button" className={`kartsec-mod-dugme ${!sadeceBekleyen ? 'kartsec-mod-dugme--secili' : ''}`}
          aria-pressed={!sadeceBekleyen} onClick={() => setSadeceBekleyen(false)} data-test="filtre-tumu">
          Tümü <span className="kartsec-onerilen">({katilimcilar.length})</span>
        </button>
        <button type="button" className={`kartsec-mod-dugme ${sadeceBekleyen ? 'kartsec-mod-dugme--secili' : ''}`}
          aria-pressed={sadeceBekleyen} onClick={() => setSadeceBekleyen(true)} data-test="filtre-bekliyor">
          Kart bekliyor <span className="kartsec-onerilen">({bekleyenler.length})</span>
        </button>
      </div>

      <ul className="kisisec-liste" data-test="kisisec-liste">
        {liste.map((k) => {
          const durum = kisiDurumu(k, kayipKisiIdler?.has(k.kisiId))
          return (
            <li key={k.kisiId} className="kisisec-satir">
              <button type="button" className="kisisec-oge" data-test="kisisec-oge" onClick={() => onKisiSec(k)}>
                <span className="kisisec-renk" style={{ background: k.renk }} aria-hidden="true" />
                <span className="kisisec-ad">
                  <strong>{tamAd(k)}</strong>
                  <span className="kisisec-durum">
                    <span className={`kisisec-etiket-durum kisisec-etiket-durum--${durum.tur}`} data-test="kisi-durum">{durum.etiket}</span>
                    {k.yildiz ? ` · ${'★'.repeat(k.yildiz)}` : ''}
                  </span>
                </span>
              </button>
              <button type="button" className="kartver-geri kisisec-duzenle" data-test="kisi-duzenle"
                aria-label={`${k.ad} bilgilerini düzenle`} onClick={() => formAc({ kisi: k })}>
                Düzenle
              </button>
            </li>
          )
        })}
        {liste.length === 0 && <li className="kartver-iskele">Eşleşen kayıt yok.</li>}
      </ul>

      <div className="kisisec-alt">
        <button type="button" className="kisisec-yeni" data-test="yeni-kisi-ac" onClick={() => formAc({ yeni: true })}>
          + Yeni kişi
        </button>
        <button type="button" className="kisisec-yeni" data-test="csv-ac" onClick={() => formAc({ csv: true })}>
          ⇪ CSV ile toplu yükle
        </button>
      </div>
    </div>
  )
}
