import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatTimeRange,
  minutesToTimeInput,
  roundToStep,
  timeInputToMinutes,
} from './time'

describe('minutesToTimeInput / timeInputToMinutes', () => {
  it('round-trips a normal time of day', () => {
    expect(minutesToTimeInput(90)).toBe('01:30')
    expect(timeInputToMinutes('01:30')).toBe(90)
  })

  it('clamps out-of-range minutes into a single day', () => {
    expect(minutesToTimeInput(-10)).toBe('00:00')
    expect(minutesToTimeInput(1500)).toBe('23:59')
  })

  it('rejects a malformed time string', () => {
    expect(timeInputToMinutes('not-a-time')).toBeNull()
    expect(timeInputToMinutes('25:00')).toBeNull()
  })
})

describe('formatTimeRange', () => {
  it('formats a same-day range normally', () => {
    expect(formatTimeRange(9 * 60, 10 * 60 + 30)).toBe('09:00 – 10:30')
  })

  it('wraps an overnight endMinutes past 1440 back to a time of day', () => {
    // 22:00 -> 06:00 the next day, stored as startMinutes=1320, endMinutes=1800
    expect(formatTimeRange(22 * 60, 24 * 60 + 6 * 60)).toBe('22:00 – 06:00')
  })
})

describe('formatDuration', () => {
  it('formats minutes-only durations under an hour', () => {
    expect(formatDuration(30)).toBe('30 min')
  })

  it('formats whole-hour durations without a minutes part', () => {
    expect(formatDuration(120)).toBe('2 h')
  })

  it('formats mixed hour-and-minute durations', () => {
    expect(formatDuration(90)).toBe('1 h 30 min')
  })

  it('formats an overnight-length duration past 24h worth of minutes', () => {
    expect(formatDuration(8 * 60)).toBe('8 h')
  })
})

describe('roundToStep', () => {
  it('rounds to the nearest 15-minute step by default', () => {
    expect(roundToStep(7)).toBe(0)
    expect(roundToStep(8)).toBe(15)
    expect(roundToStep(52)).toBe(45)
  })

  it('accepts a custom step', () => {
    expect(roundToStep(40, 30)).toBe(30)
    expect(roundToStep(50, 30)).toBe(60)
  })
})
