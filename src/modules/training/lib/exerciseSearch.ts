import { normalizeText } from './text'

/**
 * El criterio del buscador de ejercicios: una sola caja que entiende tanto un
 * nombre ("press banca") como un grupo muscular ("hombro").
 *
 * Buscar por músculo no puede ser sólo un filtro. Si se pide "hombro", lo útil
 * no es la lista alfabética de los veinte ejercicios que tocan el hombro: es
 * ver primero aquellos donde el hombro pesa más. Por eso los resultados por
 * músculo salen ordenados por factor de implicancia, de mayor a menor.
 *
 * Sin nada escrito quedan todos en orden alfabético, que es la lista de
 * siempre: el buscador agrega maneras de encontrar, no quita la que ya había.
 */

export interface SearchableExercise {
  id: string
  name: string
}

/** Cuánto involucra un ejercicio a un grupo muscular, con el nombre ya resuelto. */
export interface MuscleInvolvement {
  exerciseId: string
  groupName: string
  factor: number
}

export interface ExerciseSearchResult {
  id: string
  name: string
  /**
   * Por qué músculo entró y con cuánto peso, cuando entró por músculo. Null
   * cuando entró por nombre o cuando no se buscó nada: ahí el factor no aporta
   * y mostrarlo confundiría (no es "el" factor del ejercicio, es el de un
   * grupo puntual).
   */
  matchedGroup: { name: string; factor: number } | null
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'es')
}

export function searchExercises(
  query: string,
  exercises: SearchableExercise[],
  involvements: MuscleInvolvement[],
): ExerciseSearchResult[] {
  const needle = normalizeText(query)
  const alphabetical = [...exercises].sort(byName)

  if (needle === '') {
    return alphabetical.map((e) => ({ id: e.id, name: e.name, matchedGroup: null }))
  }

  const porNombre = alphabetical.filter((e) => normalizeText(e.name).includes(needle))
  const yaEstan = new Set(porNombre.map((e) => e.id))

  // Un ejercicio puede tocar más de un grupo que calce con lo buscado
  // ("deltoides anterior" y "deltoides posterior" con "deltoides"): vale el más
  // implicado, que es el que responde "¿cuánto trabaja esto lo que busco?".
  const nombreDe = new Map(exercises.map((e) => [e.id, e.name]))
  const mejorPorEjercicio = new Map<string, { name: string; factor: number }>()
  for (const inv of involvements) {
    if (yaEstan.has(inv.exerciseId)) continue
    if (!nombreDe.has(inv.exerciseId)) continue
    if (!normalizeText(inv.groupName).includes(needle)) continue
    const actual = mejorPorEjercicio.get(inv.exerciseId)
    if (!actual || inv.factor > actual.factor) {
      mejorPorEjercicio.set(inv.exerciseId, { name: inv.groupName, factor: inv.factor })
    }
  }

  const porMusculo = [...mejorPorEjercicio.entries()]
    .map(([id, matchedGroup]) => ({
      id,
      name: nombreDe.get(id) as string,
      matchedGroup,
    }))
    .sort(
      (a, b) =>
        b.matchedGroup.factor - a.matchedGroup.factor || byName(a, b),
    )

  // Primero lo que calza por nombre: si se escribió el nombre de un ejercicio,
  // ese ejercicio es lo que se está buscando, no uno que comparta músculo.
  return [
    ...porNombre.map((e) => ({ id: e.id, name: e.name, matchedGroup: null })),
    ...porMusculo,
  ]
}
