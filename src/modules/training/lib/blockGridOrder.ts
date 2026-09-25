/**
 * Mover una fila de la planilla dentro de su día.
 *
 * Es su propio criterio y no el de `reorderPlannedExercise` porque una fila de
 * la planilla no es un ejercicio planificado, sino el mismo ejercicio repetido
 * en todas las semanas del bloque: moverlo tiene que moverlo en las cuatro
 * columnas a la vez, así que primero se decide el orden nuevo y después se
 * aplica a cada semana.
 */
export function moveInOrder(
  ids: string[],
  id: string,
  direction: 'up' | 'down',
): string[] {
  const index = ids.indexOf(id)
  if (index === -1) return ids
  const target = direction === 'up' ? index - 1 : index + 1
  // Ya está arriba del todo o abajo del todo: no hay a dónde moverlo.
  if (target < 0 || target >= ids.length) return ids
  const next = [...ids]
  next[index] = ids[target]
  next[target] = id
  return next
}
