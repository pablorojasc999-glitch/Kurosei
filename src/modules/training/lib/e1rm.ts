export interface E1rmInput {
  weightKg: number
  reps: number
  rpe?: number
}

export type E1rmFormula = (input: E1rmInput) => number

/**
 * Placeholder only — a plain Epley estimate ignoring RPE.
 * Replace via setE1rmFormula() with the real formula/matrix once available.
 */
export const placeholderE1rmFormula: E1rmFormula = ({ weightKg, reps }) => {
  if (reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

let activeFormula: E1rmFormula = placeholderE1rmFormula

export function setE1rmFormula(formula: E1rmFormula): void {
  activeFormula = formula
}

export function calculateE1rm(input: E1rmInput): number {
  return activeFormula(input)
}
