import type {
  Day,
  ExerciseMuscleContribution,
  PlannedExercise,
  PlannedSet,
  Week,
} from '../domain/types'
import { muscleGroupKey } from './muscleGroupTotals'
import { intensifiedFactor, isIntensified } from './setIntensifiers'

/**
 * Las series efectivas programadas del bloque: una fila por grupo muscular y
 * una columna por semana.
 *
 * "Efectiva" no se deduce de la prescripción sino que se marca: la serie de
 * aproximación mueve la barra pero no es trabajo que haya que recuperar, y
 * ninguna regla automática sobre el RPE planificado acierta con eso. Por eso
 * cada serie decide si entra, y esto sólo suma las marcadas.
 *
 * Se cuenta ponderado por implicancia, igual que el mapa corporal y las listas
 * de Progreso: una serie de press banca con el pecho en 0.8 son 0.8 series de
 * pecho, no una. Si no, un accesorio que roza un músculo pesaría lo mismo que
 * un básico.
 */

/** Lo que aporta un ejercicio de un día a un músculo en una semana. */
export interface EffectiveSetsItem {
  plannedExerciseId: string
  exerciseName: string
  /** `Día 2`, como lo llama la planilla. */
  dayLabel: string
  date: string | null
  /** Series de ese ejercicio que cuentan. */
  countedSets: number
  /** Cuántas tiene en total, cuenten o no: `2 de 4` se explica solo. */
  totalSets: number
  /** Cuánto involucra ese ejercicio a este músculo. */
  factor: number
  /** De las que cuentan, cuántas llevan drop set o rest pause. */
  intensifiedSets: number
  value: number
}

export interface EffectiveSetsCell {
  value: number
  /** De dónde sale el número, de mayor a menor aporte. */
  items: EffectiveSetsItem[]
}

export interface EffectiveSetsRow {
  /** La misma clave con la que agrupa el resto de la app. */
  key: string
  name: string
  /** Una celda por semana, en orden de semana. */
  perWeek: EffectiveSetsCell[]
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
  /** Nombre del ejercicio por id, para el desglose. */
  exerciseNames: Map<string, string>
  /** `Día N` por id de día, tal como lo numera la planilla. */
  dayLabels: Map<string, string>
}

/**
 * Si una serie cuenta.
 *
 * Sólo `false` la saca. Sin marca propia manda la del ejercicio, que es donde
 * vivía la marca antes: así lo que ya estaba excluido sigue excluido sin tener
 * que migrar nada. Nada escribe ya a ese nivel.
 */
export function countsAsEffective(set: PlannedSet, exercise?: PlannedExercise): boolean {
  if (set.countsAsEffective !== undefined) return set.countsAsEffective
  return exercise?.countsAsEffective !== false
}

export function buildEffectiveSets({
  weeks,
  days,
  plannedExercises,
  plannedSets,
  contributions,
  muscleGroupNames,
  exerciseNames,
  dayLabels,
}: EffectiveSetsInput): EffectiveSetsRow[] {
  const weekIndexById = new Map(weeks.map((w, index) => [w.id, index]))
  const dayById = new Map(days.map((d) => [d.id, d]))

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

  const emptyCell = (): EffectiveSetsCell => ({ value: 0, items: [] })
  const rows = new Map<string, EffectiveSetsRow>()

  for (const pe of plannedExercises) {
    const day = dayById.get(pe.dayId)
    if (!day || day.weekId === null) continue
    const weekIndex = weekIndexById.get(day.weekId)
    if (weekIndex === undefined) continue

    const allSets = setsByPe.get(pe.id) ?? []
    const counted = allSets.filter((set) => countsAsEffective(set, pe))
    if (counted.length === 0) continue

    const involved = contributionsByExercise.get(pe.exerciseId) ?? []
    for (const contribution of involved) {
      const groupName = muscleGroupNames.get(contribution.muscleGroupId)
      if (groupName === undefined) continue
      const { key, name } = muscleGroupKey(groupName)
      let row = rows.get(key)
      if (!row) {
        row = { key, name, perWeek: weeks.map(emptyCell), total: 0 }
        rows.set(key, row)
      }

      // Un drop set o un rest pause pesan más que una serie normal: el mismo
      // +30% que ya se aplica al volumen y al estrés de lo ejecutado.
      const value = counted.reduce(
        (sum, set) => sum + intensifiedFactor(contribution.factor, set),
        0,
      )
      const cell = row.perWeek[weekIndex]
      cell.value += value
      cell.items.push({
        plannedExerciseId: pe.id,
        exerciseName: exerciseNames.get(pe.exerciseId) ?? 'Ejercicio',
        dayLabel: dayLabels.get(pe.dayId) ?? 'Día',
        date: day.date,
        countedSets: counted.length,
        totalSets: allSets.length,
        factor: contribution.factor,
        intensifiedSets: counted.filter(isIntensified).length,
        value,
      })
      row.total += value
    }
  }

  for (const row of rows.values()) {
    for (const cell of row.perWeek) {
      cell.items.sort(
        (a, b) => b.value - a.value || a.exerciseName.localeCompare(b.exerciseName, 'es'),
      )
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'),
  )
}
