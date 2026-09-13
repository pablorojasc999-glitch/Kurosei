import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type {
  DebtDirection,
  FinanceAccount,
  FinanceAccountKind,
  FinanceCategory,
  FinanceCategoryBudget,
  FinanceCategoryType,
  FinanceTransaction,
} from '../domain/types'
import { budgetForMonth } from '../lib/budgets'

// ---------------------------------------------------------------------
// Accounts (incl. debts)
// ---------------------------------------------------------------------

export async function listAccounts(kind?: FinanceAccountKind): Promise<FinanceAccount[]> {
  const accounts = await db.finance_accounts
    .filter((a) => a.deletedAt === null && (kind === undefined || a.kind === kind))
    .sortBy('order')
  return accounts
}

export interface CreateAccountInput {
  name: string
  emoji: string
  kind: FinanceAccountKind
  debtDirection: DebtDirection | null
  debtAmount: number | null
  /** Only meaningful when `kind` is `debt`; irrelevant (pass `false`) for a plain account. */
  revolving: boolean
}

/** Type of the auto-created category that tracks payments toward/against a debt, given its direction. */
function debtCategoryType(debtDirection: DebtDirection): FinanceCategoryType {
  return debtDirection === 'owed_to_me' ? 'income' : 'expense'
}

export async function createAccount(input: CreateAccountInput): Promise<FinanceAccount> {
  const siblings = await listAccounts(input.kind)
  const nextOrder = siblings.length ? Math.max(...siblings.map((a) => a.order)) + 1 : 0
  const timestamp = nowIso()
  let categoryId: string | null = null
  if (input.kind === 'debt' && input.debtDirection) {
    const category = await createCategory({
      name: input.name,
      emoji: input.emoji,
      type: debtCategoryType(input.debtDirection),
    })
    categoryId = category.id
  }
  const account: FinanceAccount = {
    id: generateId(),
    ...input,
    categoryId,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.finance_accounts.add(account)
  return account
}

export type UpdateAccountInput = Partial<CreateAccountInput>

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<void> {
  await db.finance_accounts.update(id, { ...input, updatedAt: nowIso() })
  if (input.name !== undefined || input.emoji !== undefined) {
    const account = await db.finance_accounts.get(id)
    if (account?.categoryId) {
      await updateCategory(account.categoryId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
      })
    }
  }
}

