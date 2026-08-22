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
