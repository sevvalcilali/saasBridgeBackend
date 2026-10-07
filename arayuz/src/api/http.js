// Sunucuya JSON istekleri için ortak alt katman (MasaApi, KurulumApi). Ekranlar
// bunu doğrudan kullanmaz; yalnız api/ içindeki sarmalayıcılar.
// Gövde varsayılan JSON; `tur` verilirse (ör. CSV) metin olduğu gibi gider.
// 2xx dışı yanıt → istisna (çağıran hatayı kullanıcıya anlatır).
import { SUNUCU_ADRESI } from './client.js'

export async function jsonIstek(adres, yol, yontem = 'GET', govde, tur) {
  const secenek = { method: yontem, headers: {} }
  if (govde !== undefined) {
    secenek.headers['Content-Type'] = tur ?? 'application/json'
    secenek.body = tur ? govde : JSON.stringify(govde)
  }
  const yanit = await fetch(adres + yol, secenek)
  if (!yanit.ok) {
    // Sunucunun açıklaması ({ok:false, hata}) varsa hataya eklenir: form kullanıcıya gösterebilir.
    const hata = new Error(`${yontem} ${yol} → ${yanit.status}`)
    hata.durum = yanit.status
    try { hata.hata = (await yanit.json())?.hata } catch { /* gövde JSON değil */ }
    throw hata
  }
  // Gövdesiz başarı (204 ya da boş 200) da başarıdır — ör. atama yapıldı, sunucu ayrıca bir şey dönmedi.
  // Hata sayılırsa masa "atama yapılamadı" der, görevli olmuş işi tekrar dener.
  const metin = await yanit.text()
  return metin.trim() ? JSON.parse(metin) : null
}

// Sunucu yalnız-mock demo ucunu (GET /api/demo) sağlıyor mu? Adres başına bir kez sorulur.
// Gerçek sunucuda 404 → demo düğmeleri gizli kalır. Ağ hatası "yok" sayılır, sonra yeniden sorulur.
const demoOnbellek = new Map()
export function demoVarMi(adres) {
  if (!demoOnbellek.has(adres)) {
    const soru = fetch(adres + '/api/demo').then((y) => y.ok, () => { demoOnbellek.delete(adres); return false })
    demoOnbellek.set(adres, soru)
  }
  return demoOnbellek.get(adres)
}

// Adres verilmezse client.js'teki tek sunucu adresi kullanılır.
export const adresTemizle = (adres = SUNUCU_ADRESI) => adres.replace(/\/$/, '')
