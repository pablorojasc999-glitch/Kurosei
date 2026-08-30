import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { getDailyLog } from '../../training/db/bitacoraRepository'
import {
  addFoodEntry,
  addFoodEntryToTemplate,
  addManualEntry,
  addManualEntryToTemplate,
  addWaterEntry,
  applyTemplateToDate,
  createFood,
  createGoalPlan,
  createMealSection,
  createMealTemplate,
  getActiveGoalPlanForDate,
  listEntriesForDate,
  listFoods,
  listGoalPlans,
  listMealTemplates,
  listTemplateEntries,
  listWaterEntriesForDate,
  moveEntry,
  moveTemplateEntry,
  softDeleteEntry,
  softDeleteFood,
  softDeleteGoalPlan,
  softDeleteTemplateEntry,
  softDeleteWaterEntry,
  updateFoodEntryQuantity,
  updateGoalPlan,
  updateTemplateFoodEntryQuantity,
  updateTemplateManualEntry,
} from './nutritionRepository'

const NO_MICROS = {
  saturatedFatG: null,
  transFatG: null,
  fiberG: null,
  sugarG: null,
  sodiumMg: null,
  cholesterolMg: null,
  potassiumMg: null,
  calciumMg: null,
  ironMg: null,
  magnesiumMg: null,
  zincMg: null,
  vitaminAMcg: null,
  vitaminCMg: null,
  vitaminDMcg: null,
  vitaminEMg: null,
  vitaminKMcg: null,
  vitaminB1Mg: null,
  vitaminB2Mg: null,
  vitaminB3Mg: null,
  vitaminB6Mg: null,
  vitaminB9Mcg: null,
  vitaminB12Mcg: null,
}

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => Promise.all(db.tables.map((t) => t.clear())))
})

describe('foods', () => {
  it('creates a food and lists it sorted by name', async () => {
    await createFood({
      name: 'Manzana',
      brand: '',
      emoji: '🍎',
      servingAmount: 166,
      servingUnit: 'g',
      calories: 95,
      proteinG: 0.5,
      carbsG: 23,
      fatG: 0.2,
      ...NO_MICROS,
      vitaminCMg: 8,
    })
    await createFood({
      name: 'Avena',
      brand: '',
      emoji: '🌾',
      servingAmount: 30,
      servingUnit: 'g',
      calories: 117,
      proteinG: 4,
      carbsG: 20,
      fatG: 2,
      ...NO_MICROS,
    })
    const foods = await listFoods()
    expect(foods.map((f) => f.name)).toEqual(['Avena', 'Manzana'])
    expect(foods.find((f) => f.name === 'Manzana')?.vitaminCMg).toBe(8)
  })

  it('excludes soft-deleted foods', async () => {
    const food = await createFood({
      name: 'Manzana',
      brand: '',
      emoji: '🍎',
      servingAmount: 166,
      servingUnit: 'g',
      calories: 95,
      proteinG: 0.5,
      carbsG: 23,
      fatG: 0.2,
      ...NO_MICROS,
    })
    await softDeleteFood(food.id)
    expect(await listFoods()).toEqual([])
  })
})

