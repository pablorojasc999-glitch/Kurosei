export type StressIndexFormula = (rpe: number) => number

/**
 * RPE -> Stress Index per set, from the user's chart (they track RPE only,
 * not RIR separately). Piecewise-linear between the chart's five points,
 * clamped to its RPE 6-10 range.
 */
const RPE_STRESS_POINTS: Array<[rpe: number, stressIndex: number]> = [
  [6, 0.6],
  [7, 0.8],
  [8, 1],
  [9, 1.2],
  [10, 1.6],
]

/** The user's real Stress Index formula. */
export const rpeStressIndexFormula: StressIndexFormula = (rpe) => {
  const clamped = Math.min(10, Math.max(6, rpe))
  for (let i = 0; i < RPE_STRESS_POINTS.length - 1; i++) {
    const [rpeA, siA] = RPE_STRESS_POINTS[i]
    const [rpeB, siB] = RPE_STRESS_POINTS[i + 1]
    if (clamped >= rpeA && clamped <= rpeB) {
      const t = (clamped - rpeA) / (rpeB - rpeA)
      return siA + t * (siB - siA)
    }
  }
  return RPE_STRESS_POINTS[RPE_STRESS_POINTS.length - 1][1]
}

let activeFormula: StressIndexFormula = rpeStressIndexFormula

export function setStressIndexFormula(formula: StressIndexFormula): void {
  activeFormula = formula
}

/** Per-set Stress Index for a logged RPE. */
export function calculateStressIndex(rpe: number): number {
  return activeFormula(rpe)
}

export type StressLevel = 'facil' | 'media' | 'dificil' | 'muyDificil'

export const STRESS_LEVEL_LABELS: Record<StressLevel, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
  muyDificil: 'Muy difícil',
}

/**
 * Weekly Stress Index thresholds per muscle group the user gave (rough
 * guides — "números promedio que deben adaptarse a cada sujeto"). Buckets
 * are centered on the given Fácil=16 / Media=20 / Difícil=24 reference
 * points, with anything past Difícil's midpoint to the next step read as
 * an overreaching week.
 */
const STRESS_LEVEL_THRESHOLDS: Array<[upperBound: number, level: StressLevel]> = [
  [18, 'facil'],
  [22, 'media'],
  [26, 'dificil'],
]

export function classifyStressLevel(totalStressIndex: number): StressLevel {
  for (const [upperBound, level] of STRESS_LEVEL_THRESHOLDS) {
    if (totalStressIndex < upperBound) return level
  }
  return 'muyDificil'
}
