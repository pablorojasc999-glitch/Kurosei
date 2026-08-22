import Dexie, { type EntityTable } from 'dexie'
import { TRAINING_STORES_V1 } from '../../modules/training/db/schema'
import type {
  Exercise,
  ExerciseMuscleContribution,
  MuscleGroup,
} from '../../modules/training/domain/types'

export class KuroseiDatabase extends Dexie {
  training_muscle_groups!: EntityTable<MuscleGroup, 'id'>
  training_exercises!: EntityTable<Exercise, 'id'>
  training_exercise_muscle_contributions!: EntityTable<
    ExerciseMuscleContribution,
    'id'
  >

  constructor() {
    super('kurosei')
    this.version(1).stores({
      ...TRAINING_STORES_V1,
    })
  }
}

export const db = new KuroseiDatabase()