describe('entries', () => {
  it('computes a food entry\'s macros scaled from the food\'s per-serving values', async () => {
    const food = await createFood({
      name: 'Manzana',
      brand: '',
      emoji: '🍎',
      servingAmount: 166,
      servingUnit: 'g',
      calories: 95,
      proteinG: 0.5,
      carbsG: 23,
      fatG: 0.2,
      ...NO_MICROS,
    })
    const section = await createMealSection('Desayuno')
    const entry = await addFoodEntry({
      date: '2026-08-30',
      sectionId: section.id,
      foodId: food.id,
      quantity: 83,
      notes: '',
    })
    expect(entry.calories).toBe(47.5)
    expect(entry.carbsG).toBe(11.5)
  })

  it('re-scales macros when the quantity is updated', async () => {
    const food = await createFood({
      name: 'Avena',
      brand: '',
      emoji: '🌾',
      servingAmount: 30,
      servingUnit: 'g',
      calories: 120,
      proteinG: 4,
      carbsG: 20,
      fatG: 2,
      ...NO_MICROS,
    })
    const section = await createMealSection('Desayuno')
    const entry = await addFoodEntry({
      date: '2026-08-30',
      sectionId: section.id,
      foodId: food.id,
      quantity: 30,
      notes: '',
    })
    await updateFoodEntryQuantity(entry.id, 60)
    const [updated] = await listEntriesForDate('2026-08-30')
    expect(updated.calories).toBe(240)
    expect(updated.quantity).toBe(60)
  })

  it('adds a manual entry with hand-typed macros, no linked food', async () => {
    const section = await createMealSection('Almuerzo')
    const entry = await addManualEntry({
      date: '2026-08-30',
      sectionId: section.id,
      manualName: 'Almuerzo restaurante X',
      calories: 800,
      proteinG: 40,
      carbsG: 90,
      fatG: 25,
      notes: '',
    })
    expect(entry.foodId).toBeNull()
    expect(entry.calories).toBe(800)
  })

  it('writes the day totals through to the daily bitácora log', async () => {
    const section = await createMealSection('Almuerzo')
    await addManualEntry({
      date: '2026-08-30',
      sectionId: section.id,
      manualName: 'Almuerzo restaurante X',
      calories: 800,
      proteinG: 40,
      carbsG: 90,
      fatG: 25,
      notes: '',
    })
    const log = await getDailyLog('2026-08-30')
    expect(log?.calories).toBe(800)
    expect(log?.proteinG).toBe(40)
  })

  it('excludes a soft-deleted entry from the day total', async () => {
    const section = await createMealSection('Almuerzo')
    const entry = await addManualEntry({
      date: '2026-08-30',
      sectionId: section.id,
      manualName: 'Almuerzo restaurante X',
      calories: 800,
      proteinG: 40,
      carbsG: 90,
      fatG: 25,
      notes: '',
    })
    await softDeleteEntry(entry.id)
    expect(await listEntriesForDate('2026-08-30')).toEqual([])
    const log = await getDailyLog('2026-08-30')
    expect(log?.calories).toBe(0)
  })

  it('moves an entry to a different section', async () => {
    const breakfast = await createMealSection('Desayuno')
    const lunch = await createMealSection('Almuerzo')
    const entry = await addManualEntry({
      date: '2026-08-30',
      sectionId: breakfast.id,
      manualName: 'Algo',
      calories: 100,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
      notes: '',
    })
    await moveEntry(entry.id, lunch.id, 0)
    const [moved] = await listEntriesForDate('2026-08-30')
    expect(moved.sectionId).toBe(lunch.id)
    expect(moved.order).toBe(0)
  })
})

describe('water', () => {
  it('logs a free-form amount and sums the day total', async () => {
    await addWaterEntry('2026-08-30', 293)
    await addWaterEntry('2026-08-30', 1301)
    const entries = await listWaterEntriesForDate('2026-08-30')
    expect(entries).toHaveLength(2)
    const log = await getDailyLog('2026-08-30')
    expect(log?.waterLiters).toBeCloseTo(1.594)
  })

  it('excludes a soft-deleted water entry from the day total', async () => {
    const entry = await addWaterEntry('2026-08-30', 500)
    await softDeleteWaterEntry(entry.id)
    const log = await getDailyLog('2026-08-30')
    expect(log?.waterLiters).toBe(0)
  })
})

