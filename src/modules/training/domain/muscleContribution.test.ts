import { describe, expect, it } from 'vitest'
import { validateMuscleContributions } from './muscleContribution'

describe('validateMuscleContributions', () => {
  it('accepts strength contributions with any positive factors (no sum requirement)', () => {
    const result = validateMuscleContributions('strength', [
      { muscleGroupId: 'cuadriceps', factor: 1 },
      { muscleGroupId: 'gluteos', factor: 1 },
      { muscleGroupId: 'isquios', factor: 0.5 },
    ])
    expect(result.valid).toBe(true)
  })

  it('rejects a contribution with a zero or negative factor', () => {
    const result = validateMuscleContributions('strength', [
      { muscleGroupId: 'cuadriceps', factor: 1 },
      { muscleGroupId: 'gluteos', factor: 0 },
    ])
    expect(result.valid).toBe(false)
  })

  it('rejects a strength exercise with no muscle groups', () => {
    const result = validateMuscleContributions('strength', [])
    expect(result.valid).toBe(false)
  })

  it('does not require muscle contributions for cardio exercises', () => {
    const result = validateMuscleContributions('cardio', [])
    expect(result.valid).toBe(true)
  })
})
