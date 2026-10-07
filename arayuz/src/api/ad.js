// Kişinin görünen adı TEK yerde (brief §3: girişimcide kurum adı kişi adından önce).
// İki veri biçimini tanır: sunucu /state kişisi {name, org, role} ve kayıt defteri {ad, kurum, rol}.
// tamAd  → "Nova Robotik · Can Yılmaz" (liste, panel, rapor, masa)
// kisaAd → "Nova Robotik"              (dar yerler: ağ etiketi, rozet, zaman çizelgesi, seçiciler)
const alanlar = (k) => ({ ad: k.ad ?? k.name ?? '', kurum: k.kurum ?? k.org ?? '', rol: k.rol ?? k.role })

export function tamAd(k) {
  const { ad, kurum, rol } = alanlar(k)
  return rol === 'founder' && kurum ? `${kurum} · ${ad}` : ad
}

export function kisaAd(k) {
  const { ad, kurum, rol } = alanlar(k)
  return rol === 'founder' && kurum ? kurum : ad
}
