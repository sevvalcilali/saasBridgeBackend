// Kurulum ekranı sinyal yardımcıları (brief §5.1 signals, §8). Saf fonksiyonlar.
//
// Çift durumu mevcut alanlardan türetilir (§9-7'deki `pending` alanına gerek yok):
//   above ∧ together   → birlikte
//   above ∧ ¬together  → başlıyor… (1 dk giriş süresi bekleniyor; sunucu kuralı)
//   ¬above ∧ together  → bitiyor…  (15 sn çıkış gecikmesi; hâlâ birlikte sayılıyor)
//   ¬above ∧ ¬together → eşik altı

export const YON_FARK_DB = 8 // iki yön arasında bu kadar fark → donanım farkı işareti
export const SEYREK_N = 5    // son 10 sn'de bundan az ölçüm → veri seyrek

const DURUMLAR = {
  birlikte: { tur: 'birlikte', ikon: '●', etiket: 'birlikte' },
  basliyor: { tur: 'basliyor', ikon: '◔', etiket: 'başlıyor…' },
  bitiyor: { tur: 'bitiyor', ikon: '◑', etiket: 'bitiyor…' },
  alti: { tur: 'alti', ikon: '○', etiket: 'eşik altı' },
}

export function ciftDurumu(s) {
  if (s.above && s.together) return DURUMLAR.birlikte
  if (s.above) return DURUMLAR.basliyor
  if (s.together) return DURUMLAR.bitiyor
  return DURUMLAR.alti
}

export function yonFarki(s) {
  return s.ab == null || s.ba == null ? null : Math.round(Math.abs(s.ab - s.ba) * 10) / 10
}

// Listede olmayan kart (ör. 100+ dinleyici) için yer tutucu kişi.
export const kartKisisi = (id) => ({ id, name: `Kart ${id}`, org: '', role: null, color: null })

// signals + people → tablo satırları. Sıra kart numarasına göre SABİT: durum
// değişse de satır yer değiştirmez (brief: sakin, zıplamayan arayüz).
// kisiId verilirse (perspektif) yalnız o kişinin çiftleri.
const kisininMi = (kisiId) => (s) => !kisiId || s.a === kisiId || s.b === kisiId
export const ciftSayisi = (signals, kisiId = null) => signals.filter(kisininMi(kisiId)).length

export function ciftSatirlari(signals, people, kisiId = null) {
  const kisi = new Map(people.map((p) => [p.id, p]))
  return signals
    .filter(kisininMi(kisiId))
    .map((s) => {
      // Küçük kart no solda; kişiler yer değişirse yönler (ab/ba) de değişir:
      // ab her zaman "soldakinin sağdakini duyduğu güç".
      const ters = Number(s.a) > Number(s.b)
      const [x, y] = ters ? [s.b, s.a] : [s.a, s.b]
      const fark = yonFarki(s)
      return {
        anahtar: `${x}-${y}`,
        a: kisi.get(x) ?? kartKisisi(x),
        b: kisi.get(y) ?? kartKisisi(y),
        ab: ters ? s.ba : s.ab,
        ba: ters ? s.ab : s.ba,
        value: s.value, n: s.n,
        durum: ciftDurumu(s),
        yonFarki: fark,
        yonFarkli: fark != null && fark >= YON_FARK_DB,
        seyrek: s.n < SEYREK_N,
        sira: [Number(x), Number(y)],
      }
    })
    .sort((p, q) => p.sira[0] - q.sira[0] || p.sira[1] - q.sira[1])
}

// dBm yazısı: null → "—", aksi halde tek ondalık.
export const dbmYazisi = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1))

// Perspektif seçicisi: şu an en az bir çifti duyulan kişiler, kart no'ya göre.
// Seçili kişinin çifti o an yoksa da listede kalır (seçim kaybolmasın).
export function perspektifKisileri(signals, people, seciliId = null) {
  const idler = new Set(signals.flatMap((s) => [s.a, s.b]))
  if (seciliId) idler.add(seciliId)
  const kisi = new Map(people.map((p) => [p.id, p]))
  return [...idler].map((id) => kisi.get(id) ?? kartKisisi(id)).sort((a, b) => Number(a.id) - Number(b.id))
}
