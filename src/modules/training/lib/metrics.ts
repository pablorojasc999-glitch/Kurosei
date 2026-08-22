export interface WeightedSet {
  weightKg: number
  reps: number
}

export function tonnage(sets: WeightedSet[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
}

export function relativeIntensity(weightKg: number, e1rm: number): number {
  if (e1rm <= 0) return 0
  return (weightKg / e1rm) * 100
}

export interface MuscleContribution {
  muscleGroupId: string
  percentage: number
}

export interface SetWithExercise {
  exerciseId: string
}

/**
 * Weighted-set volume per muscle group: a set counts fractionally toward
 * each muscle group by the exercise's contribution %, so a compound lift
 * contributes partial volume to several groups instead of full credit to
 * each (e.g. bench at 60% chest / 25% triceps / 15% front delt).
 */
export function muscleGroupVolume(
  sets: SetWithExercise[],
  contributionsByExercise: Map<string, MuscleContribution[]>,
): Map<string, number> {
  const volumeByGroup = new Map<string, number>()
  for (const set of sets) {
    const contributions = contributionsByExercise.get(set.exerciseId) ?? []
    for (const c of contributions) {
      const prior = volumeByGroup.get(c.muscleGroupId) ?? 0
      volumeByGroup.set(c.muscleGroupId, prior + c.percentage / 100)
    }
  }
  return volumeByGroup
}

export interface SetWithExerciseAndRpe extends SetWithExercise {
  rpe: number | null
}

/**
 * Contribution-weighted Stress Index per muscle group: each set contributes
 * its RPE's Stress Index fractionally to every muscle group the exercise
 * trains, same weighting as muscleGroupVolume. A set with no RPE logged
 * contributes nothing (there's no RPE to look up).
 */
export function muscleGroupStressIndex(
  sets: SetWithExerciseAndRpe[],
  contributionsByExercise: Map<string, MuscleContribution[]>,
  stressIndexForRpe: (rpe: number) => number,
): Map<string, number> {
  const stressByGroup = new Map<string, number>()
  for (const set of sets) {
    if (set.rpe === null) continue
    const setStress = stressIndexForRpe(set.rpe)
    const contributions = contributionsByExercise.get(set.exerciseId) ?? []
    for (const c of contributions) {
      const prior = stressByGroup.get(c.muscleGroupId) ?? 0
      stressByGroup.set(
        c.muscleGroupId,
        prior + setStress * (c.percentage / 100),
      )
    }
  }
  return stressByGroup
}

export function isNewPR(candidate: number, priorBest: number | null): boolean {
  return priorBest === null || candidate > priorBest
}

export interface E1rmTrendPoint {
  date: string
  e1rm: number
}

export function buildE1rmTrend(points: E1rmTrendPoint[]): E1rmTrendPoint[] {
  return [...points].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

export interface RpePair {
  plannedRpe: number
  actualRpe: number
}

export function averageRpeDeviation(pairs: RpePair[]): number {
  if (pairs.length === 0) return 0
  const total = pairs.reduce((sum, p) => sum + (p.actualRpe - p.plannedRpe), 0)
  return total / pairs.length
}

const DELOAD_RPE_DEVIATION_THRESHOLD = 1

/**
 * Flags a deload/fatigue alert when actual RPE has consistently run hotter
 * than planned across recent sessions, not just a single hard day.
 */
export function needsDeloadAlert(recentDeviations: number[]): boolean {
  if (recentDeviations.length === 0) return false
  const allElevated = recentDeviations.every(
    (d) => d >= DELOAD_RPE_DEVIATION_THRESHOLD,
  )
  return allElevated
}
