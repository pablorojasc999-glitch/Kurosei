import type { FinanceCategory } from '../domain/types'

/**
 * El orden de la grilla de categorías: primero todos los gastos juntos, de
 * mayor a menor presupuesto, y después los ingresos.
 *
 * Se ordena acá y no en el repositorio a propósito: `listCategories` respeta el
 * `order` que la persona eligió, y eso es lo que necesita el selector de una
 * transacción. Esto es cómo se mira la grilla, no cómo están guardadas.
 */
export function sortCategoriesForGrid(categories: FinanceCategory[]): FinanceCategory[] {
  return [...categories].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'expense' ? -1 : 1
    // Los ingresos no tienen presupuesto: se quedan como la persona los ordenó.
    if (a.type === 'income') return a.order - b.order

    // Sin presupuesto va después de un presupuesto de 0: poner 0 es decir algo,
    // no ponerlo es no haberlo decidido todavía.
    const budgetA = a.monthlyBudget ?? -1
    const budgetB = b.monthlyBudget ?? -1
    if (budgetA !== budgetB) return budgetB - budgetA
    return a.name.localeCompare(b.name, 'es')
  })
}

/** Lo presupuestado al mes, sumando los gastos que tienen presupuesto puesto. */
export function totalMonthlyBudget(categories: FinanceCategory[]): number {
  return categories.reduce(
    (total, category) =>
      category.type === 'expense' && category.monthlyBudget !== null
        ? total + category.monthlyBudget
        : total,
    0,
  )
}
