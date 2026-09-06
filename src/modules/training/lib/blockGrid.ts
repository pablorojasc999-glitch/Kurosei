import type {
  Day,
  ExecutedSet,
  Exercise,
  PlannedExercise,
  PlannedSet,
  SessionExercise,
  StrengthSession,
  Week,
} from '../domain/types'

/**
 * La planilla del bloque: una fila por ejercicio, una columna por semana, y
 * los ejercicios agrupados por el día en que caen.
 *
 * El "día 1" es posicional, no el lunes: dentro de cada semana los días se
 * ordenan por fecha y esa posición es la que empareja las columnas. Así el
 * primer día de todas las semanas queda en la misma fila aunque las fechas no
 * coincidan en día de la semana.
 */

/** Una serie ya normalizada: planificada y realizada se leen igual. */
export interface GridSet {
  weightKg: number | null
  reps: number
  rpe: number | null
}

export interface CellSummary {
  /** `5×3`, o `5/5/3` cuando las series no son iguales. Vacío si no hay series. */
  volume: string
  /** `140 kg`, `@8`, `140 kg @8`. Vacío si no hay ni peso ni RPE. */
  intensity: string
}

export interface GridCell {
  weekId: string
  /** El día de esa semana en esta posición; `null` si la semana no llega a tener ese día. */
  dayId: string | null
  /** El ejercicio planificado en esa celda; `null` si esa semana no lo tiene. */
  plannedExerciseId: string | null
  planned: CellSummary
  /** El plan serie a serie, en orden. */
  plannedSets: GridSet[]
  /** Lo que se hizo de verdad, serie a serie. Vacío si ese día no se registró. */
  executedSets: GridSet[]
  executed: CellSummary
  setCount: number
}

export interface GridRow {
  exerciseId: string
  exerciseName: string
  /** Una celda por semana, en orden de semana. */
  cells: GridCell[]
}

export interface GridDaySlot {
  slotIndex: number
  /** El `label` que comparten los días de esa posición, o `Día N` si no hay uno común. */
  label: string
  /** Fecha de ese día en cada semana; `null` donde la semana no tiene ese día. */
  dates: (string | null)[]
  dayIds: (string | null)[]
  rows: GridRow[]
}

export interface BlockGrid {
  weeks: Week[]
  slots: GridDaySlot[]
}

/** Redondea a un decimal y le quita el `.0` — 140 y 137.5, no 140.0. */
function formatKg(value: number): string {
  return `${Math.round(value * 10) / 10}`
}

/**
 * Resume las series en las dos líneas que se leen de un vistazo: cuánto
 * volumen y a qué intensidad. Sirve igual para el plan y para lo realizado.
 */
export function summarizeSets(ordered: GridSet[]): CellSummary {
  if (ordered.length === 0) return { volume: '', intensity: '' }

  const reps = ordered.map((s) => s.reps)
  const sameReps = reps.every((r) => r === reps[0])
  const volume = sameReps ? `${ordered.length}×${reps[0]}` : reps.join('/')

  const weights = ordered.map((s) => s.weightKg)
  const rpes = ordered.map((s) => s.rpe)
  const parts: string[] = []

  const definedWeights = weights.filter((w): w is number => w !== null)
  if (definedWeights.length > 0) {
    const sameWeight =
      definedWeights.length === ordered.length &&
      definedWeights.every((w) => w === definedWeights[0])
    // Cuando el peso sube dentro del día, la serie tope es la que informa.
    parts.push(
      sameWeight
        ? `${formatKg(definedWeights[0])} kg`
        : `${formatKg(Math.max(...definedWeights))} kg máx`,
    )
  }

  const definedRpes = rpes.filter((r): r is number => r !== null)
  if (definedRpes.length > 0) {
    const sameRpe =
      definedRpes.length === ordered.length && definedRpes.every((r) => r === definedRpes[0])
    parts.push(sameRpe ? `@${definedRpes[0]}` : `@${Math.max(...definedRpes)} máx`)
  }

  return { volume, intensity: parts.join(' ') }
}

/** Una serie suelta, como se lee en la fila desplegada: `130×2 @8`. */
export function formatSet(set: GridSet): string {
  const load = set.weightKg !== null ? `${formatKg(set.weightKg)}×${set.reps}` : `${set.reps} reps`
  return set.rpe !== null ? `${load} @${set.rpe}` : load
}

/** El label que se repite en esa posición; `Día N` si no hay ninguno o no coinciden. */
function slotLabel(labels: string[], slotIndex: number): string {
  const named = labels.filter((l) => l.trim() !== '')
  if (named.length > 0 && named.every((l) => l === named[0])) return named[0]
  return `Día ${slotIndex + 1}`
}

export interface BlockGridInput {
  weeks: Week[]
  days: Day[]
  plannedExercises: PlannedExercise[]
  plannedSets: PlannedSet[]
  sessions: StrengthSession[]
  sessionExercises: SessionExercise[]
  executedSets: ExecutedSet[]
  exercises: Exercise[]
}

