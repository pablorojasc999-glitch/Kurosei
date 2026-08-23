export interface E1rmInput {
  weightKg: number
  reps: number
  rpe?: number
}

export type E1rmFormula = (input: E1rmInput) => number

/**
 * Fallback only — a plain Epley estimate ignoring RPE. Used by
 * rpeTableE1rmFormula when there's no RPE or the rep count falls outside
 * the RPE table (1-15 reps).
 */
export const placeholderE1rmFormula: E1rmFormula = ({ weightKg, reps }) => {
  if (reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/**
 * %1RM chart supplied by the user: rows are RPE (10 down to 1, 0.5 steps),
 * columns are reps (1-15). RPE_PERCENT_TABLE[rpe][reps - 1] is the fraction
 * of 1RM that a set of `reps` at that RPE represents.
 */
const RPE_PERCENT_TABLE: Record<number, number[]> = {
  10: [1, 0.9847, 0.9565, 0.9284, 0.9002, 0.8721, 0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186],
  9.5: [0.9915, 0.9706, 0.9425, 0.9143, 0.8861, 0.858, 0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045],
  9: [0.9847, 0.9565, 0.9284, 0.9002, 0.8721, 0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905],
  8.5: [0.9706, 0.9425, 0.9143, 0.8861, 0.858, 0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763],
  8: [0.9565, 0.9284, 0.9002, 0.8721, 0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623],
  7.5: [0.9425, 0.9143, 0.8861, 0.858, 0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481],
  7: [0.9284, 0.9002, 0.8721, 0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342],
  6.5: [0.9143, 0.8861, 0.858, 0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481, 0.52],
  6: [0.9002, 0.8721, 0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342, 0.506],
  5.5: [0.8861, 0.858, 0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481, 0.52, 0.4919],
  5: [0.8721, 0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342, 0.506, 0.4778],
  4.5: [0.858, 0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481, 0.52, 0.4919, 0.4637],
  4: [0.8439, 0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342, 0.506, 0.4778, 0.4497],
  3.5: [0.8298, 0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481, 0.52, 0.4919, 0.4637, 0.4355],
  3: [0.8157, 0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342, 0.506, 0.4778, 0.4497, 0.4215],
  2.5: [0.8017, 0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481, 0.52, 0.4919, 0.4637, 0.4355, 0.4074],
  2: [0.7876, 0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342, 0.506, 0.4778, 0.4497, 0.4215, 0.3934],
  1.5: [0.7735, 0.7453, 0.7172, 0.689, 0.6608, 0.6327, 0.6045, 0.5763, 0.5481, 0.52, 0.4919, 0.4637, 0.4355, 0.4074, 0.3792],
  1: [0.7594, 0.7313, 0.7031, 0.675, 0.6468, 0.6186, 0.5905, 0.5623, 0.5342, 0.506, 0.4778, 0.4497, 0.4215, 0.3934, 0.3652],
}

/** Rounds to the nearest 0.5 step and clamps to the table's RPE range [1, 10]. */
function normalizeRpe(rpe: number): number {
  const rounded = Math.round(rpe * 2) / 2
  return Math.min(10, Math.max(1, rounded))
}

/**
 * The user's real formula: an RPE-based %1RM lookup table (RPE 1-10 in 0.5
 * steps, reps 1-15). Falls back to the plain Epley estimate when there's
 * no RPE logged for the set, or the rep count is outside the table.
 */
export const rpeTableE1rmFormula: E1rmFormula = (input) => {
  const { weightKg, reps, rpe } = input
  if (reps <= 0) return 0
  if (rpe === undefined || !Number.isInteger(reps) || reps > 15) {
    return placeholderE1rmFormula(input)
  }
  const percentage = RPE_PERCENT_TABLE[normalizeRpe(rpe)][reps - 1]
  return weightKg / percentage
}

let activeFormula: E1rmFormula = rpeTableE1rmFormula

export function setE1rmFormula(formula: E1rmFormula): void {
  activeFormula = formula
}

export function calculateE1rm(input: E1rmInput): number {
  return activeFormula(input)
}

export interface WeightForTargetInput {
  e1rm: number
  reps: number
  rpe: number
}

/**
 * Inverse of the RPE table lookup: given an e1RM and a target rep/RPE
 * combo, the weight that combo represents. Only defined within the table's
 * range (integer reps 1-15, RPE 1-10) — returns null outside it, since
 * there's no RPE-based inverse for the Epley fallback.
 */
export function estimateWeightForTarget({
  e1rm,
  reps,
  rpe,
}: WeightForTargetInput): number | null {
  if (e1rm <= 0 || reps <= 0 || !Number.isInteger(reps) || reps > 15) return null
  const percentage = RPE_PERCENT_TABLE[normalizeRpe(rpe)][reps - 1]
  return e1rm * percentage
}
