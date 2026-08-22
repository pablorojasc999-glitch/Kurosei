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
