import { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from './useMediaQuery'

export type Theme = 'system' | 'light' | 'dark'

// Misma clave que usa el script en index.html: ahí no se puede importar este
// módulo, así que queda repetida a mano.
const STORAGE_KEY = 'kurosei:theme'

// Mismos valores que --bg en index.css para cada tema — la barra de estado
// del teléfono no lee variables CSS, así que se repiten acá.
const STATUS_BAR_COLOR: Record<'light' | 'dark', string> = {
  light: '#faf9fc',
  dark: '#0a0a0c',
}

function isTheme(value: string | null): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    // Sin storage disponible (privado, bloqueado): "Sistema" es un default seguro.
    return 'system'
  }
}

/**
 * El tema es una preferencia de pantalla, no de la cuenta: vive en
 * localStorage y nunca en Supabase, y se puede cambiar sin sesión iniciada
 * (ver AccountPanel.tsx). "Sistema" sigue el modo del teléfono en vivo —
 * `useMediaQuery` ya re-renderiza solo si cambia mientras la pestaña sigue
 * abierta — y una elección explícita lo pisa hasta que se vuelva a tocar.
 */
export function useTheme(): {
  theme: Theme
  effectiveTheme: 'light' | 'dark'
  setTheme: (next: Theme) => void
} {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const effectiveTheme = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme

  useEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', STATUS_BAR_COLOR[effectiveTheme])
  }, [effectiveTheme])

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // El cambio se aplica igual; sólo no sobrevive a recargar la página.
    }
    setThemeState(next)
  }, [])

  return { theme, effectiveTheme, setTheme }
}
