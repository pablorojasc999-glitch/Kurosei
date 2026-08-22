import { describe, expect, it } from 'vitest'
import { validateMuscleContributions } from './muscleContribution'

describe('validateMuscleContributions', () => {
  it('accepts strength contributions that sum to 100%', () => {
    const result = validateMuscleContributions('strength', [
      { muscleGroupId: 'chest', percentage: 60 },
      { muscleGroupId: 'triceps', percentage: 25 },
      { muscleGroupId: 'shoulders', percentage: 15 },
    ])
    expect(result.valid).toBe(true)
  })

  it('rejects strength contributions that do not sum to 100%', () => {
    const result = validateMuscleContributions('strength', [
      { muscleGroupId: 'chest', percentage: 60 },
      { muscleGroupId: 'triceps', percentage: 25 },
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
