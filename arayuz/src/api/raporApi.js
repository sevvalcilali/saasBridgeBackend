// Rapor ve kişi zaman çizelgesi için sunucu uçları (§9-6). Gerçek sunucu gelince
// yalnız `adres` değişir.
import { jsonIstek, adresTemizle } from './http.js'
import { katilimciRengiUyarla } from './renkler.js'

export class RaporApi {
  constructor({ adres } = {}) {
    this.adres = adresTemizle(adres)
  }

  // Kayıt defteri — ayrılanlar dahil (rapor herkesi kapsar).
  async kisileriGetir() { return (await jsonIstek(this.adres, '/api/people')).map(katilimciRengiUyarla) }

  // Görüşme kayıtları: [{ a, b, start, end }] — a/b kişi kimliği, etkinlik saniyesi.
  oturumlariGetir() { return jsonIstek(this.adres, '/api/sessions') }
  // Anlık görüntü için tek seferlik durum (başlık, saat, geçen süre, anlaşma sayısı); canlı akış dinlenmez.
  durumGetir() { return jsonIstek(this.adres, '/state?grafik=0') } // grafik verisi raporda gerekmez

}
