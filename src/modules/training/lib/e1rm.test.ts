import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateE1rm,
  placeholderE1rmFormula,
  rpeTableE1rmFormula,
  setE1rmFormula,
} from './e1rm'

describe('e1rm', () => {
  beforeEach(() => {
    setE1rmFormula(placeholderE1rmFormula)
  })

  it('returns the weight itself for a single rep', () => {
    expect(calculateE1rm({ weightKg: 140, reps: 1 })).toBe(140)
  })

  it('estimates above the lifted weight for multiple reps', () => {
    const result = calculateE1rm({ weightKg: 100, reps: 5 })
    expect(result).toBeGreaterThan(100)
  })

  it('is fully replaceable without touching call sites', () => {
    setE1rmFormula(() => 999)
    expect(calculateE1rm({ weightKg: 1, reps: 1 })).toBe(999)
  })
})

describe('rpeTableE1rmFormula', () => {
  it('divides by 1 at RPE 10 for a single rep (the table anchor)', () => {
    expect(rpeTableE1rmFormula({ weightKg: 100, reps: 1, rpe: 10 })).toBe(100)
  })

  it('looks up the %1RM cell for a known RPE/reps pair', () => {
    // RPE 8, 5 reps -> 0.8439 in the user's table
    const result = rpeTableE1rmFormula({ weightKg: 100, reps: 5, rpe: 8 })
    expect(result).toBeCloseTo(100 / 0.8439, 4)
  })

  it('rounds a fractional RPE to the nearest 0.5 step', () => {
    const result = rpeTableE1rmFormula({ weightKg: 100, reps: 5, rpe: 8.3 })
    expect(result).toBeCloseTo(100 / 0.858, 4) // rounds to RPE 8.5
  })

  it('clamps an out-of-range RPE to the table bounds', () => {
    const belowTable = rpeTableE1rmFormula({ weightKg: 100, reps: 3, rpe: 0 })
    const atOne = rpeTableE1rmFormula({ weightKg: 100, reps: 3, rpe: 1 })
    expect(belowTable).toBe(atOne)

    const aboveTable = rpeTableE1rmFormula({ weightKg: 100, reps: 3, rpe: 12 })
    const atTen = rpeTableE1rmFormula({ weightKg: 100, reps: 3, rpe: 10 })
    expect(aboveTable).toBe(atTen)
  })

  it('falls back to the Epley placeholder when no RPE was logged', () => {
    const result = rpeTableE1rmFormula({ weightKg: 100, reps: 5 })
    expect(result).toBe(placeholderE1rmFormula({ weightKg: 100, reps: 5 }))
  })

  it('falls back to the Epley placeholder past the table\'s 15-rep column', () => {
    const result = rpeTableE1rmFormula({ weightKg: 100, reps: 16, rpe: 10 })
    expect(result).toBe(placeholderE1rmFormula({ weightKg: 100, reps: 16 }))
  })

  it('returns 0 for a non-positive rep count', () => {
    expect(rpeTableE1rmFormula({ weightKg: 100, reps: 0, rpe: 10 })).toBe(0)
  })

  it('is the default active formula used by calculateE1rm', () => {
    setE1rmFormula(rpeTableE1rmFormula)
    expect(calculateE1rm({ weightKg: 100, reps: 1, rpe: 10 })).toBe(100)
  })
})
