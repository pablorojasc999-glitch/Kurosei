import { describe, expect, it } from 'vitest'
import type { NutritionGoalPlan } from '../domain/types'
import { findActivePlan, getGoalStatus, progressPercent } from './goalPlans'

function plan(overrides: Partial<NutritionGoalPlan>): NutritionGoalPlan {
  return {
    id: overrides.id ?? 'p1',
    name: 'Plan',
    startDate: '2026-01-01',
    endDate: null,
    targetCalories: 2000,
    targetProteinG: 150,
    targetCarbsG: 200,
    targetFatG: 60,
    targetWaterMl: 2000,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('findActivePlan', () => {
  it('returns null when no plan covers the date', () => {
    const plans = [plan({ startDate: '2026-02-01', endDate: '2026-02-28' })]
    expect(findActivePlan(plans, '2026-01-15')).toBeNull()
  })

  it('returns the plan whose range covers the date', () => {
    const plans = [plan({ startDate: '2026-01-01', endDate: '2026-01-31' })]
    expect(findActivePlan(plans, '2026-01-15')?.startDate).toBe('2026-01-01')
  })

  it('treats endDate: null as open-ended', () => {
    const plans = [plan({ startDate: '2026-01-01', endDate: null })]
    expect(findActivePlan(plans, '2099-01-01')).not.toBeNull()
  })

  it('prefers the plan with the latest startDate when ranges overlap', () => {
    const plans = [
      plan({ id: 'wide', startDate: '2026-01-01', endDate: null, targetCalories: 2000 }),
      plan({ id: 'override', startDate: '2026-03-01', endDate: '2026-03-31', targetCalories: 1800 }),
    ]
    expect(findActivePlan(plans, '2026-03-15')?.id).toBe('override')
    expect(findActivePlan(plans, '2026-04-01')?.id).toBe('wide')
  })
})

describe('getGoalStatus', () => {
  it('is "none" when nothing was logged, regardless of a plan existing', () => {
    expect(getGoalStatus(plan({}), 0, false)).toBe('none')
  })

  it('is "no-plan" when something was logged but no plan covers the date', () => {
    expect(getGoalStatus(null, 1500, true)).toBe('no-plan')
  })

  it('is "on-track" within the tolerance band around the calorie target', () => {
    expect(getGoalStatus(plan({ targetCalories: 2000 }), 2000, true)).toBe('on-track')
    expect(getGoalStatus(plan({ targetCalories: 2000 }), 1700, true)).toBe('on-track')
    expect(getGoalStatus(plan({ targetCalories: 2000 }), 2150, true)).toBe('on-track')
  })

  it('is "off-track" outside the tolerance band', () => {
    expect(getGoalStatus(plan({ targetCalories: 2000 }), 1000, true)).toBe('off-track')
    expect(getGoalStatus(plan({ targetCalories: 2000 }), 2500, true)).toBe('off-track')
  })
})

describe('progressPercent', () => {
  it('scales consumed/target to a 0-100 percentage', () => {
    expect(progressPercent(420, 2222)).toBeCloseTo(18.9, 1)
  })

  it('clamps at 100 when consumed exceeds the target', () => {
    expect(progressPercent(3000, 2000)).toBe(100)
  })

  it('is 0 when the target is zero or negative', () => {
    expect(progressPercent(100, 0)).toBe(0)
    expect(progressPercent(100, -5)).toBe(0)
  })
})
