// Canlı gruplar ("adacıklar"): şu an yan yana olan kişiler tek bir dairede. Gruplar sunucunun `live`
// çiftlerinden çıkarılır: A–B ve B–C birlikteyse A, B, C aynı gruptadır (salonda tek küme gibi dururlar).
// Sözleşme değişmez; sunucu zaten bir çifti ancak 1 dk yan yana kalınca "birlikte" sayar, 15 sn ayrı
// kalınca bitirir — gruplar bu yüzden sakindir, arayüzde ayrıca bekletilmez.
// Dairelerin ekrandaki yeri salondaki yeri DEĞİLDİR; yerler yalnız ekranda sabit kalsın diye tutulur.

const ROL_SIRASI = { investor: 0, founder: 1, guest: 2 }
const sayiSirasi = (a, b) => Number(a) - Number(b)

// Sunucunun "önemli yatırımcı yalnız" kuralı (idle_investor): ★3+ yatırımcı 6 dk kimseyle görüşmedi.
const YALNIZ_SN = 360
const YALNIZ_EN_AZ_YILDIZ = 3
export const yalnizMi = (k) => k.role === 'investor' && (k.tier ?? 0) >= YALNIZ_EN_AZ_YILDIZ && (k.idleSinceS ?? 0) >= YALNIZ_SN

/** `live` çiftlerinden gruplar: [{ anahtar, uyeler, karma, dakika }], en küçük kart no sırasıyla. */
export function canliGruplar(people, live = []) {
  const kisi = new Map(people.map((k) => [k.id, k]))
  const ebeveyn = new Map()
  const kok = (x) => {
    while (ebeveyn.get(x) !== x) { ebeveyn.set(x, ebeveyn.get(ebeveyn.get(x))); x = ebeveyn.get(x) }
    return x
  }
  for (const { a, b } of live) {
    if (!kisi.has(a) || !kisi.has(b)) continue // kişisi olmayan kart (100+ dinleyici)
    for (const x of [a, b]) if (!ebeveyn.has(x)) ebeveyn.set(x, x)
    ebeveyn.set(kok(a), kok(b))
  }
  const kumeler = new Map()
  for (const id of ebeveyn.keys()) {
    const r = kok(id)
    if (!kumeler.has(r)) kumeler.set(r, [])
    kumeler.get(r).push(id)
  }
  return [...kumeler.values()]
    .map((idler) => {
      idler.sort(sayiSirasi)
      const uyeler = idler.map((id) => kisi.get(id))
        .sort((x, y) => ROL_SIRASI[x.role] - ROL_SIRASI[y.role] || sayiSirasi(x.id, y.id))
      const roller = new Set(uyeler.map((u) => u.role))
      return {
        anahtar: idler.join('-'),
        uyeler,
        karma: roller.has('investor') && roller.has('founder'), // etkinliğin amacı: yatırımcı ↔ girişimci
        dakika: Math.max(...uyeler.map((u) => u.live ?? 0)),
      }
    })
    .sort((x, y) => sayiSirasi(x.anahtar.split('-')[0], y.anahtar.split('-')[0]))
}

/** Grupta olmayanlar: boşta (önce yalnız kalan önemli yatırımcı, sonra en uzun boşta) ve görünmeyenler. */
export function bostakiler(people, gruplar) {
  const grupta = new Set(gruplar.flatMap((g) => g.uyeler.map((u) => u.id)))
  const disarida = people.filter((k) => !grupta.has(k.id))
  const bosta = disarida
    .filter((k) => k.status !== 'away')
    .map((k, i) => ({ k, i }))
    .sort((x, y) => Number(yalnizMi(y.k)) - Number(yalnizMi(x.k))
      || (y.k.idleSinceS ?? 0) - (x.k.idleSinceS ?? 0) || x.i - y.i)
    .map((x) => x.k)
  return { bosta, gorunmeyen: disarida.filter((k) => k.status === 'away') }
}