describe('meal templates', () => {
  it('builds a template from scratch (food + manual entries) and applies it onto a date, appending after what is already there', async () => {
    const section = await createMealSection('Desayuno')
    const food = await createFood({
      name: 'Avena',
      brand: '',
      emoji: '🌾',
      servingAmount: 30,
      servingUnit: 'g',
      calories: 120,
      proteinG: 4,
      carbsG: 20,
      fatG: 2,
      ...NO_MICROS,
    })

    const template = await createMealTemplate('Día de entrenamiento', '🏋️')
    expect((await listMealTemplates()).map((t) => t.name)).toEqual(['Día de entrenamiento'])

    await addFoodEntryToTemplate({
      templateId: template.id,
      sectionId: section.id,
      foodId: food.id,
      quantity: 60,
      notes: '',
    })
    await addManualEntryToTemplate({
      templateId: template.id,
      sectionId: section.id,
      manualName: 'Leche',
      calories: 60,
      proteinG: 3,
      carbsG: 5,
      fatG: 2,
      notes: '',
    })
    const templateEntries = await listTemplateEntries(template.id)
    expect(templateEntries.map((e) => e.manualName || 'Avena')).toEqual(['Avena', 'Leche'])
    expect(templateEntries[0].calories).toBe(240) // scaled 30g -> 60g

    // the target date already has something logged, in the same section
    await addManualEntry({
      date: '2026-08-15',
      sectionId: section.id,
      manualName: 'Café',
      calories: 5,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      notes: '',
    })

    await applyTemplateToDate(template.id, '2026-08-15')
    const entries = await listEntriesForDate('2026-08-15')
    expect(entries.map((e) => e.manualName || 'Avena')).toEqual(['Café', 'Avena', 'Leche'])
    const log = await getDailyLog('2026-08-15')
    expect(log?.calories).toBe(305) // 5 + 240 + 60

    await softDeleteTemplateEntry(templateEntries[1].id)
    expect(await listTemplateEntries(template.id)).toHaveLength(1)
  })

  it('re-scales a template food entry when its quantity is edited', async () => {
    const section = await createMealSection('Desayuno')
    const food = await createFood({
      name: 'Avena',
      brand: '',
      emoji: '🌾',
      servingAmount: 30,
      servingUnit: 'g',
      calories: 120,
      proteinG: 4,
      carbsG: 20,
      fatG: 2,
      ...NO_MICROS,
    })
    const template = await createMealTemplate('Bloque', '')
    const entry = await addFoodEntryToTemplate({
      templateId: template.id,
      sectionId: section.id,
      foodId: food.id,
      quantity: 30,
      notes: '',
    })

    await updateTemplateFoodEntryQuantity(entry.id, 60)
    const [updated] = await listTemplateEntries(template.id)
    expect(updated.quantity).toBe(60)
    expect(updated.calories).toBe(240)
  })

  it('overwrites a template manual entry in place when edited', async () => {
    const section = await createMealSection('Desayuno')
    const template = await createMealTemplate('Bloque', '')
    const entry = await addManualEntryToTemplate({
      templateId: template.id,
      sectionId: section.id,
      manualName: 'Batido',
      calories: 200,
      proteinG: 20,
      carbsG: 10,
      fatG: 5,
      notes: '',
    })

    await updateTemplateManualEntry(entry.id, {
      manualName: 'Batido de proteína',
      calories: 250,
      proteinG: 30,
      carbsG: 10,
      fatG: 6,
      notes: '',
    })
    const [updated] = await listTemplateEntries(template.id)
    expect(updated.manualName).toBe('Batido de proteína')
    expect(updated.calories).toBe(250)
  })

  it('moves a template entry to a different section', async () => {
    const breakfast = await createMealSection('Desayuno')
    const lunch = await createMealSection('Almuerzo')
    const template = await createMealTemplate('Bloque', '')
    const entry = await addManualEntryToTemplate({
      templateId: template.id,
      sectionId: breakfast.id,
      manualName: 'Algo',
      calories: 100,
      proteinG: 1,
      carbsG: 1,
      fatG: 1,
      notes: '',
    })

    await moveTemplateEntry(entry.id, lunch.id, 0)
    const [moved] = await listTemplateEntries(template.id)
    expect(moved.sectionId).toBe(lunch.id)
    expect(moved.order).toBe(0)
  })
})

describe('goal plans', () => {
  const baseInput = {
    name: 'Volumen',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    targetCalories: 2500,
    targetProteinG: 180,
    targetCarbsG: 300,
    targetFatG: 70,
    targetWaterMl: 3000,
  }

  it('creates a plan and lists it newest-startDate-first', async () => {
    await createGoalPlan(baseInput)
    await createGoalPlan({ ...baseInput, name: 'Corte', startDate: '2026-02-01', endDate: null })
    const plans = await listGoalPlans()
    expect(plans.map((p) => p.name)).toEqual(['Corte', 'Volumen'])
  })

  it('resolves the active plan for a date within its range, null outside it', async () => {
    const plan = await createGoalPlan(baseInput)
    expect((await getActiveGoalPlanForDate('2026-01-15'))?.id).toBe(plan.id)
    expect(await getActiveGoalPlanForDate('2026-02-15')).toBeNull()
  })

  it('updates a plan in place', async () => {
    const plan = await createGoalPlan(baseInput)
    await updateGoalPlan(plan.id, { ...baseInput, targetCalories: 2200 })
    const [updated] = await listGoalPlans()
    expect(updated.targetCalories).toBe(2200)
  })

  it('excludes a soft-deleted plan', async () => {
    const plan = await createGoalPlan(baseInput)
    await softDeleteGoalPlan(plan.id)
    expect(await listGoalPlans()).toEqual([])
  })
})
