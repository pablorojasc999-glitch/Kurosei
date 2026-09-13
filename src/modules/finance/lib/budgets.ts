import type { FinanceCategoryBudget } from '../domain/types'

/**
 * El presupuesto vigente de cada categoría en un mes: de todas las vigencias de
 * esa categoría, la más reciente que no sea posterior al mes que se mira.
 *
 * Así un presupuesto puesto en marzo sigue rigiendo en abril, mayo y lo que
 * venga, hasta que se ponga otro — y ponerlo en septiembre no toca lo que
 * regía en agosto, porque agosto sigue leyendo la vigencia de marzo.
 */
export function budgetsForMonth(
  budgets: FinanceCategoryBudget[],
  monthKey: string,
): Map<string, number> {
  const chosen = new Map<string, FinanceCategoryBudget>()
  for (const budget of budgets) {
    if (budget.effectiveFrom > monthKey) continue
    const current = chosen.get(budget.categoryId)
    if (!current || budget.effectiveFrom > current.effectiveFrom) {
      chosen.set(budget.categoryId, budget)
    }
  }
  return new Map([...chosen].map(([categoryId, budget]) => [categoryId, budget.amount]))
}

/** El presupuesto vigente de una categoría en un mes, o `null` si no hay. */
export function budgetForMonth(
  budgets: FinanceCategoryBudget[],
  categoryId: string,
  monthKey: string,
): number | null {
  return budgetsForMonth(budgets, monthKey).get(categoryId) ?? null
}

/**
 * Si el monto que se guardaría en este mes cambiaría algo. Sirve para no
 * escribir una vigencia nueva que repite lo que ya regía.
 */
export function budgetChangesAnything(
  budgets: FinanceCategoryBudget[],
  categoryId: string,
  monthKey: string,
  amount: number | null,
): boolean {
  return budgetForMonth(budgets, categoryId, monthKey) !== amount
}
