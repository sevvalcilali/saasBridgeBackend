// Rapor sayfasının bölümleri (brief §4.4). Yalnız görüntüler; hesaplar api/rapor.js'te.
import { raporAdi, kisaAd, kisiDurumYazisi, etkinlikSaati } from '../../api/rapor.js'
import { sureYazisi } from '../../api/format.js'

const ROL = { investor: 'Yatırımcı', founder: 'Girişimci', guest: 'Misafir' }
const dk = (sn) => sureYazisi(sn / 60)
// Özet satırlarında saniye gürültüdür: dakikaya yuvarlanır ("24 dk", "1 sa 13 dk"); 1 dk'dan kısası "<1 dk".
const dkKisa = (sn) => (!sn ? '—' : sn < 60 ? '<1 dk' : sureYazisi(Math.round(sn / 60)))

function Ad({ kisi }) {
  return (
    <span className="rp-ad">
      <span className="rp-renk" style={kisi.renk ? { background: kisi.renk } : undefined} aria-hidden="true" />
      {raporAdi(kisi)}
    </span>
  )
}

// Üstteki özet kartları: tek bakışta etkinliğin sonucu. Oran kartında ilerleme çubuğu.
export function Ozet({ ozet, anlasma, yogunluk, saatYaz }) {
  const oran = ozet.girisimci ? Math.round((ozet.ulasan / ozet.girisimci) * 100) : 0
  const dagilim = [[ozet.yatirimci, 'yatırımcı'], [ozet.girisimci, 'girişimci'], [ozet.misafir, 'misafir']]
    .filter(([n]) => n).map(([n, ad]) => `${n} ${ad}`).join(' · ')
  const kutu = [
    { ad: 'Katılımcı', deger: `${ozet.kisi}`, not: [dagilim, ozet.ayrilan ? `${ozet.ayrilan} kişi ayrıldı` : null].filter(Boolean).join(' · ') },
    { ad: 'Görüşme', deger: `${ozet.gorusme}`,
      not: [ozet.gorusme ? `ortalama ${dkKisa(ozet.ortalamaSn)}` : null, ozet.suren ? `${ozet.suren} tanesi sürüyor` : null].filter(Boolean).join(' · ') },
    { ad: 'Yatırımcı–girişimci süresi', deger: dkKisa(ozet.karmaSn), not: 'iki tarafın birlikte geçirdiği toplam' },
    { ad: 'Yatırımcıya ulaşan girişimci', deger: `${ozet.ulasan}/${ozet.girisimci}`, oran, vurgu: true },
    { ad: 'Potansiyel anlaşma', deger: `${anlasma}`, not: anlasma ? 'uzun ve tekrarlı görüşmeler' : null, olumlu: anlasma > 0 },
    { ad: 'En yoğun zaman', deger: yogunluk.enYogun ? `${saatYaz(yogunluk.enYogun.bas)}` : '—',
      not: yogunluk.enYogun ? `${saatYaz(yogunluk.enYogun.bas)}–${saatYaz(yogunluk.enYogun.son)} · ${yogunluk.enYogun.adet} görüşme` : null },
  ]
  return (
    <dl className="rp-ozet" data-test="rapor-ozet">
      {kutu.map((k) => (
        <div key={k.ad} className={`rp-ozet-kart${k.vurgu ? ' rp-ozet-kart--vurgu' : ''}${k.olumlu ? ' rp-ozet-kart--olumlu' : ''}`}>
          <dt>{k.ad}</dt>
          <dd className="sayi">{k.deger}{k.oran != null && <span className="rp-oran"> %{k.oran}</span>}</dd>
          {k.oran != null && (
            <div className="rp-cubuk" role="img" aria-label={`Yüzde ${k.oran}`}><span style={{ width: `${k.oran}%` }} /></div>
          )}
          {k.not && <p className="rp-not">{k.not}</p>}
        </div>
      ))}
    </dl>
  )
}

// Sayfa içi gezinme: bölüme kaydırır (adres çubuğundaki #/rapor rotası bozulmasın diye bağlantı değil düğme).
export function Icindekiler({ bolumler }) {
  const git = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav className="rp-icindekiler" aria-label="Rapor bölümleri">
      {bolumler.map(([id, ad]) => <button key={id} type="button" onClick={() => git(id)}>{ad}</button>)}
    </nav>
  )
}

function KisiListesi({ kisiler, bos, test }) {
  if (!kisiler.length) return <p className="rp-tamam">✓ {bos}</p>
  return (
    <ul className="rp-liste" data-test={test}>
      {kisiler.map((k) => (
        <li key={k.kisiId}><Ad kisi={k} />{k.yildiz ? <span className="rp-yildiz"> {'★'.repeat(k.yildiz)}</span> : null}</li>
      ))}
    </ul>
  )
}

