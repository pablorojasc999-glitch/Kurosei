import type { Week } from '../domain/types'
import { addDays, parseDateInput, toDateKey } from './calendarGrid'

/**
 * Las semanas son independientes: cada una trae su rango y se ordenan por
 * cuándo empiezan, no por un número dentro de un mesociclo.
 *
 * `order` sólo desempata dos semanas que empiezan el mismo día.
 */
export function compareWeeks(a: Week, b: Week): number {
  const byStart = a.startDate.slice(0, 10).localeCompare(b.startDate.slice(0, 10))
  return byStart !== 0 ? byStart : a.order - b.order
}

/** Si una fecha (`YYYY-MM-DD`) cae dentro del rango de la semana, extremos incluidos. */
export function weekContains(week: Week, dateKey: string): boolean {
  return dateKey >= week.startDate.slice(0, 10) && dateKey <= week.endDate.slice(0, 10)
}

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function shortDate(dateKey: string): string {
  const date = parseDateInput(dateKey)
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`
}

/** `19 oct – 25 oct`, el nombre con que se reconoce una semana. */
export function formatWeekRange(week: Pick<Week, 'startDate' | 'endDate'>): string {
  return `${shortDate(week.startDate.slice(0, 10))} – ${shortDate(week.endDate.slice(0, 10))}`
}

/**
 * El rango que se propone al crear una semana: arranca el día siguiente a la
 * última que ya existe (o hoy, si no hay ninguna) y dura siete días. Es sólo
 * una sugerencia; la semana puede empezar y terminar cuando haga falta.
 */
export function suggestNextWeekRange(
  weeks: Week[],
  today: Date,
): { startDate: string; endDate: string } {
  const last = [...weeks].sort(compareWeeks).at(-1)
  const start = last ? addDays(parseDateInput(last.endDate.slice(0, 10)), 1) : today
  return { startDate: toDateKey(start), endDate: toDateKey(addDays(start, 6)) }
}

/** Un rango válido termina el mismo día que empieza o después. */
export function isValidWeekRange(startDate: string, endDate: string): boolean {
  return startDate !== '' && endDate !== '' && endDate >= startDate
}

/**
 * Qué fecha proponer al agregar un día a una semana: el día siguiente al último
 * que ya tiene, sin pasarse del final; si todavía no tiene ninguno, el primero.
 */
export function suggestNextDayDate(week: Pick<Week, 'startDate' | 'endDate'>, dayDates: string[]): string {
  const start = week.startDate.slice(0, 10)
  const end = week.endDate.slice(0, 10)
  const last = [...dayDates].map((d) => d.slice(0, 10)).sort().at(-1)
  if (!last) return start
  const next = toDateKey(addDays(parseDateInput(last), 1))
  return next > end ? end : next < start ? start : next
}

/** La semana que está en curso hoy, si hay alguna (extremos incluidos). */
export function isCurrentWeek(week: Week, todayKey: string): boolean {
  return weekContains(week, todayKey)
}

/**
 * La posición de un mesociclo dentro de su macrociclo, que es lo que decide su
 * color en el calendario; la pastilla de una semana usa la misma para que el
 * color signifique lo mismo en las dos vistas.
 */
export function mesocycleIndexInMacro(
  mesocycle: { id: string; macrocycleId: string },
  all: Array<{ id: string; macrocycleId: string; order: number }>,
): number {
  return all
    .filter((m) => m.macrocycleId === mesocycle.macrocycleId)
    .sort((a, b) => a.order - b.order)
    .findIndex((m) => m.id === mesocycle.id)
}
