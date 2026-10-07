// Yerel CSV dosyasını metne çevirir. Türkçe Excel "CSV" kaydını çoğu zaman
// Windows-1254 ile yazar; UTF-8 olarak okunursa ş/ğ/İ bozulur. Önce UTF-8
// (Excel "CSV UTF-8" dahil; BOM atılır) denenir, geçersizse 1254'e düşülür.
export async function csvDosyasiOku(dosya) {
  const bayt = new Uint8Array(await dosya.arrayBuffer())
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bayt)
  } catch {
    return new TextDecoder('windows-1254').decode(bayt)
  }
}
