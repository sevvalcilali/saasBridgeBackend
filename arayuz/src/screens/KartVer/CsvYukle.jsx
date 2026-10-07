// Toplu ön yükleme (brief §6.3): etkinlik öncesi CSV yüklenir, kişiler "kart
// bekliyor" olarak listeye düşer; kartlar kapıda atanır. Dosya seçilince gider;
// sonuç özeti (eklenen / atlanan satırlar) gösterilir.
import { useState } from 'react'
import { csvDosyasiOku } from '../../api/csvOku.js'

export default function CsvYukle({ api, onYuklendi, onKapat }) {
  const [durum, setDurum] = useState('bos') // bos | gonderiliyor | bitti
  const [sonuc, setSonuc] = useState(null)
  const [hata, setHata] = useState(null)

  async function dosyaSecildi(e) {
    const dosya = e.target.files?.[0]
    e.target.value = '' // aynı dosya yeniden seçilebilsin
    if (!dosya) return
    setDurum('gonderiliyor')
    setHata(null)
    try {
      const s = await api.iceAktar(await csvDosyasiOku(dosya))
      setSonuc(s)
      setDurum('bitti')
      onYuklendi(s)
    } catch {
      setHata('Yüklenemedi — dosya okunamadı ya da sunucuya ulaşılamıyor.')
      setDurum('bos')
    }
  }

  return (
    <div className="csv" data-test="csv-panel">
      <h2 className="kontrol-baslik">CSV ile toplu yükleme</h2>
      <p className="kontrol-not">
        Sütunlar: <strong>ad, soyad, rol, kurum, yıldız</strong>. Rol: Yatırımcı / Girişimci / Misafir.
        İlk satır başlık olabilir; ayraç <code>;</code> ya da <code>,</code>.
        Rapor için isteğe bağlı: <strong>sektör</strong> (yatırımcıda ilgi alanları), <strong>aşama</strong> (Fikir /
        MVP / Gelir / Büyüme), <strong>tanıtım, web, e-posta, izin</strong> (evet ise iletişim raporda paylaşılır).
      </p>
      <pre className="csv-ornek" aria-label="Örnek">{'ad;soyad;rol;kurum;yıldız;sektör;aşama;tanıtım;web;e-posta;izin\nAyşe;Demir;Yatırımcı;Atlas Ventures;4;Sağlık, Enerji;;;;ayse@atlas.vc;evet\nCem;Erdem;Girişimci;Nova Robotik;;Robotik;MVP;Depo robotları;nova.ai;cem@nova.ai;evet'}</pre>

      <label className={`kisisec-ekle csv-sec ${durum === 'gonderiliyor' ? 'csv-sec--mesgul' : ''}`}>
        {durum === 'gonderiliyor' ? 'Yükleniyor…' : '⇪ CSV dosyası seç'}
        <input type="file" accept=".csv,text/csv,text/plain" className="csv-girdi" data-test="csv-dosya"
          disabled={durum === 'gonderiliyor'} onChange={dosyaSecildi} />
      </label>

      {hata && <p className="kartsec-uyari" role="alert">{hata}</p>}

      {sonuc && (
        <div className="csv-sonuc" role="status" data-test="csv-sonuc">
          <p><strong>✓ {sonuc.eklenen} kişi eklendi</strong> — "kart bekliyor" listesinde.</p>
          {sonuc.atlanan.length > 0 && (
            <>
              <p>{sonuc.atlanan.length} satır atlandı:</p>
              <ul className="csv-atlanan">
                {sonuc.atlanan.map((a) => <li key={a.satir}>Satır {a.satir}: {a.sebep}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="kisisec-form-dugmeler">
        <button type="button" className="kartver-geri" onClick={onKapat} data-test="csv-kapat">
          {sonuc ? 'Listeye dön' : 'İptal'}
        </button>
      </div>
    </div>
  )
}
