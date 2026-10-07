// Birim/metin çevirileri — sunucu birimlerinden (dakika/saniye) insan
// diline. Brief §5.1: live/min/invMin/edges.min DAKİKA; seenAgo/
// receiverAge/elapsed SANİYE. Ekran bileşenleri hesap yapmaz, buradan okur.

/** Dakika (float) → "3 dk 20 sn" / "25 sn" / "1 sa 16 dk". Veri yoksa "—". */
export function sureYazisi(dakika) {
  if (dakika == null || !Number.isFinite(dakika)) return '—'
  const toplamSn = Math.round(Math.max(0, dakika) * 60)
  if (toplamSn >= 3600) {
    let sa = Math.floor(toplamSn / 3600)
    let dk = Math.round((toplamSn % 3600) / 60)
    if (dk === 60) { sa += 1; dk = 0 }
    return dk ? `${sa} sa ${dk} dk` : `${sa} sa`
  }
  const dk = Math.floor(toplamSn / 60)
  const sn = toplamSn % 60
  if (dk === 0) return `${sn} sn`
  return sn ? `${dk} dk ${sn} sn` : `${dk} dk`
}

/** Saniye → "az önce" / "25 sn önce" / "2 dk önce". null = hiç duyulmadı. */
export function onceYazisi(saniye) {
  if (saniye == null || !Number.isFinite(saniye)) return 'hiç duyulmadı'
  const sn = Math.round(Math.max(0, saniye))
  if (sn < 10) return 'az önce'
  if (sn < 60) return `${sn} sn önce`
  if (sn < 3600) return `${Math.floor(sn / 60)} dk önce`
  return `${Math.floor(sn / 3600)} sa önce`
}

/** Date → "30.09.2026 14:05" (brief §10: tarih 28.09.2026, saat 14:05). */
export function tarihSaatYazisi(d) {
  const iki = (n) => String(n).padStart(2, '0')
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()} ${iki(d.getHours())}:${iki(d.getMinutes())}`
}

// Türkçe bulunma eki (özel ad için kesme işaretiyle): "Ayşe Demir" → "'de", "Ali" → "'de",
// "Kaya" → "'da", "Koç" → "'ta", "Kart 14" → "'te". Son sözcüğün son ünlüsüne (büyük ünlü
// uyumu) ve son sesine (sert ünsüz f s t k ç ş h p → t) bakılır; sayılar okunuşuna göre.
const BIRLER = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz']
const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan']
// Sayının son okunan sözcüğü: 14 → "dört", 20 → "yirmi", 0 → "sıfır".
function sonOkunus(rakamlar) {
  const n = Number(rakamlar.slice(-2))
  if (n % 10 !== 0 || n === 0) return BIRLER[n % 10]
  return ONLAR[n / 10]
}
export function bulunmaEki(ad) {
  let s = String(ad ?? '').trim().toLocaleLowerCase('tr')
  const sayi = s.match(/\d+$/)
  if (sayi) s = sonOkunus(sayi[0])
  const unluler = s.match(/[aıoueiöü]/g)
  if (!unluler) return "'de"
  const kalin = 'aıou'.includes(unluler.at(-1))
  const sert = 'fstkçşhp'.includes(s.at(-1))
  return `'${sert ? 't' : 'd'}${kalin ? 'a' : 'e'}`
}
