import { describe, expect, it } from 'vitest'
import { formatNutrient, scaleNutrientProfile } from './nutrients'

const BASE = {
  servingAmount: 166,
  calories: 95,
  proteinG: 0.5,
  carbsG: 23,
  fatG: 0.2,
  saturatedFatG: null,
  transFatG: null,
  fiberG: 4,
  sugarG: 18,
  sodiumMg: null,
  cholesterolMg: null,
  potassiumMg: null,
  calciumMg: null,
  ironMg: null,
  magnesiumMg: null,
  zincMg: null,
  vitaminAMcg: null,
  vitaminCMg: 8,
  vitaminDMcg: null,
  vitaminEMg: null,
  vitaminKMcg: null,
  vitaminB1Mg: null,
  vitaminB2Mg: null,
  vitaminB3Mg: null,
  vitaminB6Mg: null,
  vitaminB9Mcg: null,
  vitaminB12Mcg: null,
}

describe('scaleNutrientProfile', () => {
  it('scales macros and non-null micronutrients proportionally', () => {
    const scaled = scaleNutrientProfile(BASE, 83)
    expect(scaled.calories).toBeCloseTo(47.5)
    expect(scaled.carbsG).toBeCloseTo(11.5)
    expect(scaled.fiberG).toBeCloseTo(2)
    expect(scaled.vitaminCMg).toBeCloseTo(4)
  })

  it('leaves unset micronutrients as null instead of 0', () => {
    const scaled = scaleNutrientProfile(BASE, 83)
    expect(scaled.sodiumMg).toBeNull()
    expect(scaled.vitaminDMcg).toBeNull()
  })

  it('returns zeros instead of dividing by zero when servingAmount is 0', () => {
    const scaled = scaleNutrientProfile({ ...BASE, servingAmount: 0 }, 50)
    expect(scaled.calories).toBe(0)
    expect(scaled.fiberG).toBe(0)
  })
})

describe('formatNutrient', () => {
  it('always shows exactly one decimal', () => {
    expect(formatNutrient(47.5)).toBe('47.5')
    expect(formatNutrient(0)).toBe('0.0')
    expect(formatNutrient(11.456)).toBe('11.5')
  })
})
