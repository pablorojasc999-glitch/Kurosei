import { toCsv, type CsvCell } from '../../../shared/lib/csv'
import type {
  Day,
  ExecutedSet,
  Exercise,
  ExerciseCategory,
  Macrocycle,
  Mesocycle,
  PlannedExercise,
  PlannedSet,
  SessionExercise,
  StrengthSession,
  Week,
} from '../domain/types'
import { toDateKey } from './calendarGrid'
import { e1rmForSet } from './e1rm'
import { calculateStressIndex } from './stressIndex'
import { compareWeeks, formatWeekRange } from './weeks'

/**
 * Los registros de entrenamiento, una fila por serie: lo planificado junto a lo
 * que se hizo, con el contexto (macro, meso, semana) y las métricas por serie.
 *
 * Las filas salen de emparejar el plan con lo ejecutado por posición —la
 * tercera serie planificada con la tercera hecha—, que es como se entrena y
 * como ya lo lee la planilla del bloque. Una serie planificada que no se hizo
 * sale con REALIZADO "No"; una hecha de más, sin plan, con REALIZADO "Sí".
 */

export interface TrainingLogData {
  macrocycles: Macrocycle[]
  mesocycles: Mesocycle[]
  weeks: Week[]
  days: Day[]
  exercises: Exercise[]
  plannedExercises: PlannedExercise[]
  plannedSets: PlannedSet[]
  sessions: StrengthSession[]
  sessionExercises: SessionExercise[]
  executedSets: ExecutedSet[]
}

export const TRAINING_LOG_HEADER = [
  'MACROCICLO',
  'MESOCICLO',
  'MICROCICLO',
  'MAX E1RM SQ LAST BLOCK',
  'E1RM BP LAST BLOCK',
  'E1RM DL LAST BLOCK',
  'FECHA',
  'PRIORIDAD',
  'REALIZADO',
  'SERIE',
  'EJERCICIO',
  'PESO PLAN',
  'REPS PLAN',
  'RPE PLAN',
  'PESO REAL',
  'REPS REAL',
  'RPE REAL',
  '% DEL 1RM',
  'E1RM',
  'TONELAJE',
  'NEURAL STRESS',
  'MUSCULAR STRESS',
  'TOTAL STRESS',
  'STRESS INDEX',
]

const MAIN_LIFTS: ExerciseCategory[] = ['squat', 'bench', 'deadlift']

type LiftMaxes = Record<ExerciseCategory, number | null>

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Las tres métricas por serie que no son un dato sino una cuenta.
 *
 * - STRESS INDEX: el de la app, a partir del RPE real de la serie.
 * - MUSCULAR: el índice por las repeticiones; cuántas repeticiones duras fueron.
 * - NEURAL: el índice por la fracción del 1RM; qué tan pesado fue, no cuánto duró.
 * - TOTAL: el promedio de las dos, como describe el índice de estrés de RTS
 *   (curva total = promedio de la periférica y la central).
 *
 * Las dos últimas son una definición propia: no encontré una fórmula publicada
 * que separe estrés neural y muscular, así que viven acá, juntas y probadas,
 * para cambiarlas en un solo lugar cuando haya una definición mejor.
 */
export function setStress(input: { reps: number; rpe: number | null; percentOf1rm: number | null }): {
  stressIndex: number | null
  neural: number | null
  muscular: number | null
  total: number | null
} {
  if (input.rpe === null) return { stressIndex: null, neural: null, muscular: null, total: null }
  const stressIndex = calculateStressIndex(input.rpe)
  const muscular = stressIndex * input.reps
  const neural = input.percentOf1rm === null ? null : stressIndex * (input.percentOf1rm / 100)
  return {
    stressIndex,
    neural,
    muscular,
    total: neural === null ? null : (neural + muscular) / 2,
  }
}

/** Para cada mesociclo, el anterior por fecha de inicio (de cualquier macrociclo). */
function previousMesocycleById(mesocycles: Mesocycle[]): Map<string, Mesocycle | null> {
  const sorted = [...mesocycles].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return new Map(sorted.map((m, index) => [m.id, sorted[index - 1] ?? null]))
}

