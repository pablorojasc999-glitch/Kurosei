import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  buildMonthGrid,
  formatDayHeader,
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

describe('buildMonthGrid', () => {
  it('always returns 42 days (6 Monday-first weeks)', () => {
    const grid = buildMonthGrid(startOfMonth(new Date(2026, 1, 1)))
    expect(grid).toHaveLength(42)
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
