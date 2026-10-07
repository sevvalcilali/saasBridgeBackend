// Bildirim akışı süzme ve sayma (brief §7.4, §5.2). Ekran yalnız seçimi tutar; mantık burada.
// Önem (severity) sunucudan: deal (olumlu), warn (uyarı), serious (ciddi), kural (organizatörün uyarı kuralı).
export const ONEM_SUZGECLERI = [
  { deger: 'tumu', etiket: 'Tümü' },
  { deger: 'serious', etiket: 'Ciddi' },
  { deger: 'warn', etiket: 'Uyarı' },
  { deger: 'deal', etiket: 'Olumlu' },
  { deger: 'kural', etiket: 'Kural' },
]
// Varsayılan görünen sayı: akış sakin kalsın; "Tümünü göster" ile hepsi (PLAN 1.7 sözü).
export const GORUNEN_VARSAYILAN = 20

export const bildirimleriSuz = (alerts, onem = 'tumu') =>
  (onem === 'tumu' ? alerts : alerts.filter((b) => b.severity === onem))

export function onemSayilari(alerts) {
  const sayi = { tumu: alerts.length, serious: 0, warn: 0, deal: 0, kural: 0 }
  for (const b of alerts) if (b.severity in sayi) sayi[b.severity]++
  return sayi
}

/** Süzülmüş akış: hepsi istenmediyse en yeni GORUNEN_VARSAYILAN; kalan = gösterilmeyen sayısı. */
export function gorunenBildirimler(alerts, { onem = 'tumu', hepsi = false } = {}) {
  const suzulmus = bildirimleriSuz(alerts, onem)
  const liste = hepsi ? suzulmus : suzulmus.slice(0, GORUNEN_VARSAYILAN)
  return { liste, kalan: suzulmus.length - liste.length, toplam: suzulmus.length }
}
