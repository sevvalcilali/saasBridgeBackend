// Kalibrasyon adımlarının görsel anlatımı (brief §8): iki insan simgesi yüz yüze
// ya da sırt sırta, kartlar göğüs hizasında. Gömülü SVG; renkler token'dan.
// Mesafe ölçüsü YOK (metre/cm gösterilmez) — yalnız duruş anlatılır.

// yon: 1 → sağa bakar, -1 → sola bakar
function Insan({ x, yon }) {
  return (
    <g>
      <circle cx={x} cy={20} r={10} className="kc-bas" />
      <circle cx={x + 4 * yon} cy={18} r={1.6} className="kc-goz" />
      <rect x={x - 12} y={33} width={24} height={42} rx={9} className="kc-govde" />
      <rect x={x + 9 * yon - (yon > 0 ? 0 : 7)} y={44} width={7} height={11} rx={1.5} className="kc-kart" />
    </g>
  )
}

export default function KalibrasyonCizim({ tur }) {
  const yuzyuze = tur === 'yuzyuze'
  return (
    <svg viewBox="44 2 112 92" className="kc" role="img"
      aria-label={yuzyuze ? 'İki kişi yüz yüze, kartlar karşı karşıya' : 'İki kişi sırt sırta, vücutlar kartların arasında'}>
      {yuzyuze ? (
        <>
          <Insan x={68} yon={1} />
          <Insan x={132} yon={-1} />
          <line x1={84} x2={116} y1={49} y2={49} className="kc-sinyal" />
        </>
      ) : (
        <>
          <Insan x={86} yon={-1} />
          <Insan x={114} yon={1} />
          <path d="M 72 49 C 72 86, 128 86, 128 49" className="kc-sinyal kc-sinyal--zayif" />
        </>
      )}
      <text x={100} y={90} textAnchor="middle" className="kc-yazi">{yuzyuze ? 'yüz yüze' : 'sırt sırta'}</text>
    </svg>
  )
}
