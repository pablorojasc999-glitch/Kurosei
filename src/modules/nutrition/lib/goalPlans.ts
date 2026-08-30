import type { NutritionGoalPlan } from '../domain/types'

/**
 * The plan in effect for `date` — the one among `plans` whose range contains
 * it, preferring the latest `startDate` when more than one does (a plan
 * layered on top overrides an older, wider one, same as a training block).
 * `null` when no plan covers the date at all.
 */
export function findActivePlan(
  plans: NutritionGoalPlan[],
  date: string,
): NutritionGoalPlan | null {
  const covering = plans.filter(
    (p) => p.startDate <= date && (p.endDate === null || date <= p.endDate),
  )
  if (covering.length === 0) return null
  return covering.reduce((latest, p) => (p.startDate > latest.startDate ? p : latest))
}

/** `consumed` as a percentage of `target`, clamped to [0, 100] for a progress-bar width. */
export function progressPercent(consumed: number, target: number): number {
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, (consumed / target) * 100))
}

export type GoalStatus = 'none' | 'no-plan' | 'on-track' | 'off-track'

/**
 * How a day's totals compare to its active plan, for the week-strip dot and
 * progress-bar colors. `'none'` means nothing was logged that day at all —
 * distinct from `'no-plan'` (logged, but no goal exists to compare against).
 * "On track" allows a tolerance band since hitting a macro target to the
 * gram isn't realistic — over by more than 10% of the calorie goal, or under
 * by more than 20% (skipping meals is worse than a bit of a surplus), reads
 * as off track.
 */
export function getGoalStatus(
  plan: NutritionGoalPlan | null,
  totalCalories: number,
  hasAnyEntry: boolean,
): GoalStatus {
  if (!hasAnyEntry) return 'none'
  if (!plan || plan.targetCalories <= 0) return 'no-plan'
  const ratio = totalCalories / plan.targetCalories
  return ratio >= 0.8 && ratio <= 1.1 ? 'on-track' : 'off-track'
}
