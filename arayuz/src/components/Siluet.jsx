// Karikatür insan figürü (Pano salon görünümü, Şevval 2026-10-06): büyük yuvarlak baş, iki göz ve gülümseme, dolgulu
// yuvarlak gövde, kısa bacaklar. Tek kalem çizgisi (eski karakalem çift çizgi + tarama kaldırıldı: kalabalık salonda
// üçte bir çizim). Renk `currentColor` (süre); gövde aynı rengin açık tonu. Üç duruş (api/gruplar.js siluetPozu):
// 0 kollar yanda, 1 el kalkık (konuşuyor), 2 elinde bardak. Varsayılan sağa bakar; `ayna` sola çevirir (grubun
// ortasına dönsün). Rol işareti göğüste: ○ yatırımcı, □ girişimci, ◇ misafir.
const GOVDE = 'M18 42 Q30 34 42 42 L45 70 Q30 75 15 70 Z'
const BACAKLAR = 'M23 72 L22 92 M37 72 L38 92 M22 92 L15.5 93.5 M38 92 L44.5 93.5'
// [sol kol, sağ kol]. Duruş 1'de sağ el kalkık (konuşuyor).
const KOLLAR = [
  ['M18 44 Q11 55 14 66', 'M42 44 Q49 55 46 66'],
  ['M18 44 Q11 55 14 66', 'M42 44 Q52 44 54 32'],
  ['M18 44 Q9 52 14 58', 'M42 44 Q49 55 46 66'],
]

function RolIsareti({ rol }) {
  const ortak = { fill: 'var(--yuzey)', stroke: 'currentColor', strokeWidth: 1.6 }
  if (rol === 'founder') return <rect x="26.5" y="52.5" width="7" height="7" rx="1" {...ortak} />
  if (rol === 'guest') return <rect x="27" y="53" width="6" height="6" transform="rotate(45 30 56)" {...ortak} />
  return <circle cx="30" cy="56" r="3.8" {...ortak} />
}

export default function Siluet({ renk, poz = 0, rol, ayna = false, gecikme = 0, className = '' }) {
  const [sol, sag] = KOLLAR[poz]
  return (
    <svg className={`siluet ${className}`} viewBox="0 0 60 100" style={{ color: renk, '--gecikme': `${gecikme}s` }}
      aria-hidden="true">
      <g transform={ayna ? 'translate(60 0) scale(-1 1)' : undefined}
        fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={GOVDE} fill="currentColor" fillOpacity="0.16" />
        <path d={sol} />
        <path d={sag} />
        <path d={BACAKLAR} />
        {poz === 2 && <path d="M9.5 53.5 L17 53.5 L16 61 L10.5 61 Z" fill="var(--yuzey)" />}
        <circle cx="30" cy="19" r="12.5" fill="var(--yuzey)" />
        <circle cx="25.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="34.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
        <path d="M26 24 Q30 27.5 34 24" strokeWidth="1.8" />
      </g>
      <RolIsareti rol={rol} />
    </svg>
  )
}
