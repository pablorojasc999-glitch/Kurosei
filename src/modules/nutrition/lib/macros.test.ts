import { describe, expect, it } from 'vitest'
import { scaleMacros, sumMacros } from './macros'

describe('scaleMacros', () => {
  it('scales per-serving macros proportionally to the logged quantity', () => {
    const perServing = { calories: 95, proteinG: 0.5, carbsG: 23, fatG: 0.2, servingAmount: 166 }
    const result = scaleMacros(perServing, 83)
    expect(result).toEqual({ calories: 47.5, proteinG: 0.25, carbsG: 11.5, fatG: 0.1 })
  })

  it('returns zero macros when servingAmount is zero, instead of dividing by zero', () => {
    const perServing = { calories: 100, proteinG: 10, carbsG: 10, fatG: 10, servingAmount: 0 }
    expect(scaleMacros(perServing, 50)).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    })
  })
})

describe('sumMacros', () => {
  it('adds macros across a list of entries', () => {
    const total = sumMacros([
      { calories: 100, proteinG: 10, carbsG: 20, fatG: 5 },
      { calories: 50, proteinG: 5, carbsG: 5, fatG: 2 },
    ])
    expect(total).toEqual({ calories: 150, proteinG: 15, carbsG: 25, fatG: 7 })
  })

  it('returns all zeros for an empty list', () => {
    expect(sumMacros([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
})
