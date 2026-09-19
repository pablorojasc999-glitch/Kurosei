/**
 * El ancho a partir del cual la app pasa a la disposición de escritorio.
 *
 * Vive acá para que el CSS y el JS no se desincronicen: la media query de
 * `App.css` usa este mismo número, y `DESKTOP_MEDIA_QUERY` es lo que consulta
 * el shell para saber si el sidebar está visible de verdad.
 *
 * Por debajo de este ancho no cambia absolutamente nada: la vista de teléfono
 * es la que había.
 *
 * Son 960 y no 1024 por Chrome en Android: al pedir "sitio para computadoras"
 * ignora el `width=device-width` y maqueta la página a 980px fijos. Con el
 * corte en 1024 esa opción no alcanzaba a activar nada. Ningún teléfono real
 * llega a 960 por sí solo, ni acostado (los más anchos rondan los 930).
 */
export const DESKTOP_MIN_WIDTH_PX = 960

export const DESKTOP_MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`
