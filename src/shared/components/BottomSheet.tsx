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

  // `onClose` llega casi siempre como una función nueva en cada render, así que
  // no puede ser dependencia de un efecto: bastaría con teclear una letra para
  // que el efecto se limpiara y se volviera a montar. Se guarda en una caja y
  // el listener lee siempre la última.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  /*
   * Este efecto corre UNA vez, al abrir y al cerrar el panel, y nunca entre
   * medias. Si dependiera de algo que cambia al escribir, cada tecla haría lo
   * mismo que cerrar y reabrir: devolver el foco a donde estaba y luego
   * plantarlo en el panel. En el teléfono eso saca el foco del campo y cierra
   * el teclado en cuanto escribes el primer carácter.
   */
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
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

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