export async function softDeleteAccount(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.finance_accounts.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/** Links a legacy debt (created before payments were tracked via a category) to a freshly-created one. */
export async function ensureDebtCategoryId(debt: FinanceAccount): Promise<string> {
  if (debt.categoryId) return debt.categoryId
  const category = await createCategory({
    name: debt.name,
    emoji: debt.emoji,
    type: debtCategoryType(debt.debtDirection ?? 'i_owe'),
  })
  await db.finance_accounts.update(debt.id, { categoryId: category.id, updatedAt: nowIso() })
  return category.id
}

/** Sum of every (non-deleted) transaction posted to a category, across all time. */
export async function getCategoryTotal(categoryId: string): Promise<number> {
  const transactions = await db.finance_transactions
    .where('categoryId')
    .equals(categoryId)
    .filter((t) => t.deletedAt === null)
    .toArray()
  return transactions.reduce((sum, t) => sum + t.amount, 0)
}

/** How much of a debt's stated amount has been paid off, and what's left — via its linked category's transactions. */
export async function getDebtProgress(
  debt: FinanceAccount,
): Promise<{ paid: number; remaining: number; percent: number }> {
  if (!debt.categoryId || !debt.debtAmount) return { paid: 0, remaining: debt.debtAmount ?? 0, percent: 0 }
  const paid = await getCategoryTotal(debt.categoryId)
  const remaining = Math.max(0, debt.debtAmount - paid)
  const percent = Math.min(100, Math.round((paid / debt.debtAmount) * 100))
  return { paid, remaining, percent }
}

/**
 * Once a fixed debt's linked category covers its full amount, archive it — its category
 * and transaction history stay untouched. A `revolving` debt (credit card, line of credit)
 * never auto-archives: hitting $0 owed just means it's paid off for now, not closed.
 */
export async function archiveDebtIfPaid(accountId: string): Promise<void> {
  const account = await db.finance_accounts.get(accountId)
  if (!account || account.kind !== 'debt' || !account.categoryId || account.deletedAt) return
  if (account.revolving) return
  const { percent } = await getDebtProgress(account)
  if (percent >= 100) await softDeleteAccount(account.id)
}

/** An account's balance, derived from its transactions (income minus expense) — never stored. */
export async function getAccountBalance(accountId: string): Promise<number> {
  const transactions = await db.finance_transactions
    .where('accountId')
    .equals(accountId)
    .filter((t) => t.deletedAt === null)
    .toArray()
  return transactions.reduce(
    (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
    0,
  )
}

/** Sum of every real (non-debt) account's balance. */
export async function getAccountsTotalBalance(): Promise<number> {
  const accounts = await listAccounts('account')
  const balances = await Promise.all(accounts.map((a) => getAccountBalance(a.id)))
  return balances.reduce((sum, b) => sum + b, 0)
}

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

export async function listCategories(type?: FinanceCategoryType): Promise<FinanceCategory[]> {
  return db.finance_categories
    .filter((c) => c.deletedAt === null && (type === undefined || c.type === type))
    .sortBy('order')
}

export interface CreateCategoryInput {
  name: string
  emoji: string
  type: FinanceCategoryType
}

export async function createCategory(input: CreateCategoryInput): Promise<FinanceCategory> {
  const siblings = await listCategories(input.type)
  const nextOrder = siblings.length ? Math.max(...siblings.map((c) => c.order)) + 1 : 0
  const timestamp = nowIso()
  const category: FinanceCategory = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.finance_categories.add(category)
  return category
}

export type UpdateCategoryInput = Partial<Pick<CreateCategoryInput, 'name' | 'emoji'>>

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<void> {
  await db.finance_categories.update(id, { ...input, updatedAt: nowIso() })
}

export async function softDeleteCategory(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.transaction('rw', db.finance_categories, db.finance_category_budgets, async () => {
    await db.finance_categories.update(id, { deletedAt: timestamp, updatedAt: timestamp })
    // Sus vigencias se van con ella: si no, volver a crear una categoría con el
    // mismo id heredaría presupuestos de otra vida.
    await db.finance_category_budgets
      .filter((b) => b.categoryId === id && b.deletedAt === null)
      .modify({ deletedAt: timestamp, updatedAt: timestamp })
  })
}

// ---------------------------------------------------------------------
// Presupuestos con vigencia
// ---------------------------------------------------------------------

export async function listCategoryBudgets(): Promise<FinanceCategoryBudget[]> {
  return db.finance_category_budgets.filter((b) => b.deletedAt === null).toArray()
}

/**
 * Deja `amount` como presupuesto de la categoría a partir de `effectiveFrom`.
 * Los meses anteriores no se tocan: siguen leyendo la vigencia que tenían.
 *
 * Con `amount` en `null` se borra la vigencia de ese mes exacto, y vuelve a
 * regir la anterior. Para decir "desde acá no presupuesto nada" se pone 0, que
 * es un presupuesto de verdad y no la ausencia de uno.
 */
export async function setCategoryBudget(
  categoryId: string,
  effectiveFrom: string,
  amount: number | null,
): Promise<void> {
  const timestamp = nowIso()
  const existing = (await listCategoryBudgets()).find(
    (b) => b.categoryId === categoryId && b.effectiveFrom === effectiveFrom,
  )

  if (amount === null) {
    if (existing) {
      await db.finance_category_budgets.update(existing.id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
      })
    }
    return
  }

  if (existing) {
    await db.finance_category_budgets.update(existing.id, { amount, updatedAt: timestamp })
    return
  }

  await db.finance_category_budgets.add({
    id: generateId(),
    categoryId,
    effectiveFrom,
    amount,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
}

/** El presupuesto que rige para una categoría en un mes. */
export async function getCategoryBudgetForMonth(
  categoryId: string,
  monthKey: string,
): Promise<number | null> {
  return budgetForMonth(await listCategoryBudgets(), categoryId, monthKey)
}

// ---------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------

export async function listTransactions(year?: number): Promise<FinanceTransaction[]> {
  const transactions = await db.finance_transactions
    .filter(
      (t) =>
        t.deletedAt === null && (year === undefined || t.date.startsWith(`${year}-`)),
    )
    .toArray()
  return transactions.sort((a, b) => b.date.localeCompare(a.date))
}

export interface CreateTransactionInput {
  accountId: string
  categoryId: string
  type: FinanceCategoryType
  amount: number
  date: string
  /** `YYYY-MM` al que se imputa. Por defecto el mes de `date`. */
  financialMonth: string
  notes: string
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<FinanceTransaction> {
  const timestamp = nowIso()
  const transaction: FinanceTransaction = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.finance_transactions.add(transaction)
  return transaction
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<void> {
  await db.finance_transactions.update(id, { ...input, updatedAt: nowIso() })
}

export async function softDeleteTransaction(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.finance_transactions.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/**
 * Las transacciones imputadas a un mes financiero. Ojo con la diferencia: la
 * lista de movimientos filtra por `date`, que es cuando se movió la plata; todo
 * lo que se suma filtra por acá, que es a qué mes decidiste que pertenece.
 */
export async function listTransactionsForMonth(
  monthKey: string,
): Promise<FinanceTransaction[]> {
  const transactions = await db.finance_transactions
    .filter((t) => t.deletedAt === null && t.financialMonth === monthKey)
    .toArray()
  return transactions.sort((a, b) => b.date.localeCompare(a.date))
}

/** Las transacciones cuyo mes financiero cae en un año. */
export async function listTransactionsForFinancialYear(
  year: number,
): Promise<FinanceTransaction[]> {
  const transactions = await db.finance_transactions
    .filter((t) => t.deletedAt === null && t.financialMonth.startsWith(`${year}-`))
    .toArray()
  return transactions.sort((a, b) => b.date.localeCompare(a.date))
}

function sumByType(transactions: FinanceTransaction[]): { expense: number; income: number } {
  return transactions.reduce(
    (totals, t) => {
      if (t.type === 'expense') totals.expense += t.amount
      else totals.income += t.amount
      return totals
    },
    { expense: 0, income: 0 },
  )
}

function sumByCategory(transactions: FinanceTransaction[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
  }
  return totals
}

/** Gastos e ingresos de un mes financiero. */
export async function getMonthTotals(
  monthKey: string,
): Promise<{ expense: number; income: number }> {
  return sumByType(await listTransactionsForMonth(monthKey))
}

/** Gastos e ingresos de un año, contando por mes financiero. */
export async function getYearTotals(
  year: number,
): Promise<{ expense: number; income: number }> {
  return sumByType(await listTransactionsForFinancialYear(year))
}

/** Total por categoría de un mes financiero — es lo que mide el presupuesto. */
export async function getCategoryTotalsForMonth(monthKey: string): Promise<Map<string, number>> {
  return sumByCategory(await listTransactionsForMonth(monthKey))
}

/** Total por categoría de un año, contando por mes financiero. */
export async function getCategoryTotals(year: number): Promise<Map<string, number>> {
  return sumByCategory(await listTransactionsForFinancialYear(year))
}

/** Distinct non-empty notes used within a category — the free-text sub-labels (e.g. "Luz", "Gas") a user has typed for it. */
export async function listNotesForCategory(categoryId: string): Promise<string[]> {
  const transactions = await db.finance_transactions
    .filter((t) => t.deletedAt === null && t.categoryId === categoryId && t.notes.trim() !== '')
    .toArray()
  return Array.from(new Set(transactions.map((t) => t.notes.trim()))).sort((a, b) =>
    a.localeCompare(b),
  )
}

/** Totales mes a mes de una categoría + nota en un año — p. ej. comparar "Luz". */
export async function getCategoryNoteMonthlyTotals(
  categoryId: string,
  note: string,
  year: number,
): Promise<Array<{ month: number; total: number }>> {
  const transactions = await listTransactionsForFinancialYear(year)
  const totalsByMonth = Array.from({ length: 12 }, () => 0)
  for (const t of transactions) {
    if (t.categoryId === categoryId && t.notes.trim() === note) {
      totalsByMonth[Number(t.financialMonth.slice(5, 7)) - 1] += t.amount
    }
  }
  return totalsByMonth
    .map((total, month) => ({ month, total }))
    .filter((entry) => entry.total > 0)
    .reverse()
}

/** Gastos e ingresos por mes financiero de un año — alimenta los gráficos. */
export async function getMonthlyTotalsForYear(
  year: number,
): Promise<Array<{ month: number; expense: number; income: number }>> {
  const transactions = await listTransactionsForFinancialYear(year)
  const totals = Array.from({ length: 12 }, (_, i) => ({ month: i, expense: 0, income: 0 }))
  for (const t of transactions) {
    const month = Number(t.financialMonth.slice(5, 7)) - 1
    if (t.type === 'expense') totals[month].expense += t.amount
    else totals[month].income += t.amount
  }
  return totals
}
