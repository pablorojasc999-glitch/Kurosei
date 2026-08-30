import { parseDateInput } from './calendarGrid'

export function formatRestMinutes(seconds: number): string {
  const minutes = seconds / 60
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Accepts either a full ISO instant (`createdAt`-style timestamps) or a bare
 * `YYYY-MM-DD` date key (e.g. a bitácora chart's domain date). A bare date
 * key passed straight to `new Date(...)` parses as UTC midnight, which
 * displays as the previous day in any timezone behind UTC — route it
 * through `parseDateInput` (local midnight) instead.
 */
export function formatDate(iso: string): string {
  const date = DATE_ONLY_PATTERN.test(iso) ? parseDateInput(iso) : new Date(iso)
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Same as `formatDate`, prefixed with the short weekday name (e.g. "sáb 29/08/2026") — used where knowing which day of the week a date falls on matters, like chart axis labels. */
export function formatDateWithWeekday(iso: string): string {
  const date = DATE_ONLY_PATTERN.test(iso) ? parseDateInput(iso) : new Date(iso)
  const weekday = date.toLocaleDateString('es-AR', { weekday: 'short' })
  return `${weekday} ${formatDate(iso)}`
}
