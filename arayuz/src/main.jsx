import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import App from './App.jsx'
import { kayitliTemayiUygula } from './api/useTema.js'

kayitliTemayiUygula()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