// Etkinlik sonrası yapılacaklar: tanıştırılması gerekenler ve ilgi alanı tutan ama karşılaşmamış çiftler.
export function Takip({ takip, oneriler, sektorVar }) {
  return (
    <div className="rp-takip">
      <article className="rp-panel rp-panel--uyari" data-test="takip-girisimci">
        <h3>Yatırımcıyla görüşmeyen girişimciler <span className="rp-sayi">{takip.girisimciler.length}</span></h3>
        <p className="rp-aciklama">Etkinliğe geldi ama hiçbir yatırımcıyla yan yana gelmedi. Etkinlik sonrası tanıştırın.</p>
        <KisiListesi kisiler={takip.girisimciler} bos="Her girişimci en az bir yatırımcıyla görüştü." test="takip-girisimci-liste" />
      </article>
      <article className="rp-panel rp-panel--uyari" data-test="takip-yatirimci">
        <h3>Girişimciyle görüşmeyen yatırımcılar <span className="rp-sayi">{takip.yatirimcilar.length}</span></h3>
        <p className="rp-aciklama">Geldi ama hiçbir girişimciyle görüşmedi. İlgi alanına uygun girişimleri gönderin.</p>
        <KisiListesi kisiler={takip.yatirimcilar} bos="Her yatırımcı en az bir girişimciyle görüştü." test="takip-yatirimci-liste" />
      </article>
      <article className="rp-panel rp-panel--kural" data-test="takip-oneri">
        <h3>Önerilen tanıştırmalar <span className="rp-sayi">{oneriler.length}</span></h3>
        <p className="rp-aciklama">Yatırımcının ilgi alanı girişimin sektörünü tutuyor ama gün boyu karşılaşmadılar.</p>
        {oneriler.length ? (
          <ul className="rp-liste rp-liste--cift">
            {oneriler.slice(0, 12).map((o) => (
              <li key={`${o.yatirimci.kisiId}|${o.girisimci.kisiId}`}>
                <Ad kisi={o.yatirimci} /> <span className="rp-ok" aria-hidden="true">→</span> <Ad kisi={o.girisimci} />
                <span className="rp-etiket">{o.sektor}</span>
              </li>
            ))}
            {oneriler.length > 12 && <li className="rp-soluk">ve {oneriler.length - 12} öneri daha</li>}
          </ul>
        ) : (
          <p className="rp-tamam rp-tamam--notr">{sektorVar
            ? 'Önerilecek yeni eşleşme yok.'
            : 'Kişilere sektör ve ilgi alanı girilince burada eşleşme önerileri çıkar.'}</p>
        )}
      </article>
    </div>
  )
}

// En güçlü yatırımcı–girişimci eşleşmeleri: sıralı liste, süre çubuğu, anlaşma işareti.
export function GucluEslesmeler({ eslesmeler }) {
  if (!eslesmeler.length) return <p className="rp-bos">Henüz yatırımcı–girişimci görüşmesi yok.</p>
  const enCok = Math.max(1, eslesmeler[0].toplamSn) // az önce başlamış tek görüşmede 0/0 olmasın
  return (
    <ol className="rp-eslesmeler" data-test="rapor-eslesmeler">
      {eslesmeler.map((e, i) => (
        <li key={`${e.yatirimci.kisiId}|${e.girisimci.kisiId}`}>
          <span className="rp-sira sayi">{i + 1}</span>
          <span className="rp-eslesme-adlar"><Ad kisi={e.yatirimci} /><span className="rp-ok" aria-hidden="true">×</span><Ad kisi={e.girisimci} /></span>
          <span className="rp-eslesme-cubuk" aria-hidden="true"><span style={{ width: `${Math.max(6, (e.toplamSn / enCok) * 100)}%` }} /></span>
          <span className="rp-eslesme-sure sayi">{dkKisa(e.toplamSn)}<span className="rp-soluk-kucuk"> · {e.adet} kez</span></span>
          <span>{e.anlasma && <span className="rp-rozet rp-rozet--olumlu">★ anlaşma</span>}</span>
        </li>
      ))}
    </ol>
  )
}

