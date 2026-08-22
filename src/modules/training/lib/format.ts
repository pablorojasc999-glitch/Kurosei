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
