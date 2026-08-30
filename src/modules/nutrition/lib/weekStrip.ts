import { addDays, startOfDay } from '../../training/lib/calendarGrid'

export const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Monday of the week containing `date` — the strip is always Monday-start, matching the L M M J V S D labels. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date)
  const jsDay = start.getDay() // 0=Sun..6=Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  return addDays(start, mondayOffset)
}

/** The 7 dates (Monday..Sunday) of the week containing `date`. */
export function weekDates(date: Date): Date[] {
  const monday = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
