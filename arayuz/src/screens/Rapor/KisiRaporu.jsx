// Kişiye özel rapor: yatırımcıya (ya da girişimciye) verilecek tek sayfa. Yalnız o kişinin kendi görüşmeleri;
// başka katılımcıların kiminle görüştüğü yer almaz. Yazdırılır / PDF alınır (her kişi ayrı sayfa).
// Dil dürüst: kartlar konuşmayı değil yakınlığı ölçer → "birlikte geçen süre".
import { raporAdi, kisaAd } from '../../api/rapor.js'
import { sureYazisi } from '../../api/format.js'

const dk = (sn) => sureYazisi(sn / 60).replace(/ \d+ sn$/, '')
// Ses uyumu ekleri kelimeye göre değişir (girişimlerle / yatırımcılarla): ifadeler tam yazılır.
const KARSI = {
  investor: { tekil: 'girişim', ile: 'girişimlerle', bas: 'Girişim', baslik: 'Girişimlerle birlikte geçen süre',
    kacir: 'Kaçırdığınız girişimler', hic: 'hiçbir girişimle' },
  founder: { tekil: 'yatırımcı', ile: 'yatırımcılarla', bas: 'Yatırımcı', baslik: 'Yatırımcılarla birlikte geçen süre',
    kacir: 'Kaçırdığınız yatırımcılar', hic: 'hiçbir yatırımcıyla' },
}
const ROL = { investor: 'Yatırımcı', founder: 'Girişimci', guest: 'Misafir' }
const ASAMA = { fikir: 'Fikir', mvp: 'MVP', gelir: 'Gelir', buyume: 'Büyüme' }

// Karşı tarafın profili: girişimde sektör · aşama · tanıtım; yatırımcıda ilgi alanları. İletişim (web, e-posta)
// yalnız o kişi paylaşım izni verdiyse (rapor 2. adım, KVKK).
function Profil({ kisi }) {
  const bilgi = kisi.rol === 'founder'
    ? [kisi.sektor, ASAMA[kisi.asama], kisi.tanitim].filter(Boolean).join(' · ')
    : kisi.sektor ? `İlgi alanı: ${kisi.sektor}` : ''
  const iletisim = kisi.paylasim ? [kisi.web, kisi.eposta].filter(Boolean).join(' · ') : ''
  if (!bilgi && !iletisim) return null
  return (
    <span className="kr-profil" data-test="kr-profil">
      {bilgi && <span>{bilgi}</span>}
      {iletisim && <span className="kr-iletisim" data-test="kr-iletisim">{iletisim}</span>}
    </span>
  )
}

function Ad({ kisi }) {
  return (
    <span className="rp-ad">
      <span className="rp-renk" style={kisi.renk ? { background: kisi.renk } : undefined} aria-hidden="true" />
      {raporAdi(kisi)}
    </span>
  )
}

