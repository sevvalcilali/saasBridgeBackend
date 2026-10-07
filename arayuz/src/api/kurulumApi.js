// Kurulum ekranının sunucu uçları (eşik /control üzerinden PanoBaglantisi'ndedir).
// Gerçek sunucu gelince yalnız `adres` değişir.
import { jsonIstek, adresTemizle, demoVarMi } from './http.js'
import { kisiKartiMi } from './kartNo.js'

export class KurulumApi {
  constructor({ adres } = {}) {
    this.adres = adresTemizle(adres)
  }

  // Kart sağlığı (3.7): alıcının duyduğu tüm kartlar — son duyulma, atanan.
  async kartlariGetir() { return (await jsonIstek(this.adres, '/api/cards')).filter((k) => kisiKartiMi(k.kart)) }
  demoVarMi() { return demoVarMi(this.adres) }

  // YALNIZ MOCK (donanım yok): iki kartı yüz yüze / sırt sırta tutmayı taklit eder.
  // mod: 'yuzyuze' | 'sirtsirta' | null (bırak). Gerçek sunucuda bu uç yoktur.
  demoTut(a, b, mod) { return jsonIstek(this.adres, '/api/demo/tut', 'POST', { a, b, mod }) }
}
