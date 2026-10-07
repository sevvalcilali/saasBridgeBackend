// Çift tablosu (brief §8): iki kişi, iki yönün değeri ayrı, ortanca değer,
// "birlikte sayılır / sayılmaz" + ara durumlar, ölçüm sayısı. Sıra sabit (zıplamaz).
// Durum renk + ikon + yazı ile; yeşil yalnız "birlikte" / "bitiyor…" (hâlâ birlikte).
import { memo } from 'react'
import { ciftSatirlari, dbmYazisi, YON_FARK_DB, SEYREK_N } from '../../api/sinyal.js'
import KisiRozeti from '../../components/KisiRozeti.jsx'

// Kişi adına tıklamak o kişinin perspektifine geçirir (onKisiSec).
// memo: kalabalıkta üst bileşen aynı signals referansını verirse yeniden çizilmez (useSeyrek).
export default memo(function CiftTablosu({ signals, people, kisiId = null, onKisiSec }) {
  const satirlar = ciftSatirlari(signals, people, kisiId)
  if (satirlar.length === 0) {
    return <p className="kartver-iskele">{kisiId ? 'Bu kişinin şu an duyulan çifti yok.' : 'Şu an duyulan çift yok.'}</p>
  }
  const rozet = (k) => (
    <button type="button" className="kisi-dugme" onClick={() => onKisiSec?.(k.id)}
      aria-label={`${k.name}: yalnız bu kişinin çiftlerini göster`} aria-pressed={kisiId === k.id}>
      <KisiRozeti kisi={k} />
    </button>
  )

  return (
    <div className="cift-kaydir">
      <table className="cift-tablo" data-test="cift-tablo">
        <thead>
          <tr>
            <th scope="col">Çift</th>
            <th scope="col">Durum</th>
            <th scope="col" className="sag" title="Son 10 sn ortancası — eşikle karşılaştırılan değer">Değer</th>
            <th scope="col" className="sag" title="Soldakinin sağdakini duyduğu güç">A → B</th>
            <th scope="col" className="sag" title="Sağdakinin soldakini duyduğu güç">B → A</th>
            <th scope="col" className="sag" title="Son 10 sn'deki ölçüm sayısı">Ölçüm</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((r) => (
            <tr key={r.anahtar} data-test="cift-satir" data-cift={r.anahtar} data-durum={r.durum.tur}>
              <td className="cift-kisiler">
                {rozet(r.a)} <span className="cift-ayrac" aria-hidden="true">·</span> {rozet(r.b)}
              </td>
              <td><span className={`cift-durum cift-durum--${r.durum.tur}`}>{r.durum.ikon} {r.durum.etiket}</span></td>
              <td className="sag sayi cift-deger">{dbmYazisi(r.value)}</td>
              <td className="sag sayi">{dbmYazisi(r.ab)}</td>
              <td className="sag sayi">
                {dbmYazisi(r.ba)}
                {r.yonFarkli && (
                  <span className="cift-uyari" title={`İki yön arasında ${YON_FARK_DB} dB'den fazla fark: kartlardan biri zayıf duyuyor olabilir`}>
                    {' '}⇄ {r.yonFarki}
                  </span>
                )}
              </td>
              <td className="sag sayi">
                {r.n}
                {r.seyrek && <span className="cift-uyari" title={`Son 10 sn'de ${SEYREK_N}'ten az ölçüm: veri seyrek`}> ⚠ seyrek</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cift-aciklama">
        <strong>başlıyor…</strong> eşiği geçti, 1 dk dolmasını bekliyor · <strong>bitiyor…</strong> eşiğin
        altına düştü, 15 sn çıkış gecikmesi süresince hâlâ birlikte sayılıyor · ⇄ iki yön arasında büyük fark
      </p>
    </div>
  )
})
