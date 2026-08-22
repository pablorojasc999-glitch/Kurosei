import { describe, expect, it } from 'vitest'
import {
  bmrMifflinStJeor,
  calculateAge,
  estimateCalorieExpenditure,
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

describe('estimateStrengthSessionCalories', () => {
  it('scales linearly with duration and body weight', () => {
    const oneHour = estimateStrengthSessionCalories({ weightKg: 80, durationMinutes: 60 })
    expect(oneHour).toBeCloseTo(6 * 80)
    const halfHour = estimateStrengthSessionCalories({ weightKg: 80, durationMinutes: 30 })
    expect(halfHour).toBeCloseTo(oneHour / 2)
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
      strengthSessionDurationMinutes: 60,
    })
    const expectedBmr = bmrMifflinStJeor({
      weightKg: 80,
      heightCm: 175,
      age: calculateAge('1998-01-15', targetDate),
      sex: 'male',
    })
    const expectedStrength = estimateStrengthSessionCalories({
      weightKg: 80,
      durationMinutes: 60,
    })
    expect(total).toBeCloseTo(expectedBmr + expectedStrength + 300)
  })
})
