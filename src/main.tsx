import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchFocusedFieldVisibility } from './shared/lib/focusedFieldVisibility'
import { watchKeyboardInset } from './shared/lib/keyboardInset'

// Viven lo que vive la pestaña: no hay nada que desmontar.
watchKeyboardInset()
watchFocusedFieldVisibility()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
