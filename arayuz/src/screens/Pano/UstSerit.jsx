// Üst şerit: etkinlik kimliği, saat, alıcı sağlık rozeti, eşik göstergesi,
// onaylı Sıfırla. Yalnız görüntüler; olayları üst bileşene iletir.
import { aliciBagli } from '../../api/durum.js'
import './UstSerit.css'

export default function UstSerit({ durum, onSifirla, onEsikTikla }) {
  const bagli = aliciBagli(durum)

  return (
    <header className="ust-serit" data-bolge="ust">
      <div className="us-kimlik">
        <h1 className="us-ad">{durum.event.name}</h1>
        <p className="us-alt">
          {durum.event.sub}
          {durum.event.date ? ` · ${durum.event.date}` : ''}
        </p>
      </div>

      <div className="us-sag">
        <time className="us-saat sayi">{durum.clock}</time>
        <div className="us-arac">
          <span
            className={`alici-rozet ${bagli ? 'alici-rozet--bagli' : 'alici-rozet--yok'}`}
            role="status"
            data-test="alici-rozet"
          >
            <span aria-hidden="true">{bagli ? '◉' : '⚠'}</span>
            {bagli ? 'ALICI BAĞLI' : 'ALICI BAĞLI DEĞİL'}
          </span>

          <button type="button" className="esik-chip" onClick={onEsikTikla} title="Eşik ayarı — Kurulum sayfasını aç">
            Eşik <strong className="sayi">{durum.threshold}</strong> dBm
          </button>

          <button type="button" className="sifirla-dugme" onClick={onSifirla}>
            Sıfırla
          </button>
        </div>
      </div>
    </header>
  )
}
