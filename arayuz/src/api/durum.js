// Durum nesnesinden türetilen küçük kararlar. Ekran bileşenleri bu
// yardımcıları çağırır, JSX içinde eşik/karşılaştırma/metin kurgusu yapmaz.
import { tamAd } from './ad.js'
import { sureYazisi, onceYazisi } from './format.js'

// brief §5.1: receiverAge alıcıdan son satırın kaç SANİYE önce geldiği;
// >5 ise sorun var, null ise hiç veri gelmemiş.
export function aliciBagli(durum) {
  const yas = durum?.receiverAge
  return yas != null && yas <= 5
}

// Ekrandaki veri "canlı" mı: sunucuya bağlıyız VE alıcı taze satır gönderiyor. Değilse içerik
// solar ama silinmez (brief §2 "eski veriyi canlıymış gibi gösterme", §11 "son veri soluk").
export const veriCanli = (durum, baglandi) => Boolean(baglandi) && aliciBagli(durum)

// Girişimcide kurum adı kişi adından önce gösterilir (brief §3). Kural tek yerde: api/ad.js.
export const gorunenAd = tamAd

// Satırdaki durum cümlesi (brief §7): "X ile · süre" / "boşta · 4 dk'dır" / "görünmüyor · …".
// Boşta süresi sunucunun idleSinceS'inden (§9), dakika dakika; 1 dk'dan kısa ya da alan yoksa yalnız "boşta".
export function durumCumlesi(kisi) {
  if (kisi.status === 'talking') return `${kisi.withName} ile · ${sureYazisi(kisi.live)}`
  if (kisi.status === 'away') return `görünmüyor · ${onceYazisi(kisi.seenAgo)}`
  const bostaDk = bostaDakika(kisi)
  return bostaDk ? `boşta · ${sureYazisi(bostaDk)}'dır` : 'boşta'
}

// Kesintisiz boşta tam dakika (satır yalnız dakika değişince yeniden çizilsin diye ayrı).
export const bostaDakika = (kisi) => Math.floor((kisi.idleSinceS ?? 0) / 60)

// Satırda "kaç karşı rol kişisiyle görüştüğü" (brief §7.2): yatırımcı için girişimci sayısı,
// girişimci için yatırımcı sayısı. Misafirin karşı rolü yok → null (gösterilmez).
const KARSI_ROL_ADI = { investor: 'girişimci', founder: 'yatırımcı' }
export function karsiRolYazisi(kisi) {
  const ad = KARSI_ROL_ADI[kisi.role]
  return ad ? `${kisi.invPeers ?? 0} ${ad}` : null
}

// Sunucu, listede olmayan bir kart duyulunca onu "Kart N", role:"guest"
// olarak kendiliğinden ekler (brief §5.1). Bu satır "atanmamış kart" olarak
// öne çıkarılır ve "Kişi ata" düğmesi gösterilir.
export function atanmamisKartMi(kisi) {
  return kisi.role === 'guest' && /^Kart \d+$/.test(kisi.name)
}

// Sıralama ölçütleri (brief §7: "sıralama (en uzun görüşen, en yalnız)"; §4.2 önemli yatırımcılar).
// Hepsi KARARLI: eşitlikte sunucu sırası korunur → liste tikten tike zıplamaz (brief §10).
// - durum: birlikte → boşta → görünmüyor (varsayılan; yalnız durum değişince yeniden dizilir)
// - sure:  bugünkü toplam süre azalan — satır ancak biri diğerini gerçekten geçince yer değiştirir
// - yalniz: bugünkü toplam süre artan (en az görüşen üstte), eşitlikte daha az karşı rol kişisi üstte
// - yildiz: yıldız azalan (önemli yatırımcı üstte); yıldızsızlar sunucu sırasında
export const SIRALAMALAR = [
  { deger: 'durum', etiket: 'Durum' },
  { deger: 'sure', etiket: 'En uzun görüşen' },
  { deger: 'yalniz', etiket: 'En yalnız' },
  { deger: 'yildiz', etiket: 'Yıldız' },
]
const DURUM_ONCELIK = { talking: 0, idle: 1, away: 2 }
const KARSILASTIR = {
  durum: (a, b) => DURUM_ONCELIK[a.status] - DURUM_ONCELIK[b.status],
  sure: (a, b) => (b.min ?? 0) - (a.min ?? 0),
  yalniz: (a, b) => (a.min ?? 0) - (b.min ?? 0) || (a.invPeers ?? 0) - (b.invPeers ?? 0),
  yildiz: (a, b) => (b.tier ?? 0) - (a.tier ?? 0),
}
export function siralaKisiler(people, olcut = 'durum') {
  const karsilastir = KARSILASTIR[olcut] ?? KARSILASTIR.durum
  return people
    .map((k, i) => ({ k, i }))
    .sort((a, b) => karsilastir(a.k, b.k) || (a.i - b.i))
    .map((x) => x.k)
}

// Alt şerit özet kutuları (brief §5.1 stats). Biçimleme burada, JSX'te değil.
export function ozetKutulari(durum) {
  const s = durum.stats
  return [
    { ad: 'şu an birlikte', deger: String(s.livePairs) },
    { ad: 'biten görüşme', deger: String(s.done) },
    { ad: 'karma görüşme', deger: sureYazisi(s.mixedMin) },
    { ad: 'potansiyel anlaşma', deger: String(s.deals) },
    { ad: 'yatırımcıya ulaşan girişimci', deger: `${s.reached}/${s.founders}` },
  ]
}

// Bir kişinin bugün kiminle ne kadar görüştüğü (edges'ten), süreye göre azalan.
export function kisiGorusmeleri(kisiId, edges, people) {
  const harita = new Map(people.map((k) => [k.id, k]))
  const sonuc = []
  for (const e of edges) {
    const digerId = e.a === kisiId ? e.b : e.b === kisiId ? e.a : null
    if (digerId === null) continue
    const diger = harita.get(digerId)
    if (!diger) continue
    sonuc.push({ kisi: diger, min: e.min })
  }
  return sonuc.sort((a, b) => b.min - a.min)
}

// Etkinlik ilerlemesi yüzde (0..100). Tanımsızsa null (çubuk gizlenir).
export function etkinlikYuzde(durum) {
  const p = durum.event?.progress
  if (p == null || !Number.isFinite(p)) return null
  return Math.round(Math.min(1, Math.max(0, p)) * 100)
}

const ROL_SIRA = [
  { rol: 'investor', baslik: 'Yatırımcılar' },
  { rol: 'founder', baslik: 'Girişimciler' },
  { rol: 'guest', baslik: 'Misafirler' },
]

// Kişileri rol gruplarına ayırır. Sıra sabittir (yatırımcı→girişimci→misafir),
// grup içi sıra sunucudan geldiği gibi korunur (sakin sıralama). Boş grup atlanır.
export function gruplaRol(people) {
  return ROL_SIRA
    .map(({ rol, baslik }) => ({ rol, baslik, kisiler: people.filter((k) => k.role === rol) }))
    .filter((g) => g.kisiler.length > 0)
}
