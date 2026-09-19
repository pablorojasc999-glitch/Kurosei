/**
 * El ancho a partir del cual la app pasa a la disposición de escritorio.
 *
 * Vive acá para que el CSS y el JS no se desincronicen: la media query de
 * `App.css` usa este mismo número, y `DESKTOP_MEDIA_QUERY` es lo que consulta
 * el shell para saber si el sidebar está visible de verdad.
 *
 * Por debajo de este ancho no cambia absolutamente nada: la vista de teléfono
 * es la que había.
 */
export const DESKTOP_MIN_WIDTH_PX = 1024

export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`
