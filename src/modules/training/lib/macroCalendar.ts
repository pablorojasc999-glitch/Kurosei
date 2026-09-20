import type { Day, Macrocycle, Mesocycle, StrengthSession } from '../domain/types'
import { addDays, parseDateInput, startOfDay, toDateKey } from './calendarGrid'

/**
 * La vista de un macrociclo entero: una columna por semana de calendario y una
 * fila por día de la semana, de lunes a domingo.
 *
 * Se arma desde las fechas reales de los días planificados, no desde las
 * semanas: `Week` sólo guarda su orden dentro del mesociclo, así que una semana
 * sin días no tendría fecha con la que ubicarse. Los mesociclos sí traen rango,
 * y eso es lo que colorea cada columna.
 */

/** Lunes a domingo, que es como se lee un plan de entrenamiento. */
export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Lo que dice el puntito de un día, del hecho más fuerte al más débil:
 *
 * - `done`: se entrenó, haya quedado el plan cerrado o no. Entrenar es el
 *   hecho más fuerte que puede tener un día, así que gana sobre el resto.
 * - `planned`: el plan quedó cerrado y todavía no se entrena.
 * - `draft`: hay día, pero el plan sigue abierto: falta terminar de armarlo.
 * - `empty`: no hay día planificado.
 */
export type CellState = 'done' | 'planned' | 'draft' | 'empty'

export interface CalendarCell {
  /** `YYYY-MM-DD`. */
  date: string
  dayOfMonth: number
  /** Fuera del rango del macrociclo: se pinta apagado. */
  outside: boolean
  isToday: boolean
  /** El día planificado que cae acá, si lo hay. */
  dayId: string | null
  /** `D1`, `D2`… según el orden del día dentro de su semana. Null si no hay plan. */
  slot: string | null
  state: CellState
}

export interface CalendarWeek {
  /** El lunes de la semana, `YYYY-MM-DD`. */
  start: string
  /** Número de semana dentro del macrociclo, desde 1. */
  number: number
  /** Índice del mesociclo que manda en esta semana, o -1 si ninguno. */
  mesocycleIndex: number
  /** Abreviatura del mes cuando la semana estrena mes; si no, null. */
  monthLabel: string | null
  containsToday: boolean
  /**
   * Verde si se hizo todo lo planificado, blanco si a algún día le falta
   * terminar de planificarse, ámbar si queda algo por entrenar, gris si la
   * semana no tenía nada planificado. Mismo criterio que el punto de cada día,
   * para que el color signifique lo mismo en toda la vista.
   */
  state: CellState
  cells: CalendarCell[]
}

export interface MesocycleSummary {
  id: string
  name: string
  index: number
  /** Estado de cada una de sus semanas, para los puntitos de la tira de abajo. */
  weekStates: CellState[]
}

export interface MacroCalendar {
  weeks: CalendarWeek[]
  mesocycles: MesocycleSummary[]
}

export interface MacroCalendarInput {
  macrocycle: Macrocycle
  mesocycles: Mesocycle[]
  days: Day[]
  sessions: StrengthSession[]
  today: Date
}

/** El lunes de la semana en que cae una fecha. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  // getDay() da 0 para domingo; acá la semana empieza el lunes.
  const shift = (day.getDay() + 6) % 7
  return addDays(day, -shift)
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export function buildMacroCalendar(input: MacroCalendarInput): MacroCalendar {
  const { macrocycle, mesocycles, days, sessions, today } = input

  const macroStart = startOfDay(parseDateInput(macrocycle.startDate.slice(0, 10)))
  const macroEnd = startOfDay(parseDateInput(macrocycle.endDate.slice(0, 10)))
  const todayKey = toDateKey(startOfDay(today))

  const ordered = [...mesocycles].sort((a, b) => a.order - b.order)
  const mesoRanges = ordered.map((m) => ({
    id: m.id,
    name: m.name,
    from: m.startDate.slice(0, 10),
    to: m.endDate.slice(0, 10),
  }))
  const mesoIndexOf = (dateKey: string) =>
    mesoRanges.findIndex((m) => dateKey >= m.from && dateKey <= m.to)

  // Un día planificado por fecha. Si hubiera dos, gana el primero: la vista no
  // es el lugar para resolver un duplicado, sólo para no romperse con él.
  const dayByDate = new Map<string, Day>()
  for (const day of days) {
    const key = day.date.slice(0, 10)
    if (!dayByDate.has(key)) dayByDate.set(key, day)
  }
  const finishedDayIds = new Set(
    sessions.filter((s) => s.endedAt !== null).map((s) => s.dayId),
  )

  const weeks: CalendarWeek[] = []
  let cursor = startOfWeek(macroStart)
  const lastWeekStart = startOfWeek(macroEnd)
  let seenMonth = ''
  let number = 1

  while (cursor <= lastWeekStart) {
    const cells: CalendarCell[] = []
    let plannedInWeek = 0
    let doneInWeek = 0
    let draftInWeek = 0
    let containsToday = false

    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i)
      const key = toDateKey(date)
      const outside = key < toDateKey(macroStart) || key > toDateKey(macroEnd)
      const day = outside ? undefined : dayByDate.get(key)
      const isToday = key === todayKey
      if (isToday) containsToday = true

      let slot: string | null = null
      let state: CellState = 'empty'
      if (day) {
        plannedInWeek += 1
        slot = `D${plannedInWeek}`
        if (finishedDayIds.has(day.id)) {
          state = 'done'
          doneInWeek += 1
        } else if (day.planClosedAt === null) {
          state = 'draft'
          draftInWeek += 1
        } else {
          state = 'planned'
        }
      }

      cells.push({
        date: key,
        dayOfMonth: date.getDate(),
        outside,
        isToday,
        dayId: day?.id ?? null,
        slot,
        state,
      })
    }

    // El mes se marca sólo cuando cambia, para no repetirlo en cada columna.
    const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`
    const monthLabel = monthKey === seenMonth ? null : MONTHS[cursor.getMonth()]
    seenMonth = monthKey

    weeks.push({
      start: toDateKey(cursor),
      number,
      mesocycleIndex: mesoIndexOf(toDateKey(cursor)),
      monthLabel,
      containsToday,
      state:
        plannedInWeek === 0
          ? 'empty'
          : doneInWeek === plannedInWeek
            ? 'done'
            : draftInWeek > 0
              ? 'draft'
              : 'planned',
      cells,
    })

    cursor = addDays(cursor, 7)
    number += 1
  }

  const mesocycleSummaries: MesocycleSummary[] = mesoRanges.map((m, index) => ({
    id: m.id,
    name: m.name,
    index,
    weekStates: weeks.filter((w) => w.mesocycleIndex === index).map((w) => w.state),
  }))

  return { weeks, mesocycles: mesocycleSummaries }
}
