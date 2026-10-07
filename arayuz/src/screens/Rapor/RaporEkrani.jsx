// Etkinlik sonrası rapor (brief §4.4): kim kimle toplam kaç dakika, hangi girişimci
// kaç yatırımcıya ulaştı, en uzun görüşmeler. Yazdırılabilir / PDF'e uygun.
// Kaynak: kayıt defteri + görüşme kayıtları (ayrılanlar dahil) — /state yalnız etkinlik
// başlığı, saat ve "potansiyel anlaşma" sayısı için — görüntü alınırken TEK seferlik okunur;
// rapor sabit olduğu için canlı akış (2 Hz) dinlenmez, sayfa her tikte yeniden çizilmez.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RaporApi } from '../../api/raporApi.js'
import { raporHesapla, yatirimciMatrisi, kisiRaporu, raporAdi, etkinlikSaati, cizelgeAraligi,
  gunIciYogunluk, gucluEslesmeler, onerilenTanistirmalar, takipListesi } from '../../api/rapor.js'
import { raporKisisi, kisiRaporuAdresi, RAPOR_ADRESI } from '../../api/useRota.js'
import KisiRaporu from './KisiRaporu.jsx'
import { tarihSaatYazisi } from '../../api/format.js'
import { katilimcilarCsv, gorusmelerCsv, csvIndir, dosyaAdi } from '../../api/csvDisa.js'
import { Ozet, Icindekiler, Takip, GucluEslesmeler, Yogunluk, Girisimciler, Yatirimcilar, EnUzun, Kisiler, Ciftler, Matris } from './RaporBolumleri.jsx'
import './RaporEkrani.css'

