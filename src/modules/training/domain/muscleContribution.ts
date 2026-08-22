const PERCENTAGE_TOLERANCE = 0.01

export interface ContributionInput {
  muscleGroupId: string
  percentage: number
}

export interface ContributionValidationResult {
  valid: boolean
  error?: string
}

export function validateMuscleContributions(
  exerciseType: 'strength' | 'cardio',
  contributions: ContributionInput[],
): ContributionValidationResult {
  if (exerciseType === 'cardio') {
    return { valid: true }
  }

  if (contributions.length === 0) {
    return { valid: false, error: 'Debe asignar al menos un grupo muscular.' }
  }

  const total = contributions.reduce((sum, c) => sum + c.percentage, 0)
  if (Math.abs(total - 100) > PERCENTAGE_TOLERANCE) {
    return {
      valid: false,
      error: `Los porcentajes deben sumar 100% (suman ${total}%).`,
    }
  }

  return { valid: true }
}
