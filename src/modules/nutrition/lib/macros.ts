export interface MacroTotals {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

/** Scales a food's per-serving macros to `quantity` in the same unit as its `servingAmount`. */
export function scaleMacros(
  perServing: MacroTotals & { servingAmount: number },
  quantity: number,
): MacroTotals {
  const factor = perServing.servingAmount > 0 ? quantity / perServing.servingAmount : 0
  return {
    calories: perServing.calories * factor,
    proteinG: perServing.proteinG * factor,
    carbsG: perServing.carbsG * factor,
    fatG: perServing.fatG * factor,
  }
}

/** Sums macros across any list of entries (or template entries). */
export function sumMacros(items: MacroTotals[]): MacroTotals {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      proteinG: sum.proteinG + item.proteinG,
      carbsG: sum.carbsG + item.carbsG,
      fatG: sum.fatG + item.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}
