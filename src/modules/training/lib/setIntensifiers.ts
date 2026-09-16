/**
 * Drop sets y rest pauses: técnicas que alargan una serie más allá del fallo.
 *
 * No son series aparte —se anotan como un check sobre la serie— pero cuestan
 * bastante más que una serie normal, así que suman a los grupos musculares que
 * el ejercicio trabaja.
 */

/** Cuánto más pesa una serie llevada más allá del fallo. */
export const INTENSIFIER_BONUS = 0.3

export interface Intensifiable {
  /** `undefined` en las series anteriores al campo: cuenta como `false`. */
  dropSet?: boolean
  restPause?: boolean
}

/** Si la serie lleva alguna técnica de intensificación marcada. */
export function isIntensified(set: Intensifiable): boolean {
  return set.dropSet === true || set.restPause === true
}

/**
 * El multiplicador que le corresponde a la serie: 1.3 si lleva alguna técnica.
 *
 * El +30% se aplica una sola vez aunque estén marcadas las dos. Encadenarlos
 * (1.3 × 1.3 = 1.69) daría casi el doble de una serie normal, que es más de lo
 * que una serie, por dura que sea, representa en volumen.
 */
export function intensifierMultiplier(set: Intensifiable): number {
  return isIntensified(set) ? 1 + INTENSIFIER_BONUS : 1
}

/**
 * El aporte de una serie a un grupo muscular, con la intensificación aplicada.
 *
 * Un pecho al 0,8 en un ejercicio pasa a 1,04 cuando la serie es drop set o
 * rest pause.
 */
export function intensifiedFactor(factor: number, set: Intensifiable): number {
  return factor * intensifierMultiplier(set)
}
