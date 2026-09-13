/** Lo mínimo que tiene que tapar el teclado para contar como tal: unos pocos píxeles son el redondeo de la barra del navegador al aparecer o esconderse. */
const MIN_INSET_PX = 24

/**
 * Cuánto del alto de la página tapa el teclado, en píxeles.
 *
 * `offsetTop` entra en la cuenta porque con la página ampliada el viewport
 * visible no empieza arriba del todo, y sin restarlo el teclado parecería más
 * grande de lo que es.
 */
export function keyboardInset(
  layoutHeight: number,
  visual: { height: number; offsetTop: number } | null,
): number {
  if (!visual) return 0
  const covered = layoutHeight - visual.height - visual.offsetTop
  return covered > MIN_INSET_PX ? Math.round(covered) : 0
}

/**
 * Publica ese alto como `--keyboard-inset` para que los paneles se apoyen sobre
 * el teclado en vez de quedar debajo.
 *
 * El arreglo de verdad es `interactive-widget=resizes-content` en el meta
 * viewport, que encoge la página entera y deja esto en cero. Esto es el
 * respaldo para los navegadores que ignoran esa clave —Safari, sobre todo—,
 * donde el teclado se superpone y la página nunca se entera.
 */
export function watchKeyboardInset(): () => void {
  const visual = window.visualViewport
  if (!visual) return () => {}

  const apply = () => {
    const inset = keyboardInset(window.innerHeight, visual)
    document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
  }

  apply()
  visual.addEventListener('resize', apply)
  visual.addEventListener('scroll', apply)
  return () => {
    visual.removeEventListener('resize', apply)
    visual.removeEventListener('scroll', apply)
  }
}
