// Bildirim tür ikonları — Lucide (better-icons ile alındı), projeye yerel
// gömülü (çevrimdışı kuralı, brief §11). currentColor ile severity rengini alır.
const S = {
  width: '1.15em',
  height: '1.15em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const Odul = () => (
  <svg {...S}><path d="m15.477 12.89l1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></svg>
)
const Yinele = () => (
  <svg {...S}><path d="m17 2l4 4l-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4l4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
)
const Saat = () => (
  <svg {...S}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
)
const SinyalKesik = () => (
  <svg {...S}><path d="M12 20h.01M8.5 16.429a5 5 0 0 1 7 0M5 12.859a10 10 0 0 1 5.17-2.69m8.83 2.69a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764M2 2l20 20" /></svg>
)
const Uyari = () => (
  <svg {...S}><path d="m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01" /></svg>
)
const Zil = () => (
  <svg {...S}><path d="M10.268 21a2 2 0 0 0 3.464 0m-10.47-5.674A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>
)

// Bildirim türü → ikon (brief §5.2)
const IKONLAR = {
  deal: Odul,
  repeat: Yinele,
  idle_investor: Saat,
  lost: SinyalKesik,
  no_investor: Uyari,
  kural: Zil, // organizatörün uyarı kuralı
}

export default function BildirimIkon({ kind }) {
  const Ikon = IKONLAR[kind] ?? Zil
  return <Ikon />
}
