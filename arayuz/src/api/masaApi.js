// Karşılama masası (§9) uçlarıyla konuşan TEK yer. Ekran bileşenleri doğrudan
// fetch yapmaz; buradan çağırır. Gerçek sunucu gelince yalnız `adres` değişir
// (varsayılan: aynı kaynak). client.js ile aynı felsefe.
import { katilimciRengiUyarla as renkUyarla } from './renkler.js'
import { jsonIstek, adresTemizle, demoVarMi } from './http.js'
import { kisiKartiMi } from './kartNo.js'

export class MasaApi {
  constructor({ adres } = {}) {
    this.adres = adresTemizle(adres)
  }

  #iste(yol, yontem, govde, tur) { return jsonIstek(this.adres, yol, yontem, govde, tur) }

  // --- kişi kayıt defteri ---
  async kisileriGetir() { return (await this.#iste('/api/people')).map(renkUyarla) }
  async kisiEkle(veri) { return renkUyarla(await this.#iste('/api/people', 'POST', veri)) }
  async kisiGuncelle(kisiId, veri) {
    return renkUyarla(await this.#iste(`/api/people/${encodeURIComponent(kisiId)}`, 'PATCH', veri))
  }
  kisiSil(kisiId) { return this.#iste(`/api/people/${encodeURIComponent(kisiId)}`, 'DELETE', {}) }
  // Toplu ön yükleme (§9-5): CSV metni → { eklenen, atlanan: [{ satir, sebep }] }
  iceAktar(csvMetni) { return this.#iste('/api/people/import', 'POST', csvMetni, 'text/csv; charset=utf-8') }

  // --- atama ---
  ata(kisiId, kart) { return this.#iste('/api/assign', 'POST', { kisiId, kart }) }
  // Kart iadesi kişiyi "ayrıldı" yapar; yanlış atamayı geri almak yapmaz (ayrildi: false).
  iade(kart, { ayrildi = true } = {}) { return this.#iste('/api/unassign', 'POST', { kart, ayrildi }) }

  // --- uyarı kuralları (etkinliğe özel; panoda açılır uyarı) ---
  kurallariGetir() { return this.#iste('/api/rules') }
  kuralEkle(kural) { return this.#iste('/api/rules', 'POST', kural) }
  kuralGuncelle(kuralId, alanlar) { return this.#iste(`/api/rules/${encodeURIComponent(kuralId)}`, 'PATCH', alanlar) }
  kuralSil(kuralId) { return this.#iste(`/api/rules/${encodeURIComponent(kuralId)}`, 'DELETE', {}) }

  // --- kartlar (kart numarayla verilir; "yaklaştır ve tanı" yok, 07.10.2026) ---
  // Dinleyici cihazlar (100+) kişi kartı değildir: boştaki/önerilen kartlarda görünmez.
  async kartlariGetir() { return (await this.#iste('/api/cards')).filter((k) => kisiKartiMi(k.kart)) }
  // Demo düğmeleri yalnız mock'ta (GET /api/demo var) gösterilir; gerçek sunucuda yok.
  demoVarMi() { return demoVarMi(this.adres) }
}
