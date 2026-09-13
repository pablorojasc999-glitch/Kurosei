import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchKeyboardInset } from './shared/lib/keyboardInset'

// Vive lo que vive la pestaña: no hay nada que desmontar.
watchKeyboardInset()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
