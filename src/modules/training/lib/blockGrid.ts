import type { Day, Exercise, PlannedExercise, PlannedSet, Week } from '../domain/types'

/**
 * La planilla del bloque: una fila por ejercicio, una columna por semana, y
 * los ejercicios agrupados por el día en que caen.
 *
 * El "día 1" es posicional, no el lunes: dentro de cada semana los días se
 * ordenan por fecha y esa posición es la que empareja las columnas. Así el
 * primer día de todas las semanas queda en la misma fila aunque las fechas no
 * coincidan en día de la semana.
 */

export interface GridCell {
  weekId: string
  /** El día de esa semana en esta posición; `null` si la semana no llega a tener ese día. */
  dayId: string | null
  /** El ejercicio planificado en esa celda; `null` si esa semana no lo tiene. */
  plannedExerciseId: string | null
  /** `5×3`, o `5/5/3` cuando las series no son iguales. Vacío si no hay series. */
  volume: string
  /** `140 kg`, `@8`, `140 kg @8`. Vacío si no hay ni peso ni RPE. */
  intensity: string
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
 * Resume las series de un ejercicio en las dos líneas que se leen de un
 * vistazo: cuánto volumen y a qué intensidad.
 */
export function summarizeSets(sets: PlannedSet[]): { volume: string; intensity: string } {
  if (sets.length === 0) return { volume: '', intensity: '' }
  const ordered = [...sets].sort((a, b) => a.setNumber - b.setNumber)

  const reps = ordered.map((s) => s.targetReps)
  const sameReps = reps.every((r) => r === reps[0])
  const volume = sameReps ? `${ordered.length}×${reps[0]}` : reps.join('/')

  const weights = ordered.map((s) => s.targetWeightKg)
  const rpes = ordered.map((s) => s.targetRpe)
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

/** El label que se repite en esa posición; `Día N` si no hay ninguno o no coinciden. */
function slotLabel(labels: string[], slotIndex: number): string {
  const named = labels.filter((l) => l.trim() !== '')
  if (named.length > 0 && named.every((l) => l === named[0])) return named[0]
  return `Día ${slotIndex + 1}`
}

export function buildBlockGrid(
  weeks: Week[],
  days: Day[],
  plannedExercises: PlannedExercise[],
  plannedSets: PlannedSet[],
  exercises: Exercise[],
): BlockGrid {
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
        const sets = pe ? (setsByPe.get(pe.id) ?? []) : []
        const { volume, intensity } = summarizeSets(sets)
        return {
          weekId: week.id,
          dayId: day?.id ?? null,
          plannedExerciseId: pe?.id ?? null,
          volume,
          intensity,
          setCount: sets.length,
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
