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
