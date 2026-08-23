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

/** "Hoy · Domingo 23 de agosto" style header, relative to today for ±1 day. */
export function formatDayHeader(date: Date): string {
  const todayKey = startOfDay(new Date()).getTime()
  const dateKey = startOfDay(date).getTime()
  const diffDays = Math.round((dateKey - todayKey) / (24 * 60 * 60 * 1000))

  const rawDateLabel = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const dateLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1)

  if (diffDays === 0) return `Hoy · ${dateLabel}`
  if (diffDays === -1) return `Ayer · ${dateLabel}`
  if (diffDays === 1) return `Mañana · ${dateLabel}`
  return dateLabel
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
