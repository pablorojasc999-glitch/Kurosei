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
}

export async function createAccount(input: CreateAccountInput): Promise<FinanceAccount> {
  const siblings = await listAccounts(input.kind)
  const nextOrder = siblings.length ? Math.max(...siblings.map((a) => a.order)) + 1 : 0
  const timestamp = nowIso()
  const account: FinanceAccount = {
    id: generateId(),
    ...input,
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
}

export async function softDeleteAccount(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.finance_accounts.update(id, { deletedAt: timestamp, updatedAt: timestamp })
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