export function buildBlockGrid({
  weeks,
  days,
  plannedExercises,
  plannedSets,
  sessions,
  sessionExercises,
  executedSets,
  exercises,
}: BlockGridInput): BlockGrid {
  const orderedWeeks = [...weeks].sort((a, b) => a.order - b.order)

  // Los días de cada semana, ordenados por fecha: su posición es el "día N".
  const daysByWeek = new Map<string, Day[]>()
  for (const day of days) {
    if (day.weekId === null) continue
    const list = daysByWeek.get(day.weekId)
    if (list) list.push(day)
    else daysByWeek.set(day.weekId, [day])
  }
  for (const list of daysByWeek.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date))
  }

  const peByDay = new Map<string, PlannedExercise[]>()
  for (const pe of plannedExercises) {
    const list = peByDay.get(pe.dayId)
    if (list) list.push(pe)
    else peByDay.set(pe.dayId, [pe])
  }
  const setsByPe = new Map<string, PlannedSet[]>()
  for (const set of plannedSets) {
    const list = setsByPe.get(set.plannedExerciseId)
    if (list) list.push(set)
    else setsByPe.set(set.plannedExerciseId, [set])
  }
  const nameById = new Map(exercises.map((e) => [e.id, e.name]))

  // Lo realizado se alcanza por día: día → sesión → ejercicio de sesión → series.
  const sessionByDay = new Map(sessions.map((s) => [s.dayId, s.id]))
  const sessionExerciseKey = new Map<string, string>()
  for (const se of sessionExercises) {
    sessionExerciseKey.set(`${se.sessionId}:${se.exerciseId}`, se.id)
  }
  const executedBySessionExercise = new Map<string, ExecutedSet[]>()
  for (const set of executedSets) {
    const list = executedBySessionExercise.get(set.sessionExerciseId)
    if (list) list.push(set)
    else executedBySessionExercise.set(set.sessionExerciseId, [set])
  }

  const slotCount = Math.max(
    0,
    ...orderedWeeks.map((w) => (daysByWeek.get(w.id) ?? []).length),
  )

  const slots: GridDaySlot[] = []
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
    const slotDays = orderedWeeks.map((w) => (daysByWeek.get(w.id) ?? [])[slotIndex] ?? null)

    // Las filas son la unión de los ejercicios de esa posición en todas las
    // semanas: si una semana suma un accesorio, aparece con las demás celdas
    // vacías en vez de desaparecer del bloque.
    const firstOrder = new Map<string, number>()
    for (const day of slotDays) {
      if (!day) continue
      for (const pe of peByDay.get(day.id) ?? []) {
        const current = firstOrder.get(pe.exerciseId)
        if (current === undefined || pe.order < current) firstOrder.set(pe.exerciseId, pe.order)
      }
    }
    const exerciseIds = [...firstOrder.entries()]
      .sort((a, b) => {
        if (a[1] !== b[1]) return a[1] - b[1]
        return (nameById.get(a[0]) ?? '').localeCompare(nameById.get(b[0]) ?? '', 'es')
      })
      .map(([id]) => id)

    const rows: GridRow[] = exerciseIds.map((exerciseId) => ({
      exerciseId,
      exerciseName: nameById.get(exerciseId) ?? 'Ejercicio',
      cells: orderedWeeks.map((week, weekIndex) => {
        const day = slotDays[weekIndex]
        const pe = day
          ? (peByDay.get(day.id) ?? []).find((p) => p.exerciseId === exerciseId)
          : undefined
        const plannedRows = pe ? (setsByPe.get(pe.id) ?? []) : []
        const plannedSetList: GridSet[] = [...plannedRows]
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((s) => ({ weightKg: s.targetWeightKg, reps: s.targetReps, rpe: s.targetRpe }))

        const sessionId = day ? sessionByDay.get(day.id) : undefined
        const seId = sessionId
          ? sessionExerciseKey.get(`${sessionId}:${exerciseId}`)
          : undefined
        const executedList: GridSet[] = seId
          ? [...(executedBySessionExercise.get(seId) ?? [])]
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((s) => ({ weightKg: s.weightKg, reps: s.reps, rpe: s.rpe }))
          : []

        return {
          weekId: week.id,
          dayId: day?.id ?? null,
          plannedExerciseId: pe?.id ?? null,
          planned: summarizeSets(plannedSetList),
          plannedSets: plannedSetList,
          executedSets: executedList,
          executed: summarizeSets(executedList),
          setCount: plannedSetList.length,
        }
      }),
    }))

    slots.push({
      slotIndex,
      label: slotLabel(
        slotDays.map((d) => d?.label ?? ''),
        slotIndex,
      ),
      dates: slotDays.map((d) => d?.date ?? null),
      dayIds: slotDays.map((d) => d?.id ?? null),
      rows,
    })
  }

  return { weeks: orderedWeeks, slots }
}
