// Sayfa üstü hata bantları (brief §11): sunucuya bağlanılamıyor ve/veya
// alıcı bağlı değil. İkisi birden görünebilir. Son veri silinmez, yalnız solar
// (ekranın --soluk sınıfı; iki durumda da — api/durum.veriCanli). Bağlantı/alıcı gelince bant kalkar.
import { aliciBagli } from '../api/durum.js'
import './HataBantlari.css'

export default function HataBantlari({ durum, baglandi }) {
  const aliciYok = !aliciBagli(durum)
  if (baglandi && !aliciYok) return null

  return (
    <div className="hata-bantlari">
      {!baglandi && (
        <p className="hata-bant" role="status" data-test="bant-baglanti">
          <span aria-hidden="true">⚠</span>
          Sunucuya bağlanılamıyor, yeniden deneniyor… <span className="hata-bant-not">son veri gösteriliyor</span>
        </p>
      )}
      {aliciYok && (
        <p className="hata-bant" role="status" data-test="bant-alici">
          <span aria-hidden="true">⚠</span>
          ALICI BAĞLI DEĞİL <span className="hata-bant-not">veri güncellenmiyor</span>
        </p>
      )}
    </div>
  )
}
