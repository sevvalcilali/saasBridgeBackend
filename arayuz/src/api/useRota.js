// Hafif hash yönlendirme (bağımlılık yok). #/ = Pano, #/kart-ver = Karşılama masası,
// #/kurulum = Kurulum / eşik ekranı (teknik), #/rapor = Etkinlik raporu.
// Aynı anda birden çok ekran açık olabilir (masa tableti + organizatör laptopu).
// #/kart-ver?kart=14 → masa "Kart 14 için kişi seçin" ile açılır (panodaki "Kişi ata").
// #/kart-ver?degistir=14 → Kart 14'ün sahibiyle kart değişimi; ?iade=14 → Kart 14'ün iadesi
// (kişi ayrıntı panelindeki kısayollar, brief §7).
// ?clean=1 → sunum modu (salon ekranı, brief §4.5); &isimsiz=1 → adlar gizli.
import { useEffect, useState } from 'react'

const KART_VER = '#/kart-ver'
export const KURULUM_ADRESI = '#/kurulum'
export const RAPOR_ADRESI = '#/rapor'

export function useRota() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const dinle = () => setHash(window.location.hash)
    window.addEventListener('hashchange', dinle)
    return () => window.removeEventListener('hashchange', dinle)
  }, [])
  return rotaAdi(hash)
}

export function rotaAdi(hash) {
  if (hash === KART_VER || hash.startsWith(`${KART_VER}?`)) return 'kart-ver'
  if (hash === KURULUM_ADRESI) return 'kurulum'
  if (hash === RAPOR_ADRESI || hash.startsWith(`${RAPOR_ADRESI}?`)) return 'rapor'
  return 'pano'
}

// #/kart-ver?<ad>=N → "N" (yalnız sayısal; yoksa null)
export function rotaParametresi(hash, ad) {
  if (rotaAdi(hash) !== 'kart-ver') return null
  const v = new URLSearchParams(hash.split('?')[1] ?? '').get(ad)
  return v && /^\d+$/.test(v) ? v : null
}
export const rotaKart = (hash) => rotaParametresi(hash, 'kart')

export const kartVerAdresi = (kart) => (kart ? `${KART_VER}?kart=${encodeURIComponent(kart)}` : KART_VER)
export const kartDegistirAdresi = (kart) => `${KART_VER}?degistir=${encodeURIComponent(kart)}`
export const kartIadeAdresi = (kart) => `${KART_VER}?iade=${encodeURIComponent(kart)}`

// Sunum modu adresin sorgu kısmında (brief §4.5: "?clean=1"); hash'ten bağımsız.
export const sunumModuMu = (search) => new URLSearchParams(search).get('clean') === '1'
export const isimsizMi = (search) => new URLSearchParams(search).get('isimsiz') === '1'
export const sunumAdresi = (isimsiz = false) => `?clean=1${isimsiz ? '&isimsiz=1' : ''}#/`
export const SUNUMDAN_CIKIS = './#/'

// Kişiye özel rapor: #/rapor?kisi=k12 (tek kişi) ya da ?kisi=yatirimcilar (bütün yatırımcılar, art arda sayfalar).
export function raporKisisi(hash) {
  if (rotaAdi(hash) !== 'rapor') return null
  const v = new URLSearchParams(hash.split('?')[1] ?? '').get('kisi')
  return v && /^[a-z0-9:_-]+$/i.test(v) ? v : null
}
export const kisiRaporuAdresi = (kisiId) => `${RAPOR_ADRESI}?kisi=${encodeURIComponent(kisiId)}`
