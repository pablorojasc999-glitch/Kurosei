export interface ContributionInput {
  muscleGroupId: string
  factor: number
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

  if (contributions.some((c) => c.factor <= 0)) {
    return {
      valid: false,
      error: 'Cada grupo muscular asignado debe tener un factor mayor a 0.',
    }
  }

  return { valid: true }
}
