import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { getDailyLog, upsertDailyLog } from '../../training/db/bitacoraRepository'
import type {
  FoodItem,
  MealSection,
  MealTemplate,
  MealTemplateEntry,
  NutrientProfile,
  NutritionEntry,
  NutritionEntryKind,
  NutritionGoalPlan,
  ServingUnit,
  WaterEntry,
} from '../domain/types'
import { findActivePlan } from '../lib/goalPlans'
import { scaleMacros, sumMacros, type MacroTotals } from '../lib/macros'
import { moveItem, reindex } from '../lib/reorder'

// ---------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------

export async function listFoods(): Promise<FoodItem[]> {
  const foods = await db.nutrition_foods.filter((f) => f.deletedAt === null).toArray()
  return foods.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export interface CreateFoodInput extends NutrientProfile {
  name: string
  brand: string
  emoji: string
  servingAmount: number
  servingUnit: ServingUnit
}

export async function createFood(input: CreateFoodInput): Promise<FoodItem> {
  const siblings = await listFoods()
  const nextOrder = siblings.length ? Math.max(...siblings.map((f) => f.order)) + 1 : 0
  const timestamp = nowIso()
  const food: FoodItem = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_foods.add(food)
  return food
}

export type UpdateFoodInput = Partial<CreateFoodInput>

export async function updateFood(id: string, input: UpdateFoodInput): Promise<void> {
  await db.nutrition_foods.update(id, { ...input, updatedAt: nowIso() })
}

export async function softDeleteFood(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.nutrition_foods.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

// ---------------------------------------------------------------------
// Meal sections (reusable across every date, e.g. "Desayuno")
// ---------------------------------------------------------------------

export async function listMealSections(): Promise<MealSection[]> {
  return db.nutrition_meal_sections.filter((s) => s.deletedAt === null).sortBy('order')
}

export async function createMealSection(name: string): Promise<MealSection> {
  const siblings = await listMealSections()
  const nextOrder = siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0
  const timestamp = nowIso()
  const section: MealSection = {
    id: generateId(),
    name,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_meal_sections.add(section)
  return section
}

export async function renameMealSection(id: string, name: string): Promise<void> {
  await db.nutrition_meal_sections.update(id, { name, updatedAt: nowIso() })
}

/** Refuses to delete a section that still has logged entries anywhere, past or present — deleting it would orphan them. */
export async function softDeleteMealSection(id: string): Promise<void> {
  const inUse = await db.nutrition_entries
    .where('sectionId')
    .equals(id)
    .filter((e) => e.deletedAt === null)
    .count()
  if (inUse > 0) {
    throw new Error('Esta sección tiene registros — movelos o eliminalos antes de borrarla.')
  }
  const timestamp = nowIso()
  await db.nutrition_meal_sections.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/** Reorders the meal sections themselves (not their entries) to match `orderedIds`. */
export async function reorderMealSections(orderedIds: string[]): Promise<void> {
  const sections = await listMealSections()
  const changed = reindex(sections, orderedIds)
  const timestamp = nowIso()
  await Promise.all(
    changed.map((s) =>
      db.nutrition_meal_sections.update(s.id, { order: s.order, updatedAt: timestamp }),
    ),
  )
}

// ---------------------------------------------------------------------
// Entries (per-date log items)
// ---------------------------------------------------------------------

export async function listEntriesForDate(date: string): Promise<NutritionEntry[]> {
  const entries = await db.nutrition_entries
    .where('date')
    .equals(date)
    .filter((e) => e.deletedAt === null)
    .toArray()
  return entries.sort((a, b) => a.order - b.order)
}

/** All entries within `[startDate, endDate]` inclusive — used to compute the week strip's per-day status without one query per day. */
export async function listEntriesForDateRange(
  startDate: string,
  endDate: string,
): Promise<NutritionEntry[]> {
  return db.nutrition_entries
    .where('date')
    .between(startDate, endDate, true, true)
    .filter((e) => e.deletedAt === null)
    .toArray()
}

export function getEntryMacroTotals(entries: MacroTotals[]): MacroTotals {
  return sumMacros(entries)
}

export interface AddFoodEntryInput {
  date: string
  sectionId: string
  foodId: string
  quantity: number
  notes: string
}

export async function addFoodEntry(input: AddFoodEntryInput): Promise<NutritionEntry> {
  const food = await db.nutrition_foods.get(input.foodId)
  if (!food) throw new Error('Alimento no encontrado.')
  const macros = scaleMacros(food, input.quantity)
  const entry = await insertEntry({
    date: input.date,
    sectionId: input.sectionId,
    kind: 'food',
    foodId: input.foodId,
    quantity: input.quantity,
    manualName: '',
    notes: input.notes,
    ...macros,
  })
  await syncNutritionTotalsToDailyLog(input.date)
  return entry
}

export interface AddManualEntryInput {
  date: string
  sectionId: string
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

export async function addManualEntry(input: AddManualEntryInput): Promise<NutritionEntry> {
  const entry = await insertEntry({
    date: input.date,
    sectionId: input.sectionId,
    kind: 'manual',
    foodId: null,
    quantity: null,
    manualName: input.manualName,
    notes: input.notes,
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  })
  await syncNutritionTotalsToDailyLog(input.date)
  return entry
}

interface InsertEntryInput extends MacroTotals {
  date: string
  sectionId: string
  kind: NutritionEntryKind
  foodId: string | null
  quantity: number | null
  manualName: string
  notes: string
}

async function insertEntry(input: InsertEntryInput): Promise<NutritionEntry> {
  const siblings = (await listEntriesForDate(input.date)).filter(
    (e) => e.sectionId === input.sectionId,
  )
  const nextOrder = siblings.length ? Math.max(...siblings.map((e) => e.order)) + 1 : 0
  const timestamp = nowIso()
  const entry: NutritionEntry = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_entries.add(entry)
  return entry
}

/** Re-scales a `food`-kind entry's stored macros for a new quantity. */
export async function updateFoodEntryQuantity(id: string, quantity: number): Promise<void> {
  const entry = await db.nutrition_entries.get(id)
  if (!entry || !entry.foodId) return
  const food = await db.nutrition_foods.get(entry.foodId)
  if (!food) return
  const macros = scaleMacros(food, quantity)
  await db.nutrition_entries.update(id, { quantity, ...macros, updatedAt: nowIso() })
  await syncNutritionTotalsToDailyLog(entry.date)
}

export interface UpdateManualEntryInput {
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

export async function updateManualEntry(
  id: string,
  input: UpdateManualEntryInput,
): Promise<void> {
  const entry = await db.nutrition_entries.get(id)
  if (!entry) return
  await db.nutrition_entries.update(id, { ...input, updatedAt: nowIso() })
  await syncNutritionTotalsToDailyLog(entry.date)
}

export async function softDeleteEntry(id: string): Promise<void> {
  const entry = await db.nutrition_entries.get(id)
  if (!entry) return
  const timestamp = nowIso()
  await db.nutrition_entries.update(id, { deletedAt: timestamp, updatedAt: timestamp })
  await syncNutritionTotalsToDailyLog(entry.date)
}

/** Moves an entry to `targetSectionId` at `targetIndex` — a plain reorder when the section is unchanged, a cross-meal move otherwise. */
export async function moveEntry(
  entryId: string,
  targetSectionId: string,
  targetIndex: number,
): Promise<void> {
  const entry = await db.nutrition_entries.get(entryId)
  if (!entry || entry.deletedAt) return
  const dayEntries = await listEntriesForDate(entry.date)
  const changed = moveItem(dayEntries, entryId, targetSectionId, targetIndex)
  if (changed.length === 0) return
  const timestamp = nowIso()
  await Promise.all(
    changed.map((c) =>
      db.nutrition_entries.update(c.id, {
        sectionId: c.sectionId,
        order: c.order,
        updatedAt: timestamp,
      }),
    ),
  )
}

// ---------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------

export async function listWaterEntriesForDate(date: string): Promise<WaterEntry[]> {
  const entries = await db.nutrition_water_entries
    .where('date')
    .equals(date)
    .filter((e) => e.deletedAt === null)
    .toArray()
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function getWaterTotalMl(entries: WaterEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amountMl, 0)
}

export async function addWaterEntry(date: string, amountMl: number): Promise<WaterEntry> {
  const timestamp = nowIso()
  const entry: WaterEntry = {
    id: generateId(),
    date,
    amountMl,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_water_entries.add(entry)
  await syncNutritionTotalsToDailyLog(date)
  return entry
}

export async function softDeleteWaterEntry(id: string): Promise<void> {
  const entry = await db.nutrition_water_entries.get(id)
  if (!entry) return
  const timestamp = nowIso()
  await db.nutrition_water_entries.update(id, { deletedAt: timestamp, updatedAt: timestamp })
  await syncNutritionTotalsToDailyLog(entry.date)
}

// ---------------------------------------------------------------------
// Bitácora write-through — the day's macro/water totals from Nutrición
// become the daily log's `calories`/`carbsG`/`proteinG`/`fatG`/`waterLiters`,
// so they're never typed in by hand.
// ---------------------------------------------------------------------

export async function syncNutritionTotalsToDailyLog(date: string): Promise<void> {
  const [entries, waterEntries, existing] = await Promise.all([
    listEntriesForDate(date),
    listWaterEntriesForDate(date),
    getDailyLog(date),
  ])
  const totals = getEntryMacroTotals(entries)
  const waterMl = getWaterTotalMl(waterEntries)
  await upsertDailyLog(date, {
    bodyWeightKg: existing?.bodyWeightKg ?? null,
    calories: totals.calories,
    carbsG: totals.carbsG,
    proteinG: totals.proteinG,
    fatG: totals.fatG,
    sleepHours: existing?.sleepHours ?? null,
    creatineTaken: existing?.creatineTaken ?? false,
    omega3Taken: existing?.omega3Taken ?? false,
    vitaminDTaken: existing?.vitaminDTaken ?? false,
    waterLiters: waterMl / 1000,
    stress: existing?.stress ?? null,
    stimulants: existing?.stimulants ?? null,
    fatigue: existing?.fatigue ?? null,
    steps: existing?.steps ?? null,
  })
}

// ---------------------------------------------------------------------
// Meal templates — a saved "whole day" pattern, applicable to any date.
// ---------------------------------------------------------------------

export async function listMealTemplates(): Promise<MealTemplate[]> {
  return db.nutrition_meal_templates.filter((t) => t.deletedAt === null).sortBy('order')
}

export async function listTemplateEntries(templateId: string): Promise<MealTemplateEntry[]> {
  const entries = await db.nutrition_meal_template_entries
    .where('templateId')
    .equals(templateId)
    .filter((e) => e.deletedAt === null)
    .toArray()
  return entries.sort((a, b) => a.order - b.order)
}

/** Starts a brand-new, empty template — sections and entries are added to it afterwards, same as building out a day in Registro. */
export async function createMealTemplate(name: string, emoji: string): Promise<MealTemplate> {
  const siblings = await listMealTemplates()
  const nextOrder = siblings.length ? Math.max(...siblings.map((t) => t.order)) + 1 : 0
  const timestamp = nowIso()
  const template: MealTemplate = {
    id: generateId(),
    name,
    emoji,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_meal_templates.add(template)
  return template
}

interface InsertTemplateEntryInput extends MacroTotals {
  templateId: string
  sectionId: string
  kind: NutritionEntryKind
  foodId: string | null
  quantity: number | null
  manualName: string
  notes: string
}

async function insertTemplateEntry(input: InsertTemplateEntryInput): Promise<MealTemplateEntry> {
  const siblings = (await listTemplateEntries(input.templateId)).filter(
    (e) => e.sectionId === input.sectionId,
  )
  const nextOrder = siblings.length ? Math.max(...siblings.map((e) => e.order)) + 1 : 0
  const timestamp = nowIso()
  const entry: MealTemplateEntry = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_meal_template_entries.add(entry)
  return entry
}

export interface AddTemplateFoodEntryInput {
  templateId: string
  sectionId: string
  foodId: string
  quantity: number
  notes: string
}

export async function addFoodEntryToTemplate(
  input: AddTemplateFoodEntryInput,
): Promise<MealTemplateEntry> {
  const food = await db.nutrition_foods.get(input.foodId)
  if (!food) throw new Error('Alimento no encontrado.')
  const macros = scaleMacros(food, input.quantity)
  return insertTemplateEntry({
    templateId: input.templateId,
    sectionId: input.sectionId,
    kind: 'food',
    foodId: input.foodId,
    quantity: input.quantity,
    manualName: '',
    notes: input.notes,
    ...macros,
  })
}

export interface AddTemplateManualEntryInput {
  templateId: string
  sectionId: string
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

export async function addManualEntryToTemplate(
  input: AddTemplateManualEntryInput,
): Promise<MealTemplateEntry> {
  return insertTemplateEntry({
    templateId: input.templateId,
    sectionId: input.sectionId,
    kind: 'manual',
    foodId: null,
    quantity: null,
    manualName: input.manualName,
    notes: input.notes,
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  })
}

export async function softDeleteTemplateEntry(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.nutrition_meal_template_entries.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/** Re-scales a `food`-kind template entry's stored macros for a new quantity. */
export async function updateTemplateFoodEntryQuantity(id: string, quantity: number): Promise<void> {
  const entry = await db.nutrition_meal_template_entries.get(id)
  if (!entry || !entry.foodId) return
  const food = await db.nutrition_foods.get(entry.foodId)
  if (!food) return
  const macros = scaleMacros(food, quantity)
  await db.nutrition_meal_template_entries.update(id, { quantity, ...macros, updatedAt: nowIso() })
}

export interface UpdateTemplateManualEntryInput {
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

export async function updateTemplateManualEntry(
  id: string,
  input: UpdateTemplateManualEntryInput,
): Promise<void> {
  const entry = await db.nutrition_meal_template_entries.get(id)
  if (!entry) return
  await db.nutrition_meal_template_entries.update(id, { ...input, updatedAt: nowIso() })
}

/** Moves a template entry to `targetSectionId` at `targetIndex` — a plain reorder when the section is unchanged, a cross-meal move otherwise. Same operation as `moveEntry`, scoped to a template instead of a date. */
export async function moveTemplateEntry(
  entryId: string,
  targetSectionId: string,
  targetIndex: number,
): Promise<void> {
  const entry = await db.nutrition_meal_template_entries.get(entryId)
  if (!entry || entry.deletedAt) return
  const templateEntries = await listTemplateEntries(entry.templateId)
  const changed = moveItem(templateEntries, entryId, targetSectionId, targetIndex)
  if (changed.length === 0) return
  const timestamp = nowIso()
  await Promise.all(
    changed.map((c) =>
      db.nutrition_meal_template_entries.update(c.id, {
        sectionId: c.sectionId,
        order: c.order,
        updatedAt: timestamp,
      }),
    ),
  )
}

/** Appends a template's entries onto `date` — never overwrites what's already logged there. */
export async function applyTemplateToDate(templateId: string, date: string): Promise<void> {
  const templateEntries = await listTemplateEntries(templateId)
  const existingBySection = new Map<string, number>()
  for (const e of await listEntriesForDate(date)) {
    existingBySection.set(e.sectionId, Math.max(existingBySection.get(e.sectionId) ?? -1, e.order))
  }
  const timestamp = nowIso()
  const newEntries: NutritionEntry[] = templateEntries.map((te) => {
    const nextOrder = (existingBySection.get(te.sectionId) ?? -1) + 1
    existingBySection.set(te.sectionId, nextOrder)
    return {
      id: generateId(),
      date,
      sectionId: te.sectionId,
      order: nextOrder,
      kind: te.kind,
      foodId: te.foodId,
      quantity: te.quantity,
      manualName: te.manualName,
      calories: te.calories,
      proteinG: te.proteinG,
      carbsG: te.carbsG,
      fatG: te.fatG,
      notes: te.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
  })
  await db.nutrition_entries.bulkAdd(newEntries)
  await syncNutritionTotalsToDailyLog(date)
}

export async function softDeleteMealTemplate(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.nutrition_meal_templates.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

// ---------------------------------------------------------------------
// Goal plans — date-ranged daily targets (calories, macros, water)
// ---------------------------------------------------------------------

export async function listGoalPlans(): Promise<NutritionGoalPlan[]> {
  const plans = await db.nutrition_goal_plans.filter((p) => p.deletedAt === null).toArray()
  return plans.sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export async function getActiveGoalPlanForDate(date: string): Promise<NutritionGoalPlan | null> {
  return findActivePlan(await listGoalPlans(), date)
}

export interface GoalPlanInput {
  name: string
  startDate: string
  endDate: string | null
  targetCalories: number
  targetProteinG: number
  targetCarbsG: number
  targetFatG: number
  targetWaterMl: number
}

export async function createGoalPlan(input: GoalPlanInput): Promise<NutritionGoalPlan> {
  const siblings = await listGoalPlans()
  const nextOrder = siblings.length ? Math.max(...siblings.map((p) => p.order)) + 1 : 0
  const timestamp = nowIso()
  const plan: NutritionGoalPlan = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.nutrition_goal_plans.add(plan)
  return plan
}

export async function updateGoalPlan(id: string, input: GoalPlanInput): Promise<void> {
  await db.nutrition_goal_plans.update(id, { ...input, updatedAt: nowIso() })
}

export async function softDeleteGoalPlan(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.nutrition_goal_plans.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}
