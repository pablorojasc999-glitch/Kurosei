import { addDays, parseDateInput } from './calendarGrid'

export type ScopeKind = 'macro' | 'meso' | 'week' | 'day'

export interface DateRange {
  start: string
  end: string
}

/** Range covering the single calendar day named by a `YYYY-MM-DD` value. */
export function dayRange(dateInput: string): DateRange {
  const start = parseDateInput(dateInput)
  return { start: start.toISOString(), end: addDays(start, 1).toISOString() }
}

/**
 * Inclusive-start, inclusive-end (through end of day) range spanning two
 * ISO instants — used for macro/meso/week scopes, whose stored `endDate`
 * marks the start of the last day rather than its end.
 */
export function inclusiveRange(startIso: string, endIso: string): DateRange {
  return { start: startIso, end: addDays(new Date(endIso), 1).toISOString() }
}

export function isWithinRange(iso: string, range: DateRange): boolean {
  return iso >= range.start && iso < range.end
}
