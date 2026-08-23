import Dexie, { type EntityTable } from 'dexie'
import { TRAINING_STORES_V1, TRAINING_STORES_V2 } from '../../modules/training/db/schema'
import type {
  CardioSession,
  DailyLog,
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
  UserProfile,
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
  training_cardio_sessions!: EntityTable<CardioSession, 'id'>
  training_user_profile!: EntityTable<UserProfile, 'id'>
  training_daily_logs!: EntityTable<DailyLog, 'id'>

  constructor() {
    super('kurosei')
    this.version(1).stores({
      ...TRAINING_STORES_V1,
    })
    this.version(2).stores({
      ...TRAINING_STORES_V2,
    })
    // v3 added org_categories/org_time_blocks for the since-removed
    // Organización (time blocking) feature. Kept here, empty of any real
    // schema use, only so a device that already upgraded to v3 doesn't hit
    // a Dexie VersionError on load — never remove a past version() step.
    this.version(3).stores({
      org_categories: 'id, order, updatedAt, deletedAt',
      org_time_blocks: 'id, categoryId, date, updatedAt, deletedAt',
    })
  }
}

export const db = new KuroseiDatabase()

/**
 * A schema version bump (new tables/indexes) can't upgrade this tab's
 * connection while an older tab still holds one open — IndexedDB blocks the
 * upgrade until every other connection closes, which otherwise hangs every
 * query in this tab forever with no visible error. When another tab
 * attempts the upgrade, close this stale connection and reload so it stops
 * blocking that tab and picks up the current app version too.
 */
db.on('versionchange', () => {
  db.close()
  window.location.reload()
})