// Gün içi yoğunluk: her çubuk bir dilim, yüksekliği o arada süren görüşme sayısı; en yoğun dilim vurgulu.
export function Yogunluk({ yogunluk, saatYaz }) {
  const { dilimler, enYogun, dilimSn } = yogunluk
  if (!dilimler.length) return <p className="rp-bos">Henüz görüşme yok.</p>
  const tepe = Math.max(1, ...dilimler.map((d) => d.adet))
  const etiketAdim = Math.max(1, Math.ceil(dilimler.length / 8))
  return (
    <figure className="rp-yogunluk" data-test="rapor-yogunluk">
      <div className="rp-yogunluk-alan">
        {dilimler.map((d, i) => {
          const tepeMi = enYogun && d.bas === enYogun.bas
          return (
            <div key={d.bas} className="rp-yogunluk-sutun" title={`${saatYaz(d.bas)}–${saatYaz(d.son)}: ${d.adet} görüşme`}>
              <span className="rp-yogunluk-sayi sayi">{d.adet || ''}</span>
              <span className={`rp-yogunluk-cubuk${tepeMi ? ' rp-yogunluk-cubuk--tepe' : ''}`} style={{ height: `${(d.adet / tepe) * 100}%` }} />
              <span className="rp-yogunluk-saat sayi">{i % etiketAdim === 0 ? saatYaz(d.bas) : ''}</span>
            </div>
          )
        })}
      </div>
      <figcaption className="rp-aciklama">
        Her çubuk {Math.round(dilimSn / 60)} dakika: o arada süren görüşme sayısı.
        {enYogun && <> En yoğun: <strong>{saatYaz(enYogun.bas)}–{saatYaz(enYogun.son)}</strong> ({enYogun.adet} görüşme).</>}
      </figcaption>
    </figure>
  )
}

function Cipler({ satirlar, bos }) {
  if (!satirlar.length) return <strong className="rp-uyari">⚠ {bos}</strong>
  return (
    <span className="rp-cipler">
      {satirlar.map((x) => (
        <span key={x.kisi.kisiId} className="rp-cip"><Ad kisi={x.kisi} /><span className="sayi">{dkKisa(x.toplamSn)}</span></span>
      ))}
    </span>
  )
}

function Profil({ kisi }) {
  const parca = [kisi.rol === 'founder' ? null : kisi.kurum, kisi.sektor, kisi.asama].filter(Boolean)
  return parca.length ? <span className="rp-profil">{parca.join(' · ')}</span> : null
}