/**
 * Daireleri ekranda sabit yerlere koyar. `yerler`: önceki çizimde her yerdeki grubun üyeleri (Set ya da boş).
 * Bir grup, üyelerinin çoğunun önceden durduğu yere oturur (büyüse de küçülse de kaymaz); yeni grup ilk boş
 * yere; biten grubun yeri boş kalır (sağdakiler kaymasın), sonraki yeni gruba verilir. Sondaki boşluklar atılır.
 */
export function yerlestir(yerler, gruplar) {
  const adaylar = []
  gruplar.forEach((g, gi) => {
    const ids = g.uyeler.map((u) => u.id)
    yerler.forEach((onceki, yi) => {
      const ortak = onceki ? ids.filter((id) => onceki.has(id)).length : 0
      if (ortak > 0) adaylar.push({ gi, yi, ortak })
    })
  })
  adaylar.sort((x, y) => y.ortak - x.ortak || x.yi - y.yi)
  const grubunYeri = new Map()
  const dolu = new Set()
  for (const { gi, yi } of adaylar) {
    if (grubunYeri.has(gi) || dolu.has(yi)) continue
    grubunYeri.set(gi, yi); dolu.add(yi)
  }
  let bos = 0
  gruplar.forEach((_, gi) => {
    if (grubunYeri.has(gi)) return
    while (dolu.has(bos)) bos++
    grubunYeri.set(gi, bos); dolu.add(bos)
  })
  const uzunluk = dolu.size ? Math.max(...dolu) + 1 : 0
  const yeni = Array.from({ length: uzunluk }, () => null)
  const atama = new Map()
  gruplar.forEach((g, gi) => {
    const yi = grubunYeri.get(gi)
    yeni[yi] = new Set(g.uyeler.map((u) => u.id))
    atama.set(g.anahtar, yi)
  })
  return { yerler: yeni, atama }
}

// Siluet rengi = o kişinin şu anki görüşmesinin süresi (people[].live, dakika). Renk yalnız sınır geçilince
// değişir (sakin); her zaman yazılı süre ve açıklamayla birlikte kullanılır (renk tek başına bilgi değildir).
// Ölçek gri → mavi → turuncu → kırmızı (Şevval kararı 2026-10-06). Açılır uyarılar bu renklerle
// karışmasın diye kendi çerçevesi ve simgesiyle gelir.
export const SURE_RENKLERI = [
  { ad: 'gri', enAz: 0, etiket: '1–5 dk', degisken: 'var(--sure-1)' },
  { ad: 'mavi', enAz: 5, etiket: '5–10 dk', degisken: 'var(--sure-5)' },
  { ad: 'turuncu', enAz: 10, etiket: '10–20 dk', degisken: 'var(--sure-10)' },
  { ad: 'kirmizi', enAz: 20, etiket: '20 dk+', degisken: 'var(--sure-20)' },
]
export const sureRengi = (dakika) => SURE_RENKLERI.findLast((r) => (dakika ?? 0) >= r.enAz)

// Salon görünümü (Şevval 2026-10-06): grup yan yana sıra değil küme. Arka sıra + ön sıra: 2 kişi yan yana, 3 üçgen,
// 5'te arkada 2 önde 3 (ön sıra geniş: kucaklaşan küme). Üyeler verilirse [arka, ön] dizileri; verilmezse sayılar.
export function grupSiralari(n, uyeler) {
  const arka = n <= 2 ? 0 : Math.floor(n / 2)
  if (!uyeler) return [arka, n - arka]
  return [uyeler.slice(0, arka), uyeler.slice(arka)]
}

// Siluetin duruşu kişiye göre sabit: her tikte aynı figür (zıplamasın), kalabalıkta tekdüze durmasın.
const ozet = (id) => [...String(id)].reduce((t, c) => t * 31 + c.charCodeAt(0), 7) >>> 0
export const siluetPozu = (id) => ozet(id) % 3
// Hafif sallanma (CSS) her figürde farklı anda başlasın: figürler hep birlikte salınmasın (sakin, doğal).
export const siluetGecikmesi = (id) => -((ozet(id) % 12) / 2)
