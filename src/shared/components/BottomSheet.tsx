import { useEffect, useRef, type ReactNode } from 'react'

interface BottomSheetProps {
  title: string
  /** Línea de contexto bajo el título: el día, la fecha, la cuenta… */
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

/**
 * Panel anclado al borde inferior de la ventana para crear y editar.
 *
 * Sustituye al formulario que se renderizaba al final de la página: con una
 * lista larga, tocar "Editar" en algo de arriba obligaba a bajar hasta el
 * fondo para escribir. Acá el formulario aparece siempre donde está la vista.
 */
export function BottomSheet({ title, subtitle, onClose, children }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Se devuelve el foco a donde estaba: cerrar no puede dejarlo en el body,
    // porque el lector de pantalla se quedaría sin punto de partida.
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    // El fondo no scrollea mientras el panel está abierto: si no, arrastrar
    // dentro del panel mueve la página de atrás.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="sheet-head">
          <div className="sheet-titles">
            <h3>{title}</h3>
            {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
