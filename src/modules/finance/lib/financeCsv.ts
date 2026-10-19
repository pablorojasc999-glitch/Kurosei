import { toCsv } from '../../../shared/lib/csv'
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '../domain/types'

/**
 * Todos los movimientos, del más nuevo al más viejo, con cuenta y categoría
 * por nombre y no por id: un id no le dice nada a quien abre la hoja.
 *
 * Una cuenta o categoría ya borrada sigue apareciendo en sus movimientos
 * viejos, así que se marca en vez de dejar la celda vacía.
 */
export function buildTransactionsCsv(
  transactions: FinanceTransaction[],
  accounts: FinanceAccount[],
  categories: FinanceCategory[],
): string {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  const header = ['FECHA', 'MES FINANCIERO', 'TIPO', 'CUENTA', 'CATEGORÍA', 'MONTO', 'NOTAS']
  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [
      t.date,
      t.financialMonth,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      accountName.get(t.accountId) ?? '(cuenta eliminada)',
      categoryName.get(t.categoryId) ?? '(categoría eliminada)',
      t.amount,
      t.notes,
    ])
  return toCsv(header, rows)
}
