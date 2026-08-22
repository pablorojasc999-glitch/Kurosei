import { describe, expect, it } from 'vitest'
import { dayRange, inclusiveRange, isWithinRange } from './progressScope'

describe('dayRange', () => {
  it('covers the full local calendar day, exclusive of the next day', () => {
    const range = dayRange('2026-01-05')
    expect(isWithinRange(range.start, range)).toBe(true)
    expect(isWithinRange(range.end, range)).toBe(false)
  })
})

describe('inclusiveRange', () => {
  it('extends through the end of the endIso calendar day', () => {
    const range = inclusiveRange(
      '2026-01-01T00:00:00.000Z',
      '2026-01-05T00:00:00.000Z',
    )
    expect(isWithinRange('2026-01-01T00:00:00.000Z', range)).toBe(true)
    expect(isWithinRange('2026-01-05T23:00:00.000Z', range)).toBe(true)
    expect(isWithinRange('2026-01-06T00:00:00.000Z', range)).toBe(false)
  })
})

describe('isWithinRange', () => {
  it('is inclusive of start and exclusive of end', () => {
    const range = { start: '2026-01-01T00:00:00.000Z', end: '2026-01-02T00:00:00.000Z' }
    expect(isWithinRange('2025-12-31T23:59:59.000Z', range)).toBe(false)
    expect(isWithinRange('2026-01-01T00:00:00.000Z', range)).toBe(true)
    expect(isWithinRange('2026-01-01T12:00:00.000Z', range)).toBe(true)
    expect(isWithinRange('2026-01-02T00:00:00.000Z', range)).toBe(false)
  })
})
