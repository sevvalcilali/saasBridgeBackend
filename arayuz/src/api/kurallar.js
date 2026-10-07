// Uyarı kuralları (Şevval isteği 2026-10-06): organizatör masada kurar ("[kim] ile [kiminle] [yan yana gelince |
// N dakikadan uzun birlikte kalınca]"), sunucu her tikte bakar, uyarınca panoda açılır pencere çıkar. Saf yardımcılar;
// kural biçimi sunucunun /api/rules sözleşmesi: { kuralId, ad, kim, kiminle, dakika, acik },
// kim / kiminle: { kisiler: [kisiId] } ya da { rol: investor|founder|guest|herkes, enAzYildiz: 0–5 }.
import { kisaAd } from './ad.js'

export const GRUPLAR = [
  { deger: 'investor', etiket: 'Yatırımcılar', secim: { rol: 'investor', enAzYildiz: 0 } },
  { deger: 'investor4', etiket: '★4+ yatırımcılar', secim: { rol: 'investor', enAzYildiz: 4 } },
  { deger: 'investor3', etiket: '★3+ yatırımcılar', secim: { rol: 'investor', enAzYildiz: 3 } },
  { deger: 'founder', etiket: 'Girişimciler', secim: { rol: 'founder', enAzYildiz: 0 } },
  { deger: 'guest', etiket: 'Misafirler', secim: { rol: 'guest', enAzYildiz: 0 } },
  { deger: 'herkes', etiket: 'Herkes', secim: { rol: 'herkes', enAzYildiz: 0 } },
]
export const grupSecimi = (deger) => ({ ...(GRUPLAR.find((g) => g.deger === deger) ?? GRUPLAR.at(-1)).secim })
/** Sunucudan gelen grup seçimi → seçici değeri ('investor4' …). */
export const grupDegeri = (secim) =>
  (GRUPLAR.find((g) => g.secim.rol === secim.rol && g.secim.enAzYildiz === (secim.enAzYildiz ?? 0)) ?? GRUPLAR.at(-1)).deger

const GRUP_ADI = { investor: 'yatırımcılar', founder: 'girişimciler', guest: 'misafirler', herkes: 'herkes' }

export function secimMetni(secim, kisiler) {
  if (secim?.kisiler) {
    const harita = new Map(kisiler.map((k) => [k.kisiId, k]))
    return secim.kisiler.map((id) => (harita.has(id) ? kisaAd(harita.get(id)) : id)).join(', ')
  }
  const yildiz = secim?.enAzYildiz ? `★${secim.enAzYildiz}+ ` : ''
  return yildiz + (GRUP_ADI[secim?.rol] ?? 'herkes')
}

export function kuralCumlesi(kural, kisiler) {
  const ne = kural.dakika ? `${kural.dakika} dakikadan uzun birlikte kalınca` : 'yan yana gelince'
  return `${secimMetni(kural.kim, kisiler)} ile ${secimMetni(kural.kiminle, kisiler)} ${ne}`
}

// Sayfa açıldığında eski uyarılar yığılmasın: ilk açılışta yalnız son 2 dakikadakiler açılır pencere olur.
export const ILK_ACILISTA_SN = 120

/** Açılır pencere olacak kural uyarıları: görülmemiş, eskiden yeniye (sırayla gösterilir). `simdi` epoch sn. */
export function acilacakUyarilar(alerts, gorulen, simdi, { ilk = false } = {}) {
  return alerts
    .filter((b) => b.kind === 'kural' && !gorulen.has(b.anahtar) && (!ilk || simdi - b.t <= ILK_ACILISTA_SN))
    .sort((p, q) => p.t - q.t)
}
