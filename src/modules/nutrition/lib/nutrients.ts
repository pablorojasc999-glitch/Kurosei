import type { NutrientProfile } from '../domain/types'

export type MicroFieldKey = Exclude<keyof NutrientProfile, 'calories' | 'proteinG' | 'carbsG' | 'fatG'>

/** Every micronutrient tracked on a food, in display order — shared between the Biblioteca form and the food detail view. */
export const MICRO_FIELDS: Array<{ key: MicroFieldKey; label: string; unit: string }> = [
  { key: 'saturatedFatG', label: 'Grasas saturadas', unit: 'g' },
  { key: 'transFatG', label: 'Grasas trans', unit: 'g' },
  { key: 'fiberG', label: 'Fibra', unit: 'g' },
  { key: 'sugarG', label: 'Azúcares', unit: 'g' },
  { key: 'sodiumMg', label: 'Sodio', unit: 'mg' },
  { key: 'cholesterolMg', label: 'Colesterol', unit: 'mg' },
  { key: 'potassiumMg', label: 'Potasio', unit: 'mg' },
  { key: 'calciumMg', label: 'Calcio', unit: 'mg' },
  { key: 'ironMg', label: 'Hierro', unit: 'mg' },
  { key: 'magnesiumMg', label: 'Magnesio', unit: 'mg' },
  { key: 'zincMg', label: 'Zinc', unit: 'mg' },
  { key: 'vitaminAMcg', label: 'Vitamina A', unit: 'mcg' },
  { key: 'vitaminCMg', label: 'Vitamina C', unit: 'mg' },
  { key: 'vitaminDMcg', label: 'Vitamina D', unit: 'mcg' },
  { key: 'vitaminEMg', label: 'Vitamina E', unit: 'mg' },
  { key: 'vitaminKMcg', label: 'Vitamina K', unit: 'mcg' },
  { key: 'vitaminB1Mg', label: 'Vitamina B1', unit: 'mg' },
  { key: 'vitaminB2Mg', label: 'Vitamina B2', unit: 'mg' },
  { key: 'vitaminB3Mg', label: 'Vitamina B3', unit: 'mg' },
  { key: 'vitaminB6Mg', label: 'Vitamina B6', unit: 'mg' },
  { key: 'vitaminB9Mcg', label: 'Vitamina B9 / Folato', unit: 'mcg' },
  { key: 'vitaminB12Mcg', label: 'Vitamina B12', unit: 'mcg' },
]

/** One decimal everywhere a nutrient value is displayed — calories, macros and micros alike. */
export function formatNutrient(n: number): string {
  return n.toFixed(1)
}

/** Scales every field of a food's full nutrient panel (macros + micros) to `quantity` in the same unit as its `servingAmount`. Null micronutrients stay null. */
export function scaleNutrientProfile(
  food: NutrientProfile & { servingAmount: number },
  quantity: number,
): NutrientProfile {
  const factor = food.servingAmount > 0 ? quantity / food.servingAmount : 0
  const scale = (v: number | null) => (v === null ? null : v * factor)
  return {
    calories: food.calories * factor,
    proteinG: food.proteinG * factor,
    carbsG: food.carbsG * factor,
    fatG: food.fatG * factor,
    saturatedFatG: scale(food.saturatedFatG),
    transFatG: scale(food.transFatG),
    fiberG: scale(food.fiberG),
    sugarG: scale(food.sugarG),
    sodiumMg: scale(food.sodiumMg),
    cholesterolMg: scale(food.cholesterolMg),
    potassiumMg: scale(food.potassiumMg),
    calciumMg: scale(food.calciumMg),
    ironMg: scale(food.ironMg),
    magnesiumMg: scale(food.magnesiumMg),
    zincMg: scale(food.zincMg),
    vitaminAMcg: scale(food.vitaminAMcg),
    vitaminCMg: scale(food.vitaminCMg),
    vitaminDMcg: scale(food.vitaminDMcg),
    vitaminEMg: scale(food.vitaminEMg),
    vitaminKMcg: scale(food.vitaminKMcg),
    vitaminB1Mg: scale(food.vitaminB1Mg),
    vitaminB2Mg: scale(food.vitaminB2Mg),
    vitaminB3Mg: scale(food.vitaminB3Mg),
    vitaminB6Mg: scale(food.vitaminB6Mg),
    vitaminB9Mcg: scale(food.vitaminB9Mcg),
    vitaminB12Mcg: scale(food.vitaminB12Mcg),
  }
}
