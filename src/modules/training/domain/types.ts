export interface SyncedEntity {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ExerciseType = 'strength' | 'cardio'

export type ExerciseCategory = 'squat' | 'bench' | 'deadlift'

export interface MuscleGroup extends SyncedEntity {
  name: string
}

export interface Exercise extends SyncedEntity {
  name: string
  type: ExerciseType
  category: ExerciseCategory | null
}

export interface ExerciseMuscleContribution extends SyncedEntity {
  exerciseId: string
  muscleGroupId: string
  factor: number
}

export type PhaseType =
  | 'accumulation'
  | 'intensification'
  | 'peaking'
  | 'deload'
  | 'custom'

export interface Macrocycle extends SyncedEntity {
  name: string
  goal: string
  startDate: string
  endDate: string
}

export interface Mesocycle extends SyncedEntity {
  macrocycleId: string
  name: string
  phaseType: PhaseType
  order: number
  startDate: string
  endDate: string
}

export interface Week extends SyncedEntity {
  mesocycleId: string
  order: number
}

export interface Day extends SyncedEntity {
  weekId: string | null
  date: string
  label: string
  planClosedAt: string | null
}

export interface PlannedExercise extends SyncedEntity {
  dayId: string
  exerciseId: string
  order: number
  notes: string
  closedAt: string | null
}

export interface PlannedSet extends SyncedEntity {
  plannedExerciseId: string
  setNumber: number
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
}

export interface StrengthSession extends SyncedEntity {
  dayId: string
  startedAt: string
  endedAt: string | null
}

export interface SessionExercise extends SyncedEntity {
  sessionId: string
  exerciseId: string
  order: number
  notes: string
  closedAt: string | null
}

export interface ExecutedSet extends SyncedEntity {
  sessionExerciseId: string
  setNumber: number
  weightKg: number | null
  reps: number
  rpe: number | null
  eva: number | null
  notes: string
  performedAt: string
  restTakenSeconds: number | null
}

export interface CardioSession extends SyncedEntity {
  dayId: string
  exerciseId: string
  startedAt: string
  durationMinutes: number
  distanceKm: number | null
  caloriesBurned: number | null
  notes: string
}

export type Sex = 'male' | 'female'

/**
 * Singleton per user — the slow-changing body data needed to estimate
 * calorie expenditure (BMR). Body-fat/muscle % are updated by hand
 * whenever the user gets evaluated (roughly monthly), not logged daily.
 */
export interface UserProfile extends SyncedEntity {
  heightCm: number | null
  birthDate: string | null
  sex: Sex | null
  bodyFatPercent: number | null
  muscleMassPercent: number | null
}

/** One row per calendar day — the daily wellness/nutrition bitácora. */
export interface DailyLog extends SyncedEntity {
  date: string
  bodyWeightKg: number | null
  calories: number | null
  carbsG: number | null
  proteinG: number | null
  fatG: number | null
  sleepHours: number | null
  creatineTaken: boolean
  omega3Taken: boolean
  vitaminDTaken: boolean
  waterLiters: number | null
  stress: number | null
  stimulants: number | null
  fatigue: number | null
  steps: number | null
}
