// Tek komutla geliştirme: mock sunucu + Vite birlikte başlar (Faz 0 kabul
// ölçütü). Biri ölürse diğeri de kapanır; Ctrl+C ikisini birden bırakır.
import { spawn } from 'node:child_process'

const cocuklar = []

function baslat(ad, komut, argumanlar) {
  const cocuk = spawn(komut, argumanlar, { stdio: 'inherit', shell: false })
  cocuklar.push(cocuk)
  cocuk.on('exit', (kod) => {
    if (kapaniyor) return
    console.error(`\n[dev] ${ad} kapandı (kod ${kod}) — diğerleri de kapatılıyor.`)
    kapat(kod ?? 1)
  })
  return cocuk
}

let kapaniyor = false
function kapat(kod) {
  if (kapaniyor) return
  kapaniyor = true
  for (const cocuk of cocuklar) cocuk.kill('SIGTERM')
  setTimeout(() => process.exit(kod), 200)
}

process.on('SIGINT', () => kapat(0))
process.on('SIGTERM', () => kapat(0))

const kisi = process.env.KISI ?? '25'
console.log(`[dev] mock (${kisi} kişi) + Vite başlatılıyor…`)
baslat('mock', process.execPath, ['mock-server/mock.js', '--port=8002', `--kisi=${kisi}`])
baslat('vite', process.execPath, ['node_modules/vite/bin/vite.js'])
