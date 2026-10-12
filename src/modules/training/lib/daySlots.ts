import type { Day } from '../domain/types'

/**
 * Acomoda los días de una semana en sus posiciones de "Día N" de la planilla.
 *
 * Por defecto la posición es el orden por fecha. Pero una semana con menos días
 * que las demás descuadra todo: si el bloque entrena cuatro días y esta semana
 * sólo tres, su tercer día es en realidad el cuarto. Ese día lo fija con
 * `slotIndex` y la posición que deja libre queda vacía, en vez de correrse.
 *
 * Los días sin posición fijada ocupan, en orden de fecha, las posiciones que
 * quedan libres. Dos días que piden la misma posición no se pisan: el segundo
 * pasa a esas libres.
 */
export function arrangeDaysBySlot(days: Day[]): (Day | undefined)[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const placed: (Day | undefined)[] = []
  const free: Day[] = []

  for (const day of sorted) {
    const wanted = day.slotIndex
    if (wanted != null && Number.isInteger(wanted) && wanted >= 0 && placed[wanted] === undefined) {
      placed[wanted] = day
    } else {
      free.push(day)
    }
  }

  let cursor = 0
  for (const day of free) {
    while (placed[cursor] !== undefined) cursor++
    placed[cursor] = day
  }

  // Los huecos de un arreglo disperso no se recorren con map/forEach: se
  // vuelven `undefined` explícitos para que cada posición exista.
  return Array.from({ length: placed.length }, (_, index) => placed[index])
}
