/**
 * El anillo que resume un día: tres arcos, uno por módulo, alrededor del
 * número del día.
 *
 * Tres arcos y no una barra de "2 de 3" porque la posición de cada arco es
 * fija —arriba entrenamiento, abajo a la derecha finanzas, abajo a la
 * izquierda bitácora—, así que de un vistazo no sólo se ve cuánto falta sino qué falta.
 */

export interface RingArc {
  /** Para `stroke-dasharray`: el trazo visible y el resto de la vuelta. */
  dashArray: string
  /** Para `stroke-dashoffset`: dónde empieza el arco. */
  dashOffset: number
}

/**
 * Los arcos de un anillo de radio `radius`, separados por un hueco de
 * `gap` unidades de longitud.
 *
 * Se dibujan sobre un círculo girado -90°, así que el arco 0 arranca arriba y
 * siguen en el sentido del reloj.
 */
export function ringArcs(radius: number, gap: number, segments = 3): RingArc[] {
  const circumference = 2 * Math.PI * radius
  const slice = circumference / segments
  // El hueco se reparte entre las dos puntas del arco, así que queda centrado
  // y todos los arcos salen del mismo largo.
  const stroke = Math.max(0, slice - gap)
  return Array.from({ length: segments }, (_, index) => ({
    dashArray: `${stroke} ${circumference - stroke}`,
    dashOffset: -(index * slice + gap / 2),
  }))
}
