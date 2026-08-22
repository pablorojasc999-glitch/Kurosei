import Dexie, { type EntityTable } from 'dexie'
import { TRAINING_STORES_V1 } from '../../modules/training/db/schema'
import type {
  Day,
  ExecutedSet,
  Exercise,
  ExerciseMuscleContribution,
  Macrocycle,
  Mesocycle,
  MuscleGroup,
  PlannedExercise,
  PlannedSet,
  SessionExercise,
  StrengthSession,
  Week,
} from '../../modules/training/domain/types'

export class KuroseiDatabase extends Dexie {
  training_muscle_groups!: EntityTable<MuscleGroup, 'id'>
  training_exercises!: EntityTable<Exercise, 'id'>
  training_exercise_muscle_contributions!: EntityTable<
    ExerciseMuscleContribution,
    'id'
  >
  training_macrocycles!: EntityTable<Macrocycle, 'id'>
  training_mesocycles!: EntityTable<Mesocycle, 'id'>
  training_weeks!: EntityTable<Week, 'id'>
  training_days!: EntityTable<Day, 'id'>
  training_planned_exercises!: EntityTable<PlannedExercise, 'id'>
  training_planned_sets!: EntityTable<PlannedSet, 'id'>
  training_sessions!: EntityTable<StrengthSession, 'id'>
  training_session_exercises!: EntityTable<SessionExercise, 'id'>
  training_executed_sets!: EntityTable<ExecutedSet, 'id'>

  constructor() {
    super('kurosei')
    this.version(1).stores({
      ...TRAINING_STORES_V1,
    })
  }
}

export const db = new KuroseiDatabase()
