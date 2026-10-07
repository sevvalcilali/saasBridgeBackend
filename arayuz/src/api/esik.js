// Eşik ayarı (brief §5, §8): kaydırıcı -95…-35 dBm. Kaydırırken her harekette
// değil, bıraktıktan ~250 ms sonra tek istek gider; arada yeni değer gelirse
// önceki bekleyen istek iptal edilir.

export const ESIK_ALT = -95
export const ESIK_UST = -35
export const ESIK_GECIKME_MS = 250

export const esikSinirla = (v) => Math.min(ESIK_UST, Math.max(ESIK_ALT, Math.round(Number(v))))

// gonder(deger) → Promise. planla(deger) bekleyen gönderimi yeniler; sonuç
// geriCagri({ deger, hata }) ile bildirilir (yalnız son planlanan için).
// Sunucu reddederse client `false` döndürür (istisna atmaz) — o da hatadır.
export function gecikmeliGonderici(gonder, geriCagri, ms = ESIK_GECIKME_MS) {
  let zaman = null
  let sira = 0
  return {
    planla(deger) {
      clearTimeout(zaman)
      const benim = ++sira
      zaman = setTimeout(() => {
        gonder(deger).then(
          (sonuc) => {
            if (benim !== sira) return
            geriCagri({ deger, hata: sonuc === false ? new Error('sunucu reddetti') : null })
          },
          (hata) => { if (benim === sira) geriCagri({ deger, hata }) },
        )
      }, ms)
    },
    iptal() { clearTimeout(zaman); sira++ },
  }
}

// Şu an eşiğin üstünde olan çift sayısı (kaydırırken bağlam: kaç çift "yakın").
export const esikUstuCiftSayisi = (signals, esik) =>
  signals.filter((s) => s.value != null && s.value >= esik).length
