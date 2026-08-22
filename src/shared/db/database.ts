import Dexie, { type EntityTable } from 'dexie'
import { TRAINING_STORES_V1 } from '../../modules/training/db/schema'
import type {
  Day,
  Exercise,
  ExerciseMuscleContribution,
  Macrocycle,
  Mesocycle,
  MuscleGroup,
  PlannedExercise,
  PlannedSet,
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

  constructor() {
    super('kurosei')
    this.version(1).stores({
      ...TRAINING_STORES_V1,
    })
  }
}

export const db = new KuroseiDatabase()
