import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type {
  DebtDirection,
  FinanceAccount,
  FinanceAccountKind,
  FinanceCategory,
  FinanceCategoryType,
  FinanceTransaction,
} from '../domain/types'

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
      monthlyBudget: null,
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
    monthlyBudget: null,
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
  monthlyBudget: number | null
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

export type UpdateCategoryInput = Partial<
  Pick<CreateCategoryInput, 'name' | 'emoji' | 'monthlyBudget'>
>

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<void> {
  await db.finance_categories.update(id, { ...input, updatedAt: nowIso() })
}

export async function softDeleteCategory(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.finance_categories.update(id, { deletedAt: timestamp, updatedAt: timestamp })
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

/** Sum of expense and income transactions for a calendar year. */
export async function getYearTotals(
  year: number,
): Promise<{ expense: number; income: number }> {
  const transactions = await listTransactions(year)
  return transactions.reduce(
    (totals, t) => {
      if (t.type === 'expense') totals.expense += t.amount
      else totals.income += t.amount
      return totals
    },
    { expense: 0, income: 0 },
  )
}

/** Sum of transactions per category, for a calendar year. */
export async function getCategoryTotals(year: number): Promise<Map<string, number>> {
  const transactions = await listTransactions(year)
  const totals = new Map<string, number>()
  for (const t of transactions) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
  }
  return totals
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

/** Monthly totals for one category + note combination in a calendar year — e.g. compare "Luz" spend month to month. */
export async function getCategoryNoteMonthlyTotals(
  categoryId: string,
  note: string,
  year: number,
): Promise<Array<{ month: number; total: number }>> {
  const transactions = await listTransactions(year)
  const totalsByMonth = Array.from({ length: 12 }, () => 0)
  for (const t of transactions) {
    if (t.categoryId === categoryId && t.notes.trim() === note) {
      const month = Number(t.date.slice(5, 7)) - 1
      totalsByMonth[month] += t.amount
    }
  }
  return totalsByMonth
    .map((total, month) => ({ month, total }))
    .filter((entry) => entry.total > 0)
    .reverse()
}

/** Sum of transactions per category, for a `YYYY-MM` calendar month — drives budget progress. */
export async function getCategoryTotalsForMonth(monthKey: string): Promise<Map<string, number>> {
  const transactions = await db.finance_transactions
    .filter((t) => t.deletedAt === null && t.date.startsWith(`${monthKey}-`))
    .toArray()
  const totals = new Map<string, number>()
  for (const t of transactions) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
  }
  return totals
}

/** Sum of expense and income transactions per calendar month, for a calendar year — drives simple charts. */
export async function getMonthlyTotalsForYear(
  year: number,
): Promise<Array<{ month: number; expense: number; income: number }>> {
  const transactions = await listTransactions(year)
  const totals = Array.from({ length: 12 }, (_, i) => ({ month: i, expense: 0, income: 0 }))
  for (const t of transactions) {
    const month = Number(t.date.slice(5, 7)) - 1
    if (t.type === 'expense') totals[month].expense += t.amount
    else totals[month].income += t.amount
  }
  return totals
}
