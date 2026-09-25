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
  /**
   * @deprecated La marca vive ahora en cada serie: un ejercicio puede tener
   * la primera al 50% y las otras dos de verdad, y a nivel de ejercicio eso no
   * se podía decir. Se sigue leyendo como valor por omisión de sus series para
   * no perder lo que ya estaba marcado, pero nada lo escribe.
   */
  countsAsEffective?: boolean
}

export interface PlannedSet extends SyncedEntity {
  plannedExerciseId: string
  setNumber: number
  /**
   * Si esta serie suma al conteo de series efectivas del bloque.
   *
   * Por omisión sí: lo normal es que una serie cuente, así que lo que se marca
   * es la excepción y `undefined` es "cuenta". Va por serie y no por ejercicio
   * porque dentro del mismo ejercicio conviven la serie de aproximación y las
   * que de verdad hay que recuperar.
   */
  countsAsEffective?: boolean
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
  /** Serie descendente. Las series de antes de que existiera el campo lo traen `undefined`, que cuenta igual que `false`. */
  dropSet: boolean
  /** Serie con pausas dentro de la misma serie. Igual que `dropSet`: `undefined` cuenta como `false`. */
  restPause: boolean
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
  /** Serie descendente. Las series de antes de que existiera el campo lo traen `undefined`, que cuenta igual que `false`. */
  dropSet: boolean
  /** Serie con pausas dentro de la misma serie. Igual que `dropSet`: `undefined` cuenta como `false`. */
  restPause: boolean
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
