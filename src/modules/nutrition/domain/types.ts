import type { SyncedEntity } from '../../training/domain/types'

/**
 * Full nutrient panel for one reference serving of a food — the same shape a
 * nutrition-facts label carries. Only the four core macros are required;
 * everything else is optional since the user fills this in by hand and may
 * not always have a label to copy from. Kept as a fixed set of fields
 * (rather than a generic nutrient dictionary) since that's what a label
 * actually looks like and it's simple to query/aggregate for future
 * "¿me falta algún nutriente?" stats.
 */
export interface NutrientProfile {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  saturatedFatG: number | null
  transFatG: number | null
  fiberG: number | null
  sugarG: number | null
  sodiumMg: number | null
  cholesterolMg: number | null
  potassiumMg: number | null
  calciumMg: number | null
  ironMg: number | null
  magnesiumMg: number | null
  zincMg: number | null
  vitaminAMcg: number | null
  vitaminCMg: number | null
  vitaminDMcg: number | null
  vitaminEMg: number | null
  vitaminKMcg: number | null
  vitaminB1Mg: number | null
  vitaminB2Mg: number | null
  vitaminB3Mg: number | null
  vitaminB6Mg: number | null
  vitaminB9Mcg: number | null
  vitaminB12Mcg: number | null
}

export type ServingUnit = 'g' | 'ml' | 'unidad'

/** One food in the user's own hand-built library. `NutrientProfile` values are per `servingAmount servingUnit`. */
export interface FoodItem extends SyncedEntity, NutrientProfile {
  name: string
  brand: string
  emoji: string
  servingAmount: number
  servingUnit: ServingUnit
  order: number
}

/** A reusable meal-of-the-day label (e.g. "Desayuno") shown on every date, not per-day data itself. */
export interface MealSection extends SyncedEntity {
  name: string
  order: number
}

export type NutritionEntryKind = 'food' | 'manual'

/**
 * One logged item for a calendar date. A `food` entry resolves its macros
 * from `foodId`'s per-serving values scaled by `quantity / servingAmount` at
 * log time; a `manual` entry (e.g. "Almuerzo restaurante X") has no `foodId`
 * and the four macros are typed in directly. Either way the macros are
 * stored on the entry itself — like a transaction's denormalized category
 * type — so editing or deleting the food later never changes past totals.
 * Micronutrients aren't denormalized here; a `food` entry's are looked up
 * live from `foodId` when needed (e.g. future micronutrient stats).
 */
export interface NutritionEntry extends SyncedEntity {
  date: string
  sectionId: string
  order: number
  kind: NutritionEntryKind
  foodId: string | null
  quantity: number | null
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

/** One free-form water log for a calendar date (e.g. "293" ml from a glass) — summed per day, individually deletable. */
export interface WaterEntry extends SyncedEntity {
  date: string
  amountMl: number
}

/** A saved "whole day" pattern of meals, to load onto any date. */
export interface MealTemplate extends SyncedEntity {
  name: string
  emoji: string
  order: number
}

/** One item within a `MealTemplate` — same shape as `NutritionEntry` but keyed by template instead of date. */
export interface MealTemplateEntry extends SyncedEntity {
  templateId: string
  sectionId: string
  order: number
  kind: NutritionEntryKind
  foodId: string | null
  quantity: number | null
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

/**
 * A date-ranged nutrition goal — analogous to a training mesociclo, but flat:
 * one set of daily targets (calories, macros, water) held for a period.
 * `endDate: null` means "open-ended, still in effect". When a date falls
 * inside more than one plan's range, the plan with the latest `startDate`
 * wins — the same "most specific override wins" rule a training block would
 * use for an overlapping adjustment.
 */
export interface NutritionGoalPlan extends SyncedEntity {
  name: string
  startDate: string
  endDate: string | null
  targetCalories: number
  targetProteinG: number
  targetCarbsG: number
  targetFatG: number
  targetWaterMl: number
  order: number
}
