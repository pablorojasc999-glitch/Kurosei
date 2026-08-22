import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateE1rm,
  placeholderE1rmFormula,
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
