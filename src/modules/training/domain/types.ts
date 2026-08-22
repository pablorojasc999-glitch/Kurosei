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
