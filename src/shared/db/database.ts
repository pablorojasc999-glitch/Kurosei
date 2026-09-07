import Dexie, { type EntityTable } from 'dexie'
import { ATLAS_STORES_V7, ATLAS_STORES_V9 } from '../../modules/atlas/db/schema'
import { migrateTreeToNotes } from '../../modules/atlas/db/migrateTreeToNotes'
import type {
  LegacyNode,
  LegacyProfile,
} from '../../modules/atlas/db/migrateTreeToNotes'
import type { AtlasNote } from '../../modules/atlas/domain/types'
import { FINANCE_STORES_V4 } from '../../modules/finance/db/schema'
import { GROCERY_STORES_V8 } from '../../modules/grocery/db/schema'
import type { GroceryItem } from '../../modules/grocery/domain/types'
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
} from '../../modules/finance/domain/types'
import { NUTRITION_STORES_V5, NUTRITION_STORES_V6 } from '../../modules/nutrition/db/schema'
import type {
  FoodItem,
  MealSection,
  MealTemplate,
  MealTemplateEntry,
  NutritionEntry,
  NutritionGoalPlan,
  WaterEntry,
} from '../../modules/nutrition/domain/types'
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
  finance_accounts!: EntityTable<FinanceAccount, 'id'>
  finance_categories!: EntityTable<FinanceCategory, 'id'>
  finance_transactions!: EntityTable<FinanceTransaction, 'id'>
  nutrition_foods!: EntityTable<FoodItem, 'id'>
  nutrition_meal_sections!: EntityTable<MealSection, 'id'>
  nutrition_entries!: EntityTable<NutritionEntry, 'id'>
  nutrition_water_entries!: EntityTable<WaterEntry, 'id'>
  nutrition_meal_templates!: EntityTable<MealTemplate, 'id'>
  nutrition_meal_template_entries!: EntityTable<MealTemplateEntry, 'id'>
  nutrition_goal_plans!: EntityTable<NutritionGoalPlan, 'id'>
  // El Atlas viejo era un árbol de perfiles y nodos. Desde la v9 son notas
  // enlazadas; estas dos tablas se quedan declaradas para no romper el
  // upgrade de quien venga de una versión anterior, pero ya no se usan.
  atlas_profiles!: EntityTable<LegacyProfile, 'id'>
  atlas_nodes!: EntityTable<LegacyNode, 'id'>
  atlas_notes!: EntityTable<AtlasNote, 'id'>
  grocery_items!: EntityTable<GroceryItem, 'id'>

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
    this.version(4).stores({
      ...FINANCE_STORES_V4,
    })
    this.version(5).stores({
      ...NUTRITION_STORES_V5,
    })
    this.version(6).stores({
      ...NUTRITION_STORES_V6,
    })
    this.version(7).stores({
      ...ATLAS_STORES_V7,
    })
    this.version(8).stores({
      ...GROCERY_STORES_V8,
    })
    // Atlas pasa de árbol a notas enlazadas. La jerarquía no se tira: cada
    // relación padre→hijo se reescribe como un `[[enlace]]` en el cuerpo del
    // padre, dentro de la misma transacción de upgrade.
    this.version(9)
      .stores({ ...ATLAS_STORES_V9 })
      .upgrade(async (tx) => {
        const profiles = await tx.table('atlas_profiles').toArray()
        const nodes = await tx.table('atlas_nodes').toArray()
        const notes = migrateTreeToNotes(profiles, nodes)
        if (notes.length > 0) await tx.table('atlas_notes').bulkAdd(notes)
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
