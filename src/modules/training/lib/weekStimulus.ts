import { MIN_RPE_FOR_VOLUME, muscleGroupVolume, type MuscleContribution } from './metrics'
import { mergeMuscleGroupTotals, type MuscleGroupTotal } from './muscleGroupTotals'
import type { Intensifiable } from './setIntensifiers'

export interface StimulusSet extends Intensifiable {
  exerciseId: string
  rpe: number | null
}

/**
 * Si una serie planificada cuenta como estímulo.
 *
 * Las que traen RPE cuentan desde el mínimo de volumen (las demasiado livianas
 * no son estímulo real). Las que no traen RPE también cuentan: si el plan no lo
 * prescribe —un accesorio "a sensación"— excluirlas dejaría sin estímulo
 * ejercicios que sí se hacen.
 */
export function countsForStimulus(rpe: number | null): boolean {
  return rpe === null || rpe >= MIN_RPE_FOR_VOLUME
}

/**
 * El estímulo de una semana por grupo muscular: las series que cuentan,
 * ponderadas por la contribución de cada ejercicio (y el +30% de las
 * intensificadas), juntadas en una fila por músculo.
 *
 * `nameOf` devuelve `undefined` para un grupo que no se puede nombrar; esas
 * filas se descartan en vez de mostrarse como "?".
 */
export function weekStimulusByGroup(
  sets: StimulusSet[],
  contributionsByExercise: Map<string, MuscleContribution[]>,
  nameOf: (muscleGroupId: string) => string | undefined,
): MuscleGroupTotal[] {
  const counted = sets
    .filter((s) => countsForStimulus(s.rpe))
    // `muscleGroupVolume` ignora las series sin RPE; acá ya se decidió que
    // cuentan, así que entran con el mínimo para que pasen su filtro.
    .map((s) => ({ ...s, rpe: s.rpe ?? MIN_RPE_FOR_VOLUME }))
  const byId = muscleGroupVolume(counted, contributionsByExercise)
  const named = [...byId].filter(([id]) => nameOf(id) !== undefined)
  return mergeMuscleGroupTotals(named, (id) => nameOf(id) as string)
}

export interface DayStimulusSet extends StimulusSet {
  dayId: string
}

export interface StimulusRow {
  key: string
  name: string
  /** El estímulo de la semana entera para este grupo. */
  total: number
  /** Lo que aporta cada día, en el mismo orden que los días pedidos. */
  perDay: number[]
}

export interface WeekStimulus {
  rows: StimulusRow[]
  /** El estímulo total de cada día, sumando todos los grupos: dice qué día carga más. */
  dayTotals: number[]
}

/**
 * El estímulo de la semana repartido por día: una fila por músculo con lo que
 * aporta cada día, para ver en cuál se concentra.
 *
 * Cada día se calcula por separado con el mismo criterio de la semana y las
 * filas se juntan por músculo después, así que la suma de los días da
 * exactamente el total semanal.
 */
export function weekStimulusByDay(
  sets: DayStimulusSet[],
  dayIds: string[],
  contributionsByExercise: Map<string, MuscleContribution[]>,
  nameOf: (muscleGroupId: string) => string | undefined,
): WeekStimulus {
  const merged = new Map<string, StimulusRow>()
  const dayTotals = dayIds.map(() => 0)
  dayIds.forEach((dayId, dayIndex) => {
    const totals = weekStimulusByGroup(
      sets.filter((s) => s.dayId === dayId),
      contributionsByExercise,
      nameOf,
    )
    for (const t of totals) {
      const row = merged.get(t.key) ?? {
        key: t.key,
        name: t.name,
        total: 0,
        perDay: dayIds.map(() => 0),
      }
      row.perDay[dayIndex] += t.value
      row.total += t.value
      dayTotals[dayIndex] += t.value
      merged.set(t.key, row)
    }
  })
  const rows = [...merged.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'))
  return { rows, dayTotals }
}
