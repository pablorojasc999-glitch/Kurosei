import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  buildMonthGrid,
  formatDayHeader,
  formatDayHeaderLines,
  parseDateInput,
  startOfDay,
  startOfMonth,
  toDateKey,
} from './calendarGrid'

describe('toDateKey', () => {
  it('formats as zero-padded YYYY-MM-DD regardless of locale', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('startOfMonth / addMonths', () => {
  it('normalizes to the 1st of the month', () => {
    expect(startOfMonth(new Date(2026, 7, 22)).getDate()).toBe(1)
  })

  it('shifts months and wraps across year boundaries', () => {
    const dec2026 = startOfMonth(new Date(2026, 11, 1))
    const jan2027 = addMonths(dec2026, 1)
    expect(jan2027.getFullYear()).toBe(2027)
    expect(jan2027.getMonth()).toBe(0)

    const nov2026 = addMonths(dec2026, -1)
    expect(nov2026.getFullYear()).toBe(2026)
    expect(nov2026.getMonth()).toBe(10)
  })
})

describe('startOfDay / addDays', () => {
  it('strips the time of day', () => {
    const d = startOfDay(new Date(2026, 7, 22, 23, 59, 59))
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0])
  })

  it('shifts days and wraps across month boundaries', () => {
    const aug31 = startOfDay(new Date(2026, 7, 31))
    const sep1 = addDays(aug31, 1)
    expect(sep1.getMonth()).toBe(8)
    expect(sep1.getDate()).toBe(1)

    const back = addDays(sep1, -1)
    expect(back.getMonth()).toBe(7)
    expect(back.getDate()).toBe(31)
  })
})

describe('parseDateInput', () => {
  it('parses a YYYY-MM-DD value as local midnight, not UTC midnight', () => {
    const d = parseDateInput('2026-08-22')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 22])
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0])
  })

  it('round-trips through toDateKey', () => {
    expect(toDateKey(parseDateInput('2026-01-05'))).toBe('2026-01-05')
  })
})

describe('formatDayHeader', () => {
  it('labels today, yesterday and tomorrow relative to now', () => {
    const today = startOfDay(new Date())
    expect(formatDayHeader(today)).toMatch(/^Hoy · /)
    expect(formatDayHeader(addDays(today, -1))).toMatch(/^Ayer · /)
    expect(formatDayHeader(addDays(today, 1))).toMatch(/^Mañana · /)
  })

  it('falls back to a plain weekday/date label further out', () => {
    const today = startOfDay(new Date())
    const label = formatDayHeader(addDays(today, 10))
    expect(label).not.toMatch(/^(Hoy|Ayer|Mañana) ·/)
  })
})

describe('formatDayHeaderLines', () => {
  it('splits into a relative+weekday top line and a day/month bottom line', () => {
    const today = startOfDay(new Date())
    const [top, bottom] = formatDayHeaderLines(today)
    expect(top).toMatch(/^Hoy · /)
    expect(bottom).not.toMatch(/Hoy|Ayer|Mañana/)
  })

  it('joins back into the same string formatDayHeader produces', () => {
    const today = startOfDay(new Date())
    const [top, bottom] = formatDayHeaderLines(today)
    expect(`${top}, ${bottom}`).toBe(formatDayHeader(today))
  })

  it('has no relative prefix on the top line further out', () => {
    const today = startOfDay(new Date())
    const [top] = formatDayHeaderLines(addDays(today, 10))
    expect(top).not.toMatch(/^(Hoy|Ayer|Mañana) ·/)
  })
})

describe('buildMonthGrid', () => {
  it('tiene sólo las semanas que el mes ocupa, no seis siempre', () => {
    // Septiembre de 2026 cabe en cinco: una sexta fila serían siete días de
    // octubre ocupando pantalla para no decir nada.
    expect(buildMonthGrid(startOfMonth(new Date(2026, 8, 1)))).toHaveLength(35)
  })

  it('usa seis semanas cuando el mes de verdad las cruza', () => {
    // Marzo de 2026 empieza en domingo y tiene 31 días: no cabe en cinco.
    expect(buildMonthGrid(startOfMonth(new Date(2026, 2, 1)))).toHaveLength(42)
  })

  it('usa cuatro cuando el mes encaja justo en la semana', () => {
    // Febrero de 2027: empieza lunes y tiene 28 días, exactamente cuatro semanas.
    expect(buildMonthGrid(startOfMonth(new Date(2027, 1, 1)))).toHaveLength(28)
  })

  it('empieza siempre en el primer lunes que cubre el mes', () => {
    const grid = buildMonthGrid(startOfMonth(new Date(2026, 8, 1)))
    expect(grid[0].getDay()).toBe(1)
    expect(toDateKey(grid[0])).toBe('2026-08-31')
  })

  it('termina el domingo que cierra la última semana del mes', () => {
    const grid = buildMonthGrid(startOfMonth(new Date(2026, 8, 1)))
    expect(grid[grid.length - 1].getDay()).toBe(0)
    expect(toDateKey(grid[grid.length - 1])).toBe('2026-10-04')
  })

  it('starts on a Monday', () => {
    const grid = buildMonthGrid(startOfMonth(new Date(2026, 7, 1)))
    expect(grid[0].getDay()).toBe(1)
  })

  it('includes every day of the target month', () => {
    const monthStart = startOfMonth(new Date(2026, 1, 1)) // Feb 2026, 28 days
    const grid = buildMonthGrid(monthStart)
    const daysInMonth = grid.filter((d) => d.getMonth() === 1)
    expect(daysInMonth).toHaveLength(28)
  })
})