export default function KisiRaporu({ r, etkinlik }) {
  const { kisi, karsi, diger, kacirilan, ilgiAlaninda = new Set(), ozet } = r
  const k = KARSI[kisi.rol]
  const enUzun = karsi[0]
  return (
    <article className="kr" data-test="kisi-raporu" data-kisi={kisi.kisiId}>
      <header className="kr-bas">
        <p className="rp-ust">{[etkinlik.name, etkinlik.date].filter(Boolean).join(' · ')}</p>
        <h1>{raporAdi(kisi)}</h1>
        <p className="rp-alt">{[ROL[kisi.rol], kisi.rol === 'investor' ? kisi.kurum : null, kisi.yildiz ? '★'.repeat(kisi.yildiz) : null].filter(Boolean).join(' · ')}</p>
        <p className="kr-giris">
          Bu sayfa yalnız size aittir. Etkinlik boyunca kartınızın {k ? `hangi ${k.ile}` : 'kimlerle'} ne kadar yan yana
          kaldığını gösterir; görüşmelerinizi hatırlamanız ve dönüş yapmanız için.
        </p>
      </header>

      {k && (
        <dl className="rp-ozet kr-ozet">
          <div><dt>Tanıştığınız {k.tekil}</dt><dd className="sayi">{ozet.karsiSayisi}</dd></div>
          <div><dt>Birlikte geçen süre</dt><dd className="sayi">{dk(ozet.karsiSn)}</dd></div>
          <div><dt>En uzun</dt><dd className="kr-en-uzun">{enUzun ? <>{kisaAd(enUzun.kisi)} <span className="sayi">· {dk(enUzun.toplamSn)}</span></> : '—'}</dd></div>
          {ozet.anlasma > 0 && <div><dt>Öne çıkan</dt><dd className="sayi">{ozet.anlasma}</dd><p className="rp-not">uzun ve verimli görüşme</p></div>}
        </dl>
      )}

      {k && (
        <section className="rp-bolum">
          <h2>{k.baslik}</h2>
          {karsi.length === 0
            ? <p className="rp-soluk">Etkinlikte {k.hic} 1 dakikadan uzun yan yana kalmadınız.</p>
            : (
              <table className="rp-tablo kr-tablo" data-test="kisi-raporu-karsi">
                <thead><tr><th>{k.bas}</th><th className="sag">Süre</th><th className="sag">Kaç kez</th><th className="sag">İlk</th><th className="kr-takip">Dönüş yapacağım</th></tr></thead>
                <tbody>
                  {karsi.map((x) => (
                    <tr key={x.kisi.kisiId} className={x.anlasma ? 'kr-one-cikan' : ''}>
                      <td>
                        <Ad kisi={x.kisi} />{x.anlasma && <span className="kr-yildiz" title="Uzun ve verimli görüşme"> ★ öne çıkan</span>}
                        <Profil kisi={x.kisi} />
                      </td>
                      <td className="sag sayi">{dk(x.toplamSn)}</td>
                      <td className="sag sayi">{x.adet}</td>
                      <td className="sag sayi">{x.ilkSaat ?? '—'}</td>
                      <td className="kr-takip"><span className="kr-kutu" aria-hidden="true" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      )}

      {diger.length > 0 && (
        <section className="rp-bolum">
          <h2>{k ? 'Diğer tanıştıklarınız' : 'Tanıştıklarınız'}</h2>
          <ul className="kr-liste">
            {diger.map((x) => <li key={x.kisi.kisiId}><Ad kisi={x.kisi} /> <span className="sayi">· {dk(x.toplamSn)}</span></li>)}
          </ul>
        </section>
      )}

      {k && kacirilan.length > 0 && (
        <section className="rp-bolum" data-test="kisi-raporu-kacirilan">
          <h2>{k.kacir} <span className="rp-sayi">{kacirilan.length}</span></h2>
          <p className="rp-aciklama">
            Etkinlikteydiler ama yan yana gelmediniz. Organizatör aracılığıyla ulaşabilirsiniz.
            {ilgiAlaninda.size > 0 && ' İlgi alanınızdakiler başta.'}
          </p>
          <ul className="kr-kacirilan">
            {kacirilan.map((x) => (
              <li key={x.kisiId} className={ilgiAlaninda.has(x.kisiId) ? 'kr-ilgili' : ''}>
                <Ad kisi={x} />{ilgiAlaninda.has(x.kisiId) && <span className="kr-ilgi-isaret"> · ilgi alanınızda</span>}
                <Profil kisi={x} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rp-bolum kr-notlar">
        <h2>Notlarım</h2>
        <div className="kr-not-alani" aria-hidden="true" />
      </section>

      <p className="rp-dipnot">
        Süreler kartların birbirini duymasına göre ölçülen yaklaşık yan yana kalma süresidir; konuşmalar kaydedilmez.
        Bir eşleşme ancak 1 dakika yakın kalınca sayılır. Bu sayfada başka katılımcıların görüşmeleri yer almaz.
      </p>
    </article>
  )
}
