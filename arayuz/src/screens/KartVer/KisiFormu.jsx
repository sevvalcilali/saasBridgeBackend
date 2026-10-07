// Kişi bilgisi formu — yeni kişi (2.5) ve düzenleme (2.11) aynı alanları kullanır:
// Ad, Rol (büyük düğmeler), Kurum, yatırımcıysa Yıldız, Not. Renk burada
// değiştirilemez (brief §6); düzenlemede yalnız gösterilir.
// Rapor bilgileri (isteğe bağlı; kişiye özel rapor 2. adım): girişimcide sektör, aşama, tanıtım, web; yatırımcıda
// ilgi alanları; herkes için e-posta ve paylaşım izni (izin yoksa iletişim kimsenin raporunda görünmez).
import { useState } from 'react'
import { formGecerli, kisiGonderimi } from '../../api/masaYardim.js'

const ASAMALAR = [
  { deger: 'fikir', etiket: 'Fikir' },
  { deger: 'mvp', etiket: 'MVP' },
  { deger: 'gelir', etiket: 'Gelir' },
  { deger: 'buyume', etiket: 'Büyüme' },
]

const ROLLER = [
  { deger: 'investor', etiket: 'Yatırımcı' },
  { deger: 'founder', etiket: 'Girişimci' },
  { deger: 'guest', etiket: 'Misafir' },
]

export default function KisiFormu({ baslangic, renk, kaydetEtiket, gonderiliyor, hata, onKaydet, onIptal }) {
  const [form, setForm] = useState(baslangic)
  const yaz = (alan, deger) => setForm((f) => ({ ...f, [alan]: deger }))

  return (
    <div className="kisisec-form" data-test="kisisec-form">
      {renk && (
        <p className="kisiform-renk">
          <span className="kisisec-renk" style={{ background: renk }} aria-hidden="true" />
          Kişinin rengi değişmez.
        </p>
      )}

      <label className="kisisec-etiket">Ad
        <input className="kisisec-girdi" value={form.ad} autoFocus
          onChange={(e) => yaz('ad', e.target.value)} data-test="form-ad" />
      </label>

      <span className="kisisec-etiket">Rol</span>
      <div className="kisisec-rol">
        {ROLLER.map((r) => (
          <button key={r.deger} type="button"
            className={`kisisec-rol-dugme ${form.rol === r.deger ? 'kisisec-rol-dugme--secili' : ''}`}
            aria-pressed={form.rol === r.deger}
            onClick={() => yaz('rol', r.deger)} data-test={`form-rol-${r.deger}`}>
            {r.etiket}
          </button>
        ))}
      </div>

      <label className="kisisec-etiket">Kurum
        <input className="kisisec-girdi" value={form.kurum} onChange={(e) => yaz('kurum', e.target.value)} data-test="form-kurum" />
      </label>

      {form.rol === 'investor' && (
        <div className="kisisec-yildiz-blok">
          <span className="kisisec-etiket">Yıldız</span>
          <div className="kisisec-yildizlar" role="group" aria-label={`Yıldız: ${form.yildiz || 0} / 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button"
                className={`kisisec-yildiz ${form.yildiz >= n ? 'kisisec-yildiz--dolu' : ''}`}
                aria-label={`${n} yıldız`} aria-pressed={form.yildiz === n}
                onClick={() => yaz('yildiz', form.yildiz === n ? 0 : n)}>★</button>
            ))}
          </div>
        </div>
      )}

      <fieldset className="kisiform-rapor">
        <legend className="kisisec-etiket">Rapor bilgileri (isteğe bağlı)</legend>
        {form.rol === 'founder' && (
          <>
            <label className="kisisec-etiket">Sektör
              <input className="kisisec-girdi" value={form.sektor ?? ''} placeholder="ör. Sağlık"
                onChange={(e) => yaz('sektor', e.target.value)} data-test="form-sektor" />
            </label>
            <span className="kisisec-etiket">Aşama</span>
            <div className="kisisec-rol" role="group" aria-label="Aşama">
              {ASAMALAR.map((a) => (
                <button key={a.deger} type="button"
                  className={`kisisec-rol-dugme ${form.asama === a.deger ? 'kisisec-rol-dugme--secili' : ''}`}
                  aria-pressed={form.asama === a.deger} data-test={`form-asama-${a.deger}`}
                  onClick={() => yaz('asama', form.asama === a.deger ? '' : a.deger)}>
                  {a.etiket}
                </button>
              ))}
            </div>
            <label className="kisisec-etiket">Tanıtım (tek cümle)
              <input className="kisisec-girdi" value={form.tanitim ?? ''} maxLength={200}
                onChange={(e) => yaz('tanitim', e.target.value)} data-test="form-tanitim" />
            </label>
            <label className="kisisec-etiket">Web sitesi
              <input className="kisisec-girdi" value={form.web ?? ''} placeholder="ornek.com"
                onChange={(e) => yaz('web', e.target.value)} data-test="form-web" />
            </label>
          </>
        )}
        {form.rol === 'investor' && (
          <label className="kisisec-etiket">İlgi alanları
            <input className="kisisec-girdi" value={form.sektor ?? ''} placeholder="virgülle: Sağlık, Enerji"
              onChange={(e) => yaz('sektor', e.target.value)} data-test="form-ilgi" />
          </label>
        )}
        <label className="kisisec-etiket">E-posta
          <input className="kisisec-girdi" type="email" value={form.eposta ?? ''}
            onChange={(e) => yaz('eposta', e.target.value)} data-test="form-eposta" />
        </label>
        <label className="kisiform-izin">
          <input type="checkbox" checked={Boolean(form.paylasim)} onChange={(e) => yaz('paylasim', e.target.checked)}
            data-test="form-paylasim" />
          İletişim bilgisi diğer katılımcıların raporunda görünebilir (kişinin izni alındı)
        </label>
      </fieldset>

      <label className="kisisec-etiket">Not (isteğe bağlı)
        <input className="kisisec-girdi" value={form.not} onChange={(e) => yaz('not', e.target.value)} />
      </label>

      {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}

      <div className="kisisec-form-dugmeler">
        <button type="button" className="kartver-geri" onClick={onIptal}>İptal</button>
        <button type="button" className="kisisec-ekle" data-test="form-ekle"
          disabled={!formGecerli(form) || gonderiliyor}
          onClick={() => onKaydet(kisiGonderimi(form))}>
          {kaydetEtiket}
        </button>
      </div>
    </div>
  )
}
