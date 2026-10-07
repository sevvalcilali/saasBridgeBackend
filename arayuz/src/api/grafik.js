// Canlı sinyal grafiği geometrisi (brief §8). Saf fonksiyonlar; bileşen yalnız çizer.
// history: { "3-4": [[saniyeÖnce, dBm], ...] } — en eski başta (brief §5.1).
import { ESIK_ALT, ESIK_UST } from './esik.js'
import { kartKisisi } from './sinyal.js'
import { kisaAd } from './ad.js'

export const Y_ALT = ESIK_ALT // ölçek kaydırıcıyla aynı ve SABİT: veri gelince eksen oynamaz
export const Y_UST = ESIK_UST
export const VARSAYILAN_CIFT = 6

const parcala = (anahtar) => anahtar.split('-')

// Bir çiftin dBm'i her an zıplar; sistem "birlikte" kararını son 10 sn'nin ortancasıyla verir. Grafik de bunu
// çizer: her nokta, o ana kadarki son `pencereSn` saniyenin ortancası (history: 2 sn'lik kovalar, en eski başta).
export const YUMUSATMA_SN = 10
const ortanca = (d) => {
  const s = [...d].sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export function yumusat(noktalar, pencereSn = YUMUSATMA_SN) {
  return noktalar.map(([sn]) => [sn, ortanca(noktalar.filter(([t]) => t >= sn && t < sn + pencereSn).map(([, v]) => v))])
}

// signals[].together (sunucu: eşiğin üstünde 1 dk kalmış, "birlikte") → history anahtarları ("küçük-büyük").
export function birlikteAnahtarlari(signals = []) {
  return new Set(signals.filter((s) => s.together)
    .map((s) => (Number(s.a) < Number(s.b) ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)))
}

// Hangi çiftler çizilir: kişi seçiliyse (perspektif) yalnız onunkiler (hepsi). `birlikte` verilirse varsayılan
// yalnız 1 dk+ birlikte sayılanlar; kalabalıkta kart no sırasıyla ilk `enCok` — değer oynasa da liste değişmez
// (okunabilirlik: Şevval kararı 2026-10). `birlikte` yoksa en güçlü N. Çizim sırası kart no'ya göre sabit.
export function grafikSerileri(history, people, {
  hepsi = false, n = VARSAYILAN_CIFT, kisiId = null, birlikte = null, enCok = 12, yumusak = false,
} = {}) {
  const kisi = new Map(people.map((p) => [p.id, p]))
  let seriler = Object.entries(history)
    .filter(([, noktalar]) => noktalar.length > 0)
    .map(([anahtar, noktalar]) => {
      const [a, b] = parcala(anahtar)
      return {
        anahtar,
        a: kisi.get(a) ?? kartKisisi(a),
        b: kisi.get(b) ?? kartKisisi(b),
        noktalar: yumusak ? yumusat(noktalar) : noktalar,
      }
    })
    .map((s) => ({ ...s, son: s.noktalar[s.noktalar.length - 1][1] }))
  if (kisiId) seriler = seriler.filter((s) => s.a.id === kisiId || s.b.id === kisiId)
  const toplam = seriler.length
  const sira = (s) => parcala(s.anahtar).map(Number)
  const kartSirasi = (p, q) => sira(p)[0] - sira(q)[0] || sira(p)[1] - sira(q)[1]
  const birlikteSayisi = birlikte ? seriler.filter((s) => birlikte.has(s.anahtar)).length : null
  if (birlikte && !hepsi && !kisiId) {
    seriler = seriler.filter((s) => birlikte.has(s.anahtar)).sort(kartSirasi).slice(0, enCok)
  } else if (!birlikte && !hepsi && seriler.length > n) {
    seriler = [...seriler].sort((p, q) => q.son - p.son).slice(0, n)
  }
  seriler.sort(kartSirasi)
  return { seriler, toplam, birlikteSayisi }
}

const sinirla = (v, alt, ust) => Math.min(ust, Math.max(alt, v))

// dBm → piksel (üst = güçlü). Aralık dışı değerler kenara yapışır.
export const olcekY = (dbm, yukseklik) =>
  ((Y_UST - sinirla(dbm, Y_ALT, Y_UST)) / (Y_UST - Y_ALT)) * yukseklik

// saniyeÖnce → piksel (sağ kenar = şimdi).
export const olcekX = (sn, genislik, pencere) => genislik - (sinirla(sn, 0, pencere) / pencere) * genislik
export const xdenSaniye = (x, genislik, pencere) => sinirla(((genislik - x) / genislik) * pencere, 0, pencere)

// Çizgi sonu etiketleri çakışmasın: y'ler sıralanıp en az `aralik` açılır,
// [alt, ust] içinde tutulur. Dönüş giriş sırasıyla aynı.
export function etiketleriAyir(ys, aralik, ust, alt) {
  const sirali = ys.map((y, i) => ({ y, i })).sort((p, q) => p.y - q.y)
  for (let k = 0; k < sirali.length; k++) {
    const onceki = k === 0 ? ust - aralik : sirali[k - 1].y
    sirali[k].y = Math.max(sirali[k].y, onceki + aralik)
  }
  // alt sınırı aştıysa sondan yukarı it
  for (let k = sirali.length - 1; k >= 0; k--) {
    const sonraki = k === sirali.length - 1 ? alt + aralik : sirali[k + 1].y
    sirali[k].y = Math.min(sirali[k].y, sonraki - aralik)
  }
  const sonuc = new Array(ys.length)
  for (const { y, i } of sirali) sonuc[i] = y
  return sonuc
}

// Üzerine gelinen andaki değerler: her seride o ana en yakın nokta (±tolerans sn).
export function anlikDegerler(seriler, saniyeOnce, tolerans = 2.5) {
  return seriler
    .map((s) => {
      let en = null
      for (const [sn, v] of s.noktalar) if (en === null || Math.abs(sn - saniyeOnce) < Math.abs(en[0] - saniyeOnce)) en = [sn, v]
      return en && Math.abs(en[0] - saniyeOnce) <= tolerans ? { seri: s, deger: en[1] } : null
    })
    .filter(Boolean)
    .sort((p, q) => q.deger - p.deger)
}

// "3 · 4" — brief §8 doğrudan etiket biçimi.
export const ciftEtiketi = (s) => `${s.a.id} · ${s.b.id}`

// Çizgi sonu etiketi: kart no yerine kısa ad ("Ayşe Demir · Nova Robotik"); kim olduğu tabloya bakmadan okunur.
const kisalt = (ad) => (ad.length > 16 ? `${ad.slice(0, 12).trimEnd()}…` : ad)
export const ciftAdi = (s) => `${kisalt(kisaAd(s.a))} · ${kisalt(kisaAd(s.b))}`

// Grafik yüksekliği (px): dar ekranda kısa; genişte ekranın ~%45'i (340–520); tam ekranda ekranın tamamı
// (üstteki eşik satırı ve eksen yazıları için pay bırakılır).
export function grafikYuksekligi(genislik, ekranYuksekligi, tamEkran) {
  if (tamEkran) return Math.max(240, ekranYuksekligi - 260)
  if (genislik < 640) return 240
  return Math.min(520, Math.max(340, Math.round(ekranYuksekligi * 0.45)))
}
