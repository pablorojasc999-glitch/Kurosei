import { describe, expect, it } from 'vitest'
import {
  bmrMifflinStJeor,
  calculateAge,
  estimateCalorieExpenditure,
  estimateStrengthMinutesFromSetCount,
  estimateStrengthSessionCalories,
} from './calorieExpenditure'

describe('calculateAge', () => {
  it('counts a full year once the birthday already passed this year', () => {
    expect(calculateAge('1998-01-15', new Date(2026, 7, 22))).toBe(28)
  })

  it('does not count this year until the birthday happens', () => {
    expect(calculateAge('1998-12-15', new Date(2026, 7, 22))).toBe(27)
  })

  it('counts the birthday itself as the new age', () => {
    expect(calculateAge('1998-08-22', new Date(2026, 7, 22))).toBe(28)
  })
})

describe('bmrMifflinStJeor', () => {
  it('adds 5 for men', () => {
    const bmr = bmrMifflinStJeor({ weightKg: 80, heightCm: 175, age: 28, sex: 'male' })
    expect(bmr).toBeCloseTo(10 * 80 + 6.25 * 175 - 5 * 28 + 5)
  })

  it('subtracts 161 for women', () => {
    const bmr = bmrMifflinStJeor({ weightKg: 65, heightCm: 165, age: 28, sex: 'female' })
    expect(bmr).toBeCloseTo(10 * 65 + 6.25 * 165 - 5 * 28 - 161)
  })
})

describe('estimateStrengthMinutesFromSetCount', () => {
  it('counts 4 minutes per set, regardless of when each set was logged', () => {
    expect(estimateStrengthMinutesFromSetCount(10)).toBe(40)
    expect(estimateStrengthMinutesFromSetCount(0)).toBe(0)
  })
})

describe('estimateStrengthSessionCalories', () => {
  it('scales linearly with set count and body weight', () => {
    const tenSets = estimateStrengthSessionCalories({ weightKg: 80, setCount: 10 })
    expect(tenSets).toBeCloseTo(6 * 80 * (40 / 60))
    const fiveSets = estimateStrengthSessionCalories({ weightKg: 80, setCount: 5 })
    expect(fiveSets).toBeCloseTo(tenSets / 2)
  })

  it('is 0 with no sets', () => {
    expect(estimateStrengthSessionCalories({ weightKg: 80, setCount: 0 })).toBe(0)
  })
})

describe('estimateCalorieExpenditure', () => {
  it('sums BMR, the strength session estimate, and logged cardio calories', () => {
    const targetDate = new Date(2026, 7, 22)
    const total = estimateCalorieExpenditure({
      heightCm: 175,
      birthDate: '1998-01-15',
      sex: 'male',
      weightKg: 80,
      targetDate,
      cardioCaloriesBurned: 300,
      strengthSetCount: 10,
    })
    const expectedBmr = bmrMifflinStJeor({
      weightKg: 80,
      heightCm: 175,
      age: calculateAge('1998-01-15', targetDate),
      sex: 'male',
    })
    const expectedStrength = estimateStrengthSessionCalories({ weightKg: 80, setCount: 10 })
    expect(total).toBeCloseTo(expectedBmr + expectedStrength + 300)
  })
})
