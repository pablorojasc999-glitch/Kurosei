import { describe, expect, it } from 'vitest'
import {
  bmrMifflinStJeor,
  calculateAge,
  estimateCalorieExpenditure,
  estimateStrengthMinutesFromSetCount,
  estimateStrengthSessionCalories,
  strengthMetForDensity,
  strengthSessionMinutes,
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
  it('sin horas anotadas, escala con el número de series y el peso corporal', () => {
    const tenSets = estimateStrengthSessionCalories({ weightKg: 80, setCount: 10, loggedMinutes: null })
    expect(tenSets).toBeCloseTo(6 * 80 * (40 / 60))
    const fiveSets = estimateStrengthSessionCalories({ weightKg: 80, setCount: 5, loggedMinutes: null })
    expect(fiveSets).toBeCloseTo(tenSets / 2)
  })

  it('sin series no hay gasto', () => {
    expect(estimateStrengthSessionCalories({ weightKg: 80, setCount: 0, loggedMinutes: null })).toBe(0)
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
      strengthMinutes: null,
    })
    const expectedBmr = bmrMifflinStJeor({
      weightKg: 80,
      heightCm: 175,
      age: calculateAge('1998-01-15', targetDate),
      sex: 'male',
    })
    const expectedStrength = estimateStrengthSessionCalories({ weightKg: 80, setCount: 10, loggedMinutes: null })
    expect(total).toBeCloseTo(expectedBmr + expectedStrength + 300)
  })
})

describe('strengthMetForDensity', () => {
  it('una sesión densa cuenta como vigorosa', () => {
    // 20 series en 90 min = 13.3 series/hora.
    expect(strengthMetForDensity(20, 90)).toBe(6)
  })

  it('una sesión mayormente de descanso cuenta como moderada', () => {
    // 6 series en 90 min = 4 series/hora.
    expect(strengthMetForDensity(6, 90)).toBe(3.5)
  })

  it('en el medio interpola', () => {
    // 9 series/hora: justo a mitad de camino entre 6 y 12.
    expect(strengthMetForDensity(9, 60)).toBeCloseTo(4.75)
  })

  it('sin duración no se castiga: se asume vigorosa', () => {
    expect(strengthMetForDensity(10, 0)).toBe(6)
  })
})

describe('strengthSessionMinutes', () => {
  it('manda la duración real cuando existe', () => {
    expect(strengthSessionMinutes(10, 75)).toBe(75)
  })

  it('sin duración real cae a la estimación por series', () => {
    expect(strengthSessionMinutes(10, null)).toBe(40)
    expect(strengthSessionMinutes(10, 0)).toBe(40)
  })
})

describe('estimateStrengthSessionCalories con la duración real', () => {
  it('usa los minutos anotados en vez de estimarlos', () => {
    // 20 series en 90 min: densa, así que 6 MET sobre 1.5 h.
    const conHoras = estimateStrengthSessionCalories({ weightKg: 80, setCount: 20, loggedMinutes: 90 })
    expect(conHoras).toBeCloseTo(6 * 80 * 1.5)
  })

  it('quedarse de más entre series no infla el gasto sin límite', () => {
    // Las mismas 20 series, pero en el doble de tiempo: el MET baja, así que
    // el gasto sube menos que al doble.
    const denso = estimateStrengthSessionCalories({ weightKg: 80, setCount: 20, loggedMinutes: 90 })
    const lento = estimateStrengthSessionCalories({ weightKg: 80, setCount: 20, loggedMinutes: 180 })
    expect(lento).toBeGreaterThan(denso)
    expect(lento).toBeLessThan(denso * 2)
  })

  it('una sesión corta y densa no queda subestimada', () => {
    // 15 series en 45 min = 20 series/hora: vigorosa.
    expect(
      estimateStrengthSessionCalories({ weightKg: 80, setCount: 15, loggedMinutes: 45 }),
    ).toBeCloseTo(6 * 80 * 0.75)
  })

  it('sin series no hay gasto aunque haya horas anotadas', () => {
    expect(
      estimateStrengthSessionCalories({ weightKg: 80, setCount: 0, loggedMinutes: 90 }),
    ).toBe(0)
  })
})
