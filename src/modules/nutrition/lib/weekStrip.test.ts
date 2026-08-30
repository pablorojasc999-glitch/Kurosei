import { describe, expect, it } from 'vitest'
import { toDateKey } from '../../training/lib/calendarGrid'
import { startOfWeek, weekDates } from './weekStrip'

describe('startOfWeek', () => {
  it('returns the same Monday when given a Monday', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 7, 24)))).toBe('2026-08-24') // a Monday
  })

  it('returns the prior Monday for a mid-week date', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 7, 28)))).toBe('2026-08-24') // Friday -> Monday
  })

  it('returns the prior Monday for a Sunday', () => {
    expect(toDateKey(startOfWeek(new Date(2026, 7, 30)))).toBe('2026-08-24') // Sunday -> Monday
  })
})

describe('weekDates', () => {
  it('returns 7 consecutive dates starting on Monday', () => {
    const dates = weekDates(new Date(2026, 7, 28))
    expect(dates.map(toDateKey)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ])
  })
})
