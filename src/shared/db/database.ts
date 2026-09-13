import Dexie, { type EntityTable } from 'dexie'
import { generateId } from '../lib/id'
import { FINANCE_STORES_V4, FINANCE_STORES_V10 } from '../../modules/finance/db/schema'
import { GROCERY_STORES_V8 } from '../../modules/grocery/db/schema'
import type { GroceryItem } from '../../modules/grocery/domain/types'
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceCategoryBudget,
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

/**
 * Las tablas del Atlas, que se quitó de la app. Siguen declaradas a propósito:
 * el esquema de Dexie es acumulativo, y sacarlas de la cadena de versiones haría
 * que el navegador borrase las notas que ya haya guardadas. Nada las lee ya —
 * están aquí para no destruir datos, no para usarlas.
 */
const RETIRED_ATLAS_STORES_V7 = {
  atlas_profiles: 'id, order, updatedAt, deletedAt',
  atlas_nodes: 'id, profileId, parentId, order, updatedAt, deletedAt',
}

const RETIRED_ATLAS_STORES_V9 = {
  atlas_notes: 'id, title, updatedAt, deletedAt',
}

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
  finance_category_budgets!: EntityTable<FinanceCategoryBudget, 'id'>
  nutrition_foods!: EntityTable<FoodItem, 'id'>
  nutrition_meal_sections!: EntityTable<MealSection, 'id'>
  nutrition_entries!: EntityTable<NutritionEntry, 'id'>
  nutrition_water_entries!: EntityTable<WaterEntry, 'id'>
  nutrition_meal_templates!: EntityTable<MealTemplate, 'id'>
  nutrition_meal_template_entries!: EntityTable<MealTemplateEntry, 'id'>
  nutrition_goal_plans!: EntityTable<NutritionGoalPlan, 'id'>
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
      ...RETIRED_ATLAS_STORES_V7,
    })
    this.version(8).stores({
      ...GROCERY_STORES_V8,
    })
    this.version(9).stores({ ...RETIRED_ATLAS_STORES_V9 })
    // El mes financiero pasa a ser un dato de la transacción, y el presupuesto
    // deja de ser un número en la categoría para volverse un historial con
    // fecha de vigencia.
    this.version(10)
      .stores({ ...FINANCE_STORES_V10 })
      .upgrade(async (tx) => {
        // Hasta ahora el mes lo decidía la fecha, así que ese es el valor que
        // deja las cuentas exactamente como estaban.
        await tx
          .table('finance_transactions')
          .toCollection()
          .modify((t: { date?: string; financialMonth?: string }) => {
            if (t.financialMonth === undefined) t.financialMonth = (t.date ?? '').slice(0, 7)
          })

        const categories = await tx.table('finance_categories').toArray()
        const timestamp = new Date().toISOString()
        const budgets = categories
          .filter((c: LegacyBudgetCategory) => typeof c.monthlyBudget === 'number')
          .map((c: LegacyBudgetCategory) => ({
            id: generateId(),
            categoryId: c.id,
            // El presupuesto viejo era uno solo y valía para todos los meses,
            // así que entra en vigor antes de cualquier mes que se pueda mirar.
            effectiveFrom: '1970-01',
            amount: c.monthlyBudget as number,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          }))
        if (budgets.length > 0) await tx.table('finance_category_budgets').bulkAdd(budgets)

        await tx
          .table('finance_categories')
          .toCollection()
          .modify((c: LegacyBudgetCategory) => {
            delete c.monthlyBudget
          })
      })
  }
}

/** La categoría tal como era antes de la v10, con el presupuesto encima. */
interface LegacyBudgetCategory {
  id: string
  monthlyBudget?: number | null
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