export function Girisimciler({ girisimciler }) {
  return (
    <div className="rp-kaydir">
    <table className="rp-tablo rp-tablo--kisi" data-test="rapor-girisimciler">
      <thead><tr><th>Girişimci</th><th className="sag">Yatırımcı</th><th>Görüştüğü yatırımcılar</th><th className="sag">Toplam</th></tr></thead>
      <tbody>
        {girisimciler.map((g) => (
          <tr key={g.kisi.kisiId} className={g.yatirimcilar.length ? '' : 'rp-uyari-satir'} data-test="rapor-girisimci">
            <td><Ad kisi={g.kisi} /><Profil kisi={g.kisi} /></td>
            <td className="sag sayi rp-buyuk-sayi" data-etiket="yatırımcı">{g.yatirimcilar.length}</td>
            <td className="rp-cip-hucre"><Cipler satirlar={g.yatirimcilar} bos="Hiç yatırımcıyla görüşmedi" /></td>
            <td className="sag sayi" data-etiket="toplam">{g.yatirimciSn ? dkKisa(g.yatirimciSn) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

export function Yatirimcilar({ yatirimcilar }) {
  return (
    <div className="rp-kaydir">
    <table className="rp-tablo rp-tablo--kisi" data-test="rapor-yatirimcilar">
      <thead><tr><th>Yatırımcı</th><th className="sag">Girişimci</th><th>Görüştüğü girişimciler</th><th className="sag">Toplam</th></tr></thead>
      <tbody>
        {yatirimcilar.map((y) => (
          <tr key={y.kisi.kisiId} className={y.girisimciler.length ? '' : 'rp-uyari-satir'} data-test="rapor-yatirimci">
            <td><Ad kisi={y.kisi} />{y.kisi.yildiz ? <span className="rp-yildiz"> {'★'.repeat(y.kisi.yildiz)}</span> : null}<Profil kisi={y.kisi} /></td>
            <td className="sag sayi rp-buyuk-sayi" data-etiket="girişimci">{y.girisimciler.length}</td>
            <td className="rp-cip-hucre"><Cipler satirlar={y.girisimciler} bos="Hiç girişimciyle görüşmedi" /></td>
            <td className="sag sayi" data-etiket="toplam">{y.girisimciSn ? dkKisa(y.girisimciSn) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

export function EnUzun({ enUzun, saat, simdi }) {
  if (!enUzun.length) return <p className="rp-bos">Henüz görüşme yok.</p>
  return (
    <div className="rp-kaydir">
    <table className="rp-tablo" data-test="rapor-en-uzun">
      <thead><tr><th className="sag">#</th><th>Kim</th><th>Kiminle</th><th className="sag">Başlangıç</th><th className="sag">Süre</th></tr></thead>
      <tbody>
        {enUzun.map((o, i) => (
          <tr key={i}>
            <td className="sag sayi">{i + 1}</td>
            <td><Ad kisi={o.a} /></td>
            <td><Ad kisi={o.b} /></td>
            <td className="sag sayi">{etkinlikSaati(o.start, saat, simdi)}</td>
            <td className="sag sayi">{dk(o.sureSn)}{o.suruyor ? ' · sürüyor' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

export function Kisiler({ satirlar }) {
  return (
    <div className="rp-kaydir">
    <table className="rp-tablo" data-test="rapor-kisiler">
      <thead>
        <tr><th>Kişi</th><th>Rol</th><th className="sag">Toplam</th><th className="sag">Görüşme</th>
          <th className="sag" title="Bugün görüştüğü farklı kişi sayısı">Kişi sayısı</th><th className="sag" title="Yatırımcı için girişimci, girişimci için yatırımcı">Karşı rol</th><th>Kart</th></tr>
      </thead>
      <tbody>
        {satirlar.map((r) => (
          <tr key={r.kisi.kisiId} data-test="rapor-kisi" data-kisi={r.kisi.kisiId}>
            <td><Ad kisi={r.kisi} /></td>
            <td>{ROL[r.kisi.rol] ?? '—'}{r.kisi.yildiz ? ` ${'★'.repeat(r.kisi.yildiz)}` : ''}</td>
            <td className="sag sayi">{r.toplamSn ? dk(r.toplamSn) : '—'}</td>
            <td className="sag sayi">{r.gorusmeSayisi}</td>
            <td className="sag sayi">{r.kisiSayisi}</td>
            <td className="sag sayi">{r.kisi.rol === 'investor' || r.kisi.rol === 'founder' ? r.karsiRolSayisi : '—'}</td>
            <td className={r.kisi.ayrildi && !r.kisi.atananKart ? 'rp-soluk' : ''}>{r.kisi.rol ? kisiDurumYazisi(r.kisi) : 'kayıtsız'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

export function Ciftler({ ciftler }) {
  if (!ciftler.length) return <p className="rp-bos">Henüz görüşme yok.</p>
  return (
    <div className="rp-kaydir">
    <table className="rp-tablo" data-test="rapor-ciftler">
      <thead><tr><th>Kişi</th><th>Kişi</th><th className="sag">Toplam</th><th className="sag">Görüşme</th></tr></thead>
      <tbody>
        {ciftler.map((c) => (
          <tr key={`${c.a.kisiId}|${c.b.kisiId}`}>
            <td><Ad kisi={c.a} /></td><td><Ad kisi={c.b} /></td>
            <td className="sag sayi">{dk(c.toplamSn)}</td><td className="sag sayi">{c.adet}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

// Gün boyu özeti (Şevval kararı 2026-10: Rapor'da): satır yatırımcı, sütun girişimci, hücre dakika; renk koyuluğu süre.
export function Matris({ m }) {
  if (m.satirlar.length === 0 || m.sutunlar.length === 0) return <p className="rp-soluk">Yatırımcı ya da girişimci yok.</p>
  return (
    <div className="rp-kaydir">
      <table className="rp-tablo rp-matris" data-test="rapor-matris">
        <thead>
          <tr>
            <th className="rp-matris-kose">Yatırımcı ↓ · Girişimci →</th>
            {m.sutunlar.map((g) => <th key={g.kisiId} className="rp-matris-sutun" title={raporAdi(g)}><span>{kisaAd(g)}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {m.satirlar.map((y) => (
            <tr key={y.kisiId}>
              <th scope="row"><Ad kisi={y} /></th>
              {m.sutunlar.map((g) => {
                const sn = m.hucre.get(`${y.kisiId}|${g.kisiId}`)
                if (!sn) return <td key={g.kisiId} className="rp-matris-hucre rp-matris-bos">·</td>
                const yuzde = Math.round(15 + 70 * (sn / m.enCok))
                return (
                  <td key={g.kisiId} className={`rp-matris-hucre sayi ${yuzde > 55 ? 'rp-matris-koyu' : ''}`}
                    style={{ background: `color-mix(in srgb, var(--birlikte) ${yuzde}%, transparent)` }}
                    title={`${raporAdi(y)} – ${raporAdi(g)}: ${dk(sn)}`}>
                    {sn < 60 ? '<1' : Math.round(sn / 60)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
