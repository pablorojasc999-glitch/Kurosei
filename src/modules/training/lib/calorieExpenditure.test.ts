import { describe, expect, it } from 'vitest'
import {
  bmrMifflinStJeor,
  calculateAge,
  estimateActiveMinutesFromSetCount,
  estimateCalorieExpenditure,
  estimateRestMinutesFromSetTimestamps,
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

describe('estimateActiveMinutesFromSetCount', () => {
  it('counts 45 active seconds per set, ignoring rest between sets', () => {
    expect(estimateActiveMinutesFromSetCount(8)).toBeCloseTo((8 * 45) / 60)
    expect(estimateActiveMinutesFromSetCount(0)).toBe(0)
  })
})

describe('estimateRestMinutesFromSetTimestamps', () => {
  it('sums the gaps between consecutive sets, regardless of input order', () => {
    const t0 = new Date(2026, 7, 22, 10, 0, 0)
    const t1 = new Date(t0.getTime() + 3 * 60_000) // +3 min
    const t2 = new Date(t0.getTime() + 8 * 60_000) // +5 min after t1
    const minutes = estimateRestMinutesFromSetTimestamps([
      t2.toISOString(),
      t0.toISOString(),
      t1.toISOString(),
    ])
    expect(minutes).toBeCloseTo(8)
  })

  it('caps a single gap at 8 minutes, so a real interruption is not counted as rest', () => {
    const t0 = new Date(2026, 7, 22, 10, 0, 0)
    const t1 = new Date(t0.getTime() + 40 * 60_000) // a 40-minute break
    const minutes = estimateRestMinutesFromSetTimestamps([t0.toISOString(), t1.toISOString()])
    expect(minutes).toBe(8)
  })

  it('is 0 for a single set or no sets', () => {
    expect(estimateRestMinutesFromSetTimestamps([])).toBe(0)
    expect(estimateRestMinutesFromSetTimestamps(['2026-08-22T10:00:00.000Z'])).toBe(0)
  })
})

describe('estimateStrengthSessionCalories', () => {
  it('combines active-set MET with rest-time MET from the sets timestamps', () => {
    const t0 = new Date(2026, 7, 22, 10, 0, 0)
    const t1 = new Date(t0.getTime() + 3 * 60_000)
    const calories = estimateStrengthSessionCalories({
      weightKg: 80,
      setCount: 2,
      setTimestamps: [t0.toISOString(), t1.toISOString()],
    })
    const activeCalories = 6 * 80 * (((2 * 45) / 60) / 60)
    const restCalories = 2 * 80 * (3 / 60)
    expect(calories).toBeCloseTo(activeCalories + restCalories)
  })

  it('is 0 with no sets', () => {
    expect(
      estimateStrengthSessionCalories({ weightKg: 80, setCount: 0, setTimestamps: [] }),
    ).toBe(0)
  })
})

describe('estimateCalorieExpenditure', () => {
  it('sums BMR, the strength session estimate, and logged cardio calories', () => {
    const targetDate = new Date(2026, 7, 22)
    const t0 = new Date(2026, 7, 22, 10, 0, 0)
    const t1 = new Date(t0.getTime() + 3 * 60_000)
    const strengthSetTimestamps = [t0.toISOString(), t1.toISOString()]
    const total = estimateCalorieExpenditure({
      heightCm: 175,
      birthDate: '1998-01-15',
      sex: 'male',
      weightKg: 80,
      targetDate,
      cardioCaloriesBurned: 300,
      strengthSetCount: 2,
      strengthSetTimestamps,
    })
    const expectedBmr = bmrMifflinStJeor({
      weightKg: 80,
      heightCm: 175,
      age: calculateAge('1998-01-15', targetDate),
      sex: 'male',
    })
    const expectedStrength = estimateStrengthSessionCalories({
      weightKg: 80,
      setCount: 2,
      setTimestamps: strengthSetTimestamps,
    })
    expect(total).toBeCloseTo(expectedBmr + expectedStrength + 300)
  })
})
