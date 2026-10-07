import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Geliştirmede arayüz Vite'tan, veri mock sunucudan gelir. Uçlar göreli
// adresle çağrılır; üretimde dist/ zaten aynı adresten servis edilir.
// MOCK_PORT ile izole ikinci bir yığın (test) ana görünümü bozmadan çalışır.
const mockPort = process.env.MOCK_PORT || '8002'
const hedef = `http://localhost:${mockPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/state': hedef,
      '/events': hedef,
      '/control': hedef,
      '/api': hedef,
    },
  },
})
