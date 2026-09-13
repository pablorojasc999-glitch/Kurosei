/** Aire que se deja entre el campo y el borde del área visible, para que no quede pegado al teclado. */
const MARGIN_PX = 12

/** Cuánto se espera al enfocar por si el teclado no avisa de que cambió el viewport. */
const SETTLE_MS = 350

export interface FieldRect {
  top: number
  bottom: number
}

/**
 * Si el campo enfocado quedó fuera del área que el teclado deja libre.
 *
 * Se mira contra el alto visible y no contra el de la ventana: con el teclado
 * abierto son dos cosas distintas, y esa diferencia es justo el problema.
 */
export function isFieldOutOfView(
  rect: FieldRect,
  visibleHeight: number,
  margin = MARGIN_PX,
): boolean {
  return rect.bottom > visibleHeight - margin || rect.top < margin
}

/** Los elementos que abren teclado y, por tanto, hay que mantener a la vista. */
function isFormField(node: EventTarget | null): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Mantiene a la vista el campo que se está escribiendo cuando sube el teclado.
 *
 * El navegador desplaza el campo al enfocarlo, pero lo hace *antes* de que el
 * teclado encoja el viewport: para cuando el teclado está arriba, un campo que
 * estaba abajo de la página ya quedó debajo. Por eso no basta con enfocar, hay
 * que volver a mirarlo cuando el viewport ya cambió.
 *
 * Se engancha al viewport visible en vez de a `focus` porque el teclado tarda
 * en aparecer, y queda un plazo de respaldo para los navegadores que no avisan.
 */
export function watchFocusedFieldVisibility(): () => void {
  let settleTimer: ReturnType<typeof setTimeout> | undefined

  const ensureVisible = () => {
    const field = document.activeElement
    if (!isFormField(field)) return

    const visibleHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = field.getBoundingClientRect()
    if (!isFieldOutOfView(rect, visibleHeight)) return

    // `center` y no `nearest`: dejarlo justo sobre el teclado lo pega al borde,
    // y al escribir no se ve ni la etiqueta de lo que se está llenando.
    field.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const onFocusIn = (e: FocusEvent) => {
    if (!isFormField(e.target)) return
    clearTimeout(settleTimer)
    settleTimer = setTimeout(ensureVisible, SETTLE_MS)
  }

  document.addEventListener('focusin', onFocusIn)
  window.visualViewport?.addEventListener('resize', ensureVisible)

  return () => {
    clearTimeout(settleTimer)
    document.removeEventListener('focusin', onFocusIn)
    window.visualViewport?.removeEventListener('resize', ensureVisible)
  }
}
