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
  percentage: number
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
}

export interface PlannedExercise extends SyncedEntity {
  dayId: string
  exerciseId: string
  order: number
  notes: string
}

export interface PlannedSet extends SyncedEntity {
  plannedExerciseId: string
  setNumber: number
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
}
