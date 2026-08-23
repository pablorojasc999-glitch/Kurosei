/**
 * Parses a `YYYY-MM-DD` value from an `<input type="date">` as local
 * midnight. `new Date('YYYY-MM-DD')` parses as UTC midnight instead, which
 * silently shifts to the previous calendar day in negative-UTC timezones.
 */
export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateKey(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, delta: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + delta)
  return d
}

function relativeDayPrefix(date: Date): string | null {
  const todayKey = startOfDay(new Date()).getTime()
  const dateKey = startOfDay(date).getTime()
  const diffDays = Math.round((dateKey - todayKey) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === -1) return 'Ayer'
  if (diffDays === 1) return 'Mañana'
  return null
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * The day-nav header split into two short lines instead of one long one, so
 * a narrow screen doesn't have to wrap or shrink the text to fit:
 * ["Hoy · Domingo", "23 de agosto"].
 */
export function formatDayHeaderLines(date: Date): [string, string] {
  const prefix = relativeDayPrefix(date)
  const weekday = capitalize(date.toLocaleDateString('es-AR', { weekday: 'long' }))
  // Built by hand rather than via `{ day: '2-digit', month: 'long' }` —
  // that combination's es-AR CLDR pattern drops the "de" connector
  // ("23-agosto"), unlike the combined weekday+day+month format below.
  const day = date.getDate().toString().padStart(2, '0')
  const month = date.toLocaleDateString('es-AR', { month: 'long' })
  const dateOnly = `${day} de ${month}`
  const topLine = prefix ? `${prefix} · ${weekday}` : weekday
  return [topLine, dateOnly]
}

/** "Hoy · Domingo, 23 de agosto" style header, relative to today for ±1 day. */
export function formatDayHeader(date: Date): string {
  const [topLine, dateOnly] = formatDayHeaderLines(date)
  return `${topLine}, ${dateOnly}`
}

/** Monday-first 6-week (42-day) grid covering the month plus lead/trail days. */
export function buildMonthGrid(monthStart: Date): Date[] {
  const jsWeekday = monthStart.getDay()
  const mondayOffset = (jsWeekday + 6) % 7
  const gridStart = new Date(monthStart)
  gridStart.setDate(gridStart.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return d
  })
}