export function buildTrainingLogCsv(data: TrainingLogData): string {
  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]))
  const mesoById = new Map(data.mesocycles.map((m) => [m.id, m]))
  const macroById = new Map(data.macrocycles.map((m) => [m.id, m]))
  const weekById = new Map(data.weeks.map((w) => [w.id, w]))
  const dayById = new Map(data.days.map((d) => [d.id, d]))
  const previousMeso = previousMesocycleById(data.mesocycles)

  // "Semana N" es la posición de la semana entre las de su mesociclo, por fecha.
  const weekNumber = new Map<string, number>()
  for (const meso of data.mesocycles) {
    data.weeks
      .filter((w) => w.mesocycleId === meso.id)
      .sort(compareWeeks)
      .forEach((w, index) => weekNumber.set(w.id, index + 1))
  }

  // Lo ejecutado, agrupado por día y ejercicio (una sesión por día).
  const sessionByDay = new Map(data.sessions.map((s) => [s.dayId, s]))
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]))
  const sessionExercisesBySession = new Map<string, SessionExercise[]>()
  for (const se of data.sessionExercises) {
    const list = sessionExercisesBySession.get(se.sessionId) ?? []
    list.push(se)
    sessionExercisesBySession.set(se.sessionId, list)
  }
  const executedBySessionExercise = new Map<string, ExecutedSet[]>()
  for (const set of data.executedSets) {
    const list = executedBySessionExercise.get(set.sessionExerciseId) ?? []
    list.push(set)
    executedBySessionExercise.set(set.sessionExerciseId, list)
  }

  // El mejor e1RM de cada básico dentro de un mesociclo, calculado una vez.
  const dayWeek = (dayId: string) => {
    const day = dayById.get(dayId)
    return day?.weekId ? weekById.get(day.weekId) : undefined
  }
  const maxByMesoAndLift = new Map<string, LiftMaxes>()
  for (const se of data.sessionExercises) {
    const session = sessionById.get(se.sessionId)
    const mesoId = session ? dayWeek(session.dayId)?.mesocycleId : null
    const category = exerciseById.get(se.exerciseId)?.category
    if (!mesoId || !category) continue
    const maxes = maxByMesoAndLift.get(mesoId) ?? { squat: null, bench: null, deadlift: null }
    for (const set of executedBySessionExercise.get(se.id) ?? []) {
      const e1rm = e1rmForSet({ weightKg: set.weightKg, reps: set.reps, rpe: set.rpe })
      if (e1rm !== null && (maxes[category] === null || e1rm > maxes[category])) maxes[category] = e1rm
    }
    maxByMesoAndLift.set(mesoId, maxes)
  }
  const lastBlockMaxes = (mesoId: string | null): LiftMaxes => {
    const previous = mesoId ? previousMeso.get(mesoId) : null
    return (previous && maxByMesoAndLift.get(previous.id)) || { squat: null, bench: null, deadlift: null }
  }

  const plannedByDay = new Map<string, PlannedExercise[]>()
  for (const pe of data.plannedExercises) {
    const list = plannedByDay.get(pe.dayId) ?? []
    list.push(pe)
    plannedByDay.set(pe.dayId, list)
  }
  const plannedSetsByPe = new Map<string, PlannedSet[]>()
  for (const ps of data.plannedSets) {
    const list = plannedSetsByPe.get(ps.plannedExerciseId) ?? []
    list.push(ps)
    plannedSetsByPe.set(ps.plannedExerciseId, list)
  }

  const rows: CsvCell[][] = []
  const days = [...data.days].sort((a, b) => a.date.localeCompare(b.date))
  for (const day of days) {
    const week = day.weekId ? weekById.get(day.weekId) : undefined
    const meso = week?.mesocycleId ? mesoById.get(week.mesocycleId) : undefined
    const macro = meso ? macroById.get(meso.macrocycleId) : undefined
    const maxes = lastBlockMaxes(meso?.id ?? null)

    const planned = [...(plannedByDay.get(day.id) ?? [])].sort((a, b) => a.order - b.order)
    const session = sessionByDay.get(day.id)
    const sessionExercises = [...(session ? (sessionExercisesBySession.get(session.id) ?? []) : [])].sort(
      (a, b) => a.order - b.order,
    )

    // Un ejercicio por cada planificado, y después los que se hicieron sin plan.
    const usedSessionExercises = new Set<string>()
    const entries: Array<{ exerciseId: string; plannedSets: PlannedSet[]; executedSets: ExecutedSet[] }> = []
    for (const pe of planned) {
      const se = sessionExercises.find((x) => x.exerciseId === pe.exerciseId && !usedSessionExercises.has(x.id))
      if (se) usedSessionExercises.add(se.id)
      entries.push({
        exerciseId: pe.exerciseId,
        plannedSets: [...(plannedSetsByPe.get(pe.id) ?? [])].sort((a, b) => a.setNumber - b.setNumber),
        executedSets: se ? [...(executedBySessionExercise.get(se.id) ?? [])].sort((a, b) => a.setNumber - b.setNumber) : [],
      })
    }
    for (const se of sessionExercises) {
      if (usedSessionExercises.has(se.id)) continue
      entries.push({
        exerciseId: se.exerciseId,
        plannedSets: [],
        executedSets: [...(executedBySessionExercise.get(se.id) ?? [])].sort((a, b) => a.setNumber - b.setNumber),
      })
    }

    for (const entry of entries) {
      const exercise = exerciseById.get(entry.exerciseId)
      // El cardio no tiene series con peso y repeticiones: va por su lado.
      if (!exercise || exercise.type !== 'strength') continue
      const category = exercise.category
      const lift = category && MAIN_LIFTS.includes(category) ? category : null
      const blockMax = lift ? maxes[lift] : null

      const count = Math.max(entry.plannedSets.length, entry.executedSets.length)
      for (let i = 0; i < count; i++) {
        const plan = entry.plannedSets[i]
        const done = entry.executedSets[i]
        const percentOf1rm =
          done && done.weightKg !== null && blockMax ? (done.weightKg / blockMax) * 100 : null
        const e1rm = done ? e1rmForSet({ weightKg: done.weightKg, reps: done.reps, rpe: done.rpe }) : null
        const stress = done
          ? setStress({ reps: done.reps, rpe: done.rpe, percentOf1rm })
          : { stressIndex: null, neural: null, muscular: null, total: null }

        rows.push([
          macro?.name ?? '',
          meso?.name ?? '',
          week ? (weekNumber.has(week.id) ? `Semana ${weekNumber.get(week.id)}` : formatWeekRange(week)) : '',
          maxes.squat === null ? null : round(maxes.squat, 1),
          maxes.bench === null ? null : round(maxes.bench, 1),
          maxes.deadlift === null ? null : round(maxes.deadlift, 1),
          toDateKey(new Date(day.date)),
          lift ? 1 : 0,
          done ? 'Sí' : 'No',
          i + 1,
          exercise.name,
          plan?.targetWeightKg ?? null,
          plan?.targetReps ?? null,
          plan?.targetRpe ?? null,
          done?.weightKg ?? null,
          done?.reps ?? null,
          done?.rpe ?? null,
          percentOf1rm === null ? null : round(percentOf1rm, 1),
          e1rm === null ? null : round(e1rm, 1),
          done && done.weightKg !== null ? round(done.weightKg * done.reps, 1) : null,
          stress.neural === null ? null : round(stress.neural, 2),
          stress.muscular === null ? null : round(stress.muscular, 2),
          stress.total === null ? null : round(stress.total, 2),
          stress.stressIndex === null ? null : round(stress.stressIndex, 2),
        ])
      }
    }
  }

  return toCsv(TRAINING_LOG_HEADER, rows)
}
