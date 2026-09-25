import type {
  Day,
  ExerciseMuscleContribution,
  PlannedExercise,
  PlannedSet,
  Week,
} from '../domain/types'
import { muscleGroupKey } from './muscleGroupTotals'
import { intensifiedFactor } from './setIntensifiers'

/**
 * Las series efectivas programadas del bloque: una fila por grupo muscular y
 * una columna por semana.
 *
 * "Efectiva" no se deduce de la prescripción sino que se marca: un día técnico
 * al 50% mueve la barra pero no es trabajo que haya que recuperar, y ninguna
 * regla automática sobre el RPE planificado acierta con eso. Por eso cada
 * ejercicio planificado decide si entra (`countsAsEffective`), y esto sólo
 * suma lo que quedó marcado.
 *
 * Se cuenta ponderado por implicancia, igual que el mapa corporal y las listas
 * de Progreso: una serie de press banca con el pecho en 0.8 son 0.8 series de
 * pecho, no una. Si no, un accesorio que roza un músculo pesaría lo mismo que
 * un básico.
 */

export interface EffectiveSetsRow {
  /** La misma clave con la que agrupa el resto de la app. */
  key: string
  name: string
  /** Series efectivas en cada semana, en orden de semana. */
  perWeek: number[]
  total: number
}

export interface EffectiveSetsInput {
  /** Las semanas del bloque, ya en orden. */
  weeks: Week[]
  days: Day[]
  plannedExercises: PlannedExercise[]
  plannedSets: PlannedSet[]
  contributions: ExerciseMuscleContribution[]
  /** Nombre del grupo muscular por id; los que no estén se ignoran. */
  muscleGroupNames: Map<string, string>
}

/** Sólo `false` saca del conteo: lo que nunca se marcó, cuenta. */
export function countsAsEffective(pe: PlannedExercise): boolean {
  return pe.countsAsEffective !== false
}

export function buildEffectiveSets({
  weeks,
  days,
  plannedExercises,
  plannedSets,
  contributions,
  muscleGroupNames,
}: EffectiveSetsInput): EffectiveSetsRow[] {
  const weekIndexById = new Map(weeks.map((w, index) => [w.id, index]))
  const weekOfDay = new Map<string, number>()
  for (const day of days) {
    if (day.weekId === null) continue
    const index = weekIndexById.get(day.weekId)
    if (index !== undefined) weekOfDay.set(day.id, index)
  }

  const setsByPe = new Map<string, PlannedSet[]>()
  for (const set of plannedSets) {
    const list = setsByPe.get(set.plannedExerciseId)
    if (list) list.push(set)
    else setsByPe.set(set.plannedExerciseId, [set])
  }

  const contributionsByExercise = new Map<string, ExerciseMuscleContribution[]>()
  for (const c of contributions) {
    const list = contributionsByExercise.get(c.exerciseId)
    if (list) list.push(c)
    else contributionsByExercise.set(c.exerciseId, [c])
  }

  const rows = new Map<string, EffectiveSetsRow>()

  for (const pe of plannedExercises) {
    if (!countsAsEffective(pe)) continue
    const weekIndex = weekOfDay.get(pe.dayId)
    if (weekIndex === undefined) continue
    const sets = setsByPe.get(pe.id) ?? []
    if (sets.length === 0) continue
    const involved = contributionsByExercise.get(pe.exerciseId) ?? []
    if (involved.length === 0) continue

    for (const contribution of involved) {
      const groupName = muscleGroupNames.get(contribution.muscleGroupId)
      if (groupName === undefined) continue
      const { key, name } = muscleGroupKey(groupName)
      let row = rows.get(key)
      if (!row) {
        row = { key, name, perWeek: weeks.map(() => 0), total: 0 }
        rows.set(key, row)
      }
      for (const set of sets) {
        // Un drop set o un rest pause pesan más que una serie normal: el mismo
        // +30% que ya se aplica al volumen y al estrés de lo ejecutado.
        const value = intensifiedFactor(contribution.factor, set)
        row.perWeek[weekIndex] += value
        row.total += value
      }
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'),
  )
}