export default function RaporEkrani() {
  const apiRef = useRef(null)
  if (apiRef.current === null) apiRef.current = new RaporApi()
  const [veri, setVeri] = useState(null) // anlık görüntü: kayıtlar + o anki saat/geçen süre/başlık
  const [hata, setHata] = useState(null)

  // Rapor bir anlık görüntüdür (yazdırırken değişmesin): açılışta ve "Yenile" ile alınır.
  // Kayıtlarla birlikte o anki etkinlik saniyesi, saat, başlık ve anlaşma sayısı da donar;
  // yoksa süren görüşmelerin süresi canlı saatle büyümeye devam ederdi.
  const yukle = useCallback(async () => {
    setHata(null)
    try {
      const api = apiRef.current
      const [kisiler, oturumlar, d] = await Promise.all([api.kisileriGetir(), api.oturumlariGetir(), api.durumGetir()])
      setVeri({
        kisiler, oturumlar, zaman: new Date(),
        simdi: d.elapsed, saat: d.clock, etkinlik: d.event ?? {}, anlasma: d.stats?.deals ?? 0, alerts: d.alerts ?? [],
      })
    } catch {
      setHata('Rapor verisi alınamadı — sunucuya ulaşılamıyor.')
    }
  }, [])
  useEffect(() => { yukle() }, [yukle])
  const r = useMemo(() => veri && raporHesapla(veri.kisiler, veri.oturumlar, veri.simdi), [veri])
  const matris = useMemo(() => r && yatirimciMatrisi(r, veri.kisiler), [r, veri])
  // Organizatör ekleri: gün içi yoğunluk, en güçlü eşleşmeler, takip listesi, önerilen tanıştırmalar.
  const ek = useMemo(() => r && {
    yogunluk: gunIciYogunluk(veri.oturumlar, veri.simdi, { saat: veri.saat, elapsed: veri.simdi }),
    eslesmeler: gucluEslesmeler(r, veri.alerts),
    takip: takipListesi(r),
    oneriler: onerilenTanistirmalar(veri.kisiler, veri.oturumlar),
    sektorVar: veri.kisiler.some((k) => k.rol === 'investor' && k.sektor?.trim())
      && veri.kisiler.some((k) => k.rol === 'founder' && k.sektor?.trim()),
  }, [r, veri])
  // #/rapor?kisi=k12 → kişiye özel sayfa; ?kisi=yatirimcilar → bütün yatırımcıların sayfaları art arda (yazdırmak için).
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const dinle = () => setHash(window.location.hash)
    window.addEventListener('hashchange', dinle)
    return () => window.removeEventListener('hashchange', dinle)
  }, [])
  const secili = raporKisisi(hash)
  const kisiSayfalari = useMemo(() => {
    if (!veri || !secili) return null
    const idler = secili === 'yatirimcilar'
      ? veri.kisiler.filter((k) => k.rol === 'investor').map((k) => k.kisiId)
      : [secili]
    return idler.map((id) => kisiRaporu(id, veri.kisiler, veri.oturumlar, veri.simdi, { saat: veri.saat, elapsed: veri.simdi, alerts: veri.alerts }))
  }, [veri, secili])

  if (!veri) {
    return <main className="rapor"><p className="rp-bos">{hata ?? 'Rapor hazırlanıyor…'}</p></main>
  }

  const { simdi, saat, etkinlik } = veri
  const kisiSec = (e) => { if (e.target.value) window.location.hash = kisiRaporuAdresi(e.target.value) }
  const secenekler = (rol) => veri.kisiler.filter((k) => k.rol === rol)
    .sort((p, q) => raporAdi(p).localeCompare(raporAdi(q), 'tr'))
    .map((k) => <option key={k.kisiId} value={k.kisiId}>{raporAdi(k)}</option>)
  const kisiSecici = (
    <label className="kr-secici">
      <span>Kişiye özel rapor</span>
      <select value={secili && secili !== 'yatirimcilar' ? secili : ''} onChange={kisiSec} data-test="kisi-raporu-sec">
        <option value="">— kişi seçin —</option>
        <optgroup label="Yatırımcılar">{secenekler('investor')}</optgroup>
        <optgroup label="Girişimciler">{secenekler('founder')}</optgroup>
      </select>
    </label>
  )

  if (kisiSayfalari) {
    return (
      <main className="rapor kr-sayfalar" data-test="kisi-raporlari">
        <div className="rp-araclar kr-araclar">
          <a className="kartver-geri" href={RAPOR_ADRESI}>← Genel rapor</a>
          {kisiSecici}
          <button type="button" className="kisisec-ekle" onClick={() => window.print()} data-test="kisi-raporu-yazdir">
            Yazdır / PDF{kisiSayfalari.length > 1 ? ` (${kisiSayfalari.length} sayfa)` : ''}
          </button>
        </div>
        {kisiSayfalari.map((kr) => <KisiRaporu key={kr.kisi.kisiId} r={kr} etkinlik={etkinlik} />)}
      </main>
    )
  }

  const saatYaz = (sn) => etkinlikSaati(sn, saat, simdi)
  const aralik = veri.oturumlar.length ? cizelgeAraligi(veri.oturumlar, simdi) : null
  const bolumler = [['bolum-ozet', 'Özet'], ['bolum-takip', 'Yapılacaklar'], ['bolum-eslesme', 'Eşleşmeler'], ['bolum-akis', 'Gün içi akış'],
    ['bolum-girisimci', 'Girişimciler'], ['bolum-yatirimci', 'Yatırımcılar'], ['bolum-matris', 'Matris'], ['bolum-ayrinti', 'Ayrıntılar']]
  return (
    <main className="rapor" data-test="rapor">
      <header className="rp-bas">
        <div>
          <p className="rp-ust">Etkinlik raporu</p>
          <h1>{etkinlik.name ?? 'Etkinlik'}</h1>
          <p className="rp-alt">{[etkinlik.date, aralik && `${saatYaz(aralik.bas)}–${saatYaz(simdi)}`,
            `Hazırlanma: ${tarihSaatYazisi(veri.zaman)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="rp-araclar" data-test="rapor-araclar">
          <button type="button" className="kisisec-ekle" onClick={() => window.print()} data-test="rapor-yazdir">Yazdır / PDF</button>
          <button type="button" className="kartver-geri" data-test="csv-katilimcilar"
            onClick={() => csvIndir(dosyaAdi('katilimcilar', veri.zaman), katilimcilarCsv(r))}>⇩ Katılımcılar (CSV)</button>
          <button type="button" className="kartver-geri" data-test="csv-gorusmeler"
            onClick={() => csvIndir(dosyaAdi('gorusmeler', veri.zaman), gorusmelerCsv(veri.oturumlar, veri.kisiler, simdi, saat))}>⇩ Görüşmeler (CSV)</button>
          <button type="button" className="kartver-geri" onClick={yukle} data-test="rapor-yenile">Yenile</button>
        </div>
      </header>
      {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}
      <Icindekiler bolumler={bolumler} />

      <section className="rp-bolum" id="bolum-ozet">
        <h2 className="rp-gizli-baslik">Özet</h2>
        <Ozet ozet={r.ozet} anlasma={veri.anlasma} yogunluk={ek.yogunluk} saatYaz={saatYaz} />
      </section>

      <section className="rp-bolum" id="bolum-takip">
        <h2>Etkinlik sonrası yapılacaklar</h2>
        <Takip takip={ek.takip} oneriler={ek.oneriler} sektorVar={ek.sektorVar} />
      </section>

      <section className="rp-bolum" id="bolum-eslesme">
        <h2>En güçlü yatırımcı–girişimci eşleşmeleri</h2>
        <p className="rp-aciklama">Gün boyu en uzun birlikte kalan çiftler: takip görüşmesi için ilk adaylar.</p>
        <GucluEslesmeler eslesmeler={ek.eslesmeler} />
      </section>

      <section className="rp-bolum" id="bolum-akis">
        <h2>Gün içinde görüşme yoğunluğu</h2>
        <Yogunluk yogunluk={ek.yogunluk} saatYaz={saatYaz} />
      </section>

      <section className="rp-bolum" id="bolum-girisimci">
        <h2>Girişimciler ve ulaştıkları yatırımcılar <span className="rp-sayi">{r.girisimciler.length}</span></h2>
        <Girisimciler girisimciler={r.girisimciler} />
      </section>
      <section className="rp-bolum" id="bolum-yatirimci">
        <h2>Yatırımcılar ve görüştükleri girişimciler <span className="rp-sayi">{r.yatirimcilar.length}</span></h2>
        <Yatirimcilar yatirimcilar={r.yatirimcilar} />
      </section>
      <section className="rp-bolum" id="bolum-matris">
        <h2>Yatırımcı × girişimci (dakika)</h2>
        <p className="rp-aciklama">Gün boyu kim kiminle ne kadar: koyu hücre = uzun görüşme. Boş satır, hiçbir girişimciyle görüşmemiş yatırımcı.</p>
        <Matris m={matris} />
      </section>

      <section className="rp-bolum kr-giris-bolum">
        <h2>Katılımcılara verilecek raporlar</h2>
        <p className="rp-aciklama">Her yatırımcı ve girişimci için yalnız kendi görüşmelerini gösteren tek sayfa (yazdırılır ya da PDF).</p>
        <div className="kr-giris-araclar">
          {kisiSecici}
          <a className="kartver-geri" href={kisiRaporuAdresi('yatirimcilar')} data-test="kisi-raporu-hepsi">Bütün yatırımcıların sayfaları</a>
        </div>
      </section>

      <div className="rp-ayrinti" id="bolum-ayrinti">
        <h2 className="rp-ayrinti-baslik">Ayrıntılı tablolar</h2>
        <section className="rp-bolum">
          <h3>En uzun görüşmeler</h3>
          <EnUzun enUzun={r.enUzun} saat={saat} simdi={simdi} />
        </section>
        <section className="rp-bolum">
          <h3>Katılımcılar <span className="rp-sayi">{r.kisiSatirlari.length}</span></h3>
          <p className="rp-aciklama">Kartını iade edip ayrılanlar da dahil; süreleri silinmez.</p>
          <Kisiler satirlar={r.kisiSatirlari} />
        </section>
        <section className="rp-bolum">
          <h3>Kim kimle ne kadar <span className="rp-sayi">{r.ciftler.length}</span></h3>
          <Ciftler ciftler={r.ciftler} />
        </section>
      </div>
      <p className="rp-dipnot">Süreler kartların birbirini duymasına göre ölçülür: iki kart 1 dakika yakın kalınca görüşme sayılır (o dakika da süreye eklenir), 15 sn uzak kalınca biter. Konum ve mesafe ölçülmez.</p>
    </main>
  )
}
