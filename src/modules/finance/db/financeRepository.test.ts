import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  archiveDebtIfPaid,
  createAccount,
  createCategory,
  createTransaction,
  ensureDebtCategoryId,
  getAccountBalance,
  getAccountsTotalBalance,
  getCategoryNoteMonthlyTotals,
  getCategoryTotals,
  getCategoryTotalsForMonth,
  getDebtProgress,
  getMonthlyTotalsForYear,
  getYearTotals,
  listAccounts,
  listCategories,
  listNotesForCategory,
  listTransactions,
  softDeleteAccount,
  softDeleteCategory,
  softDeleteTransaction,
  updateAccount,
  updateCategory,
} from './financeRepository'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.tables,
    async () => Promise.all(db.tables.map((table) => table.clear())),
  )
})

describe('accounts', () => {
  it('assigns increasing order scoped per kind', async () => {
    const cash = await createAccount({
      name: 'Efectivo',
      emoji: '💵',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const bank = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const debt = await createAccount({
      name: 'CAE',
      emoji: '🎓',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 500000,
      revolving: false,
    })

    expect(cash.order).toBe(0)
    expect(bank.order).toBe(1)
    expect(debt.order).toBe(0)

    const accounts = await listAccounts('account')
    expect(accounts.map((a) => a.id)).toEqual([cash.id, bank.id])
    const debts = await listAccounts('debt')
    expect(debts.map((a) => a.id)).toEqual([debt.id])
  })

  it('excludes soft-deleted accounts from listAccounts', async () => {
    const account = await createAccount({
      name: 'Efectivo',
      emoji: '💵',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    await softDeleteAccount(account.id)
    expect(await listAccounts('account')).toEqual([])
  })

  it('updates a debt amount', async () => {
    const debt = await createAccount({
      name: 'Tarjeta',
      emoji: '💳',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 100000,
      revolving: false,
    })
    await updateAccount(debt.id, { debtAmount: 80000 })
    const [updated] = await listAccounts('debt')
    expect(updated.debtAmount).toBe(80000)
  })
})

describe('getAccountBalance / getAccountsTotalBalance', () => {
  it('derives balance from income minus expense transactions on that account', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const salary = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    const groceries = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
      monthlyBudget: null,
    })

    await createTransaction({
      accountId: account.id,
      categoryId: salary.id,
      type: 'income',
      amount: 500000,
      date: '2026-08-01',
      notes: '',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 38140,
      date: '2026-08-21',
      notes: '',
    })

    expect(await getAccountBalance(account.id)).toBe(500000 - 38140)
  })

  it('ignores debt accounts in the accounts total (no transactions posted to them)', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    await createAccount({
      name: 'CAE',
      emoji: '🎓',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 500000,
      revolving: false,
    })
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    await createTransaction({
      accountId: account.id,
      categoryId: category.id,
      type: 'income',
      amount: 100000,
      date: '2026-08-01',
      notes: '',
    })

    expect(await getAccountsTotalBalance()).toBe(100000)
  })

  it('excludes soft-deleted transactions from the balance', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    const tx = await createTransaction({
      accountId: account.id,
      categoryId: category.id,
      type: 'income',
      amount: 100000,
      date: '2026-08-01',
      notes: '',
    })
    await softDeleteTransaction(tx.id)

    expect(await getAccountBalance(account.id)).toBe(0)
  })
})

describe('categories', () => {
  it('lists categories filtered by type, ordered', async () => {
    await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    await createCategory({ name: 'Supermercado', emoji: '🛒', type: 'expense', monthlyBudget: null })
    const income = await listCategories('income')
    const expense = await listCategories('expense')
    expect(income.map((c) => c.name)).toEqual(['Sueldo'])
    expect(expense.map((c) => c.name)).toEqual(['Supermercado'])
  })

  it('excludes soft-deleted categories', async () => {
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    await softDeleteCategory(category.id)
    expect(await listCategories()).toEqual([])
  })

  it('sets and updates a monthly budget', async () => {
    const category = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
      monthlyBudget: 100000,
    })
    expect(category.monthlyBudget).toBe(100000)
    await updateCategory(category.id, { monthlyBudget: 120000 })
    const [updated] = await listCategories('expense')
    expect(updated.monthlyBudget).toBe(120000)
  })
})

describe('getYearTotals / getCategoryTotals', () => {
  it('sums transactions by type and by category, scoped to the given year', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const salary = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    const groceries = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
      monthlyBudget: null,
    })

    await createTransaction({
      accountId: account.id,
      categoryId: salary.id,
      type: 'income',
      amount: 500000,
      date: '2026-08-01',
      notes: '',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 38140,
      date: '2026-08-21',
      notes: '',
    })
    // out of range year, must be excluded
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 999,
      date: '2025-12-31',
      notes: '',
    })

    const totals = await getYearTotals(2026)
    expect(totals).toEqual({ expense: 38140, income: 500000 })

    const categoryTotals = await getCategoryTotals(2026)
    expect(categoryTotals.get(salary.id)).toBe(500000)
    expect(categoryTotals.get(groceries.id)).toBe(38140)
  })
})

describe('listTransactions', () => {
  it('sorts newest first', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    const older = await createTransaction({
      accountId: account.id,
      categoryId: category.id,
      type: 'income',
      amount: 1,
      date: '2026-08-01',
      notes: '',
    })
    const newer = await createTransaction({
      accountId: account.id,
      categoryId: category.id,
      type: 'income',
      amount: 1,
      date: '2026-08-21',
      notes: '',
    })

    const transactions = await listTransactions()
    expect(transactions.map((t) => t.id)).toEqual([newer.id, older.id])
  })
})

describe('getCategoryTotalsForMonth', () => {
  it('sums transactions for a category, scoped to the given YYYY-MM', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const groceries = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
      monthlyBudget: 100000,
    })
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 30000,
      date: '2026-08-05',
      notes: '',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 20000,
      date: '2026-08-20',
      notes: '',
    })
    // different month, must be excluded
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 999,
      date: '2026-07-31',
      notes: '',
    })

    const totals = await getCategoryTotalsForMonth('2026-08')
    expect(totals.get(groceries.id)).toBe(50000)
  })
})

describe('listNotesForCategory / getCategoryNoteMonthlyTotals', () => {
  it('lists distinct non-empty notes and sums them per month, most recent first', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const vivienda = await createCategory({
      name: 'Vivienda',
      emoji: '🏠',
      type: 'expense',
      monthlyBudget: null,
    })
    await createTransaction({
      accountId: account.id,
      categoryId: vivienda.id,
      type: 'expense',
      amount: 12300,
      date: '2026-08-29',
      notes: 'Luz',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: vivienda.id,
      type: 'expense',
      amount: 11000,
      date: '2026-08-15',
      notes: 'Luz',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: vivienda.id,
      type: 'expense',
      amount: 13000,
      date: '2026-07-10',
      notes: 'Luz',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: vivienda.id,
      type: 'expense',
      amount: 55820,
      date: '2026-08-29',
      notes: 'GGCC',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: vivienda.id,
      type: 'expense',
      amount: 999,
      date: '2026-08-01',
      notes: '',
    })

    expect(await listNotesForCategory(vivienda.id)).toEqual(['GGCC', 'Luz'])

    const luzByMonth = await getCategoryNoteMonthlyTotals(vivienda.id, 'Luz', 2026)
    expect(luzByMonth).toEqual([
      { month: 7, total: 23300 },
      { month: 6, total: 13000 },
    ])
  })

  it('returns an empty list when the category has no notes at all', async () => {
    const category = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
      monthlyBudget: null,
    })
    expect(await listNotesForCategory(category.id)).toEqual([])
  })
})

describe('debt accounts auto-link a payment-tracking category', () => {
  it('creates an income category for an "owed_to_me" debt and links it', async () => {
    const debt = await createAccount({
      name: 'Álvaro',
      emoji: '👤',
      kind: 'debt',
      debtDirection: 'owed_to_me',
      debtAmount: 100000,
      revolving: false,
    })
    expect(debt.categoryId).not.toBeNull()
    const [category] = await listCategories('income')
    expect(category.id).toBe(debt.categoryId)
    expect(category.name).toBe('Álvaro')
    expect(category.emoji).toBe('👤')
  })

  it('creates an expense category for an "i_owe" debt', async () => {
    const debt = await createAccount({
      name: 'Tarjeta',
      emoji: '💳',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 50000,
      revolving: false,
    })
    const [category] = await listCategories('expense')
    expect(category.id).toBe(debt.categoryId)
  })

  it('leaves categoryId null for a plain account', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    expect(account.categoryId).toBeNull()
  })

  it('renaming a debt also renames its linked category', async () => {
    const debt = await createAccount({
      name: 'Álvaro',
      emoji: '👤',
      kind: 'debt',
      debtDirection: 'owed_to_me',
      debtAmount: 100000,
      revolving: false,
    })
    await updateAccount(debt.id, { name: 'Alvarito', emoji: '🧑' })
    const [category] = await listCategories('income')
    expect(category.name).toBe('Alvarito')
    expect(category.emoji).toBe('🧑')
  })

  it('ensureDebtCategoryId backfills a legacy debt that has no category yet', async () => {
    const debt = await createAccount({
      name: 'Paula',
      emoji: '👤',
      kind: 'debt',
      debtDirection: 'owed_to_me',
      debtAmount: 20000,
      revolving: false,
    })
    // simulate data created before this field existed
    await db.finance_accounts.update(debt.id, { categoryId: null })

    const categoryId = await ensureDebtCategoryId({ ...debt, categoryId: null })
    expect(categoryId).toBeTruthy()
    const updated = await db.finance_accounts.get(debt.id)
    expect(updated?.categoryId).toBe(categoryId)

    // calling it again with the now-linked debt is a no-op
    const again = await ensureDebtCategoryId({ ...debt, categoryId })
    expect(again).toBe(categoryId)
  })
})

describe('getDebtProgress / archiveDebtIfPaid', () => {
  it('tracks payoff progress from transactions posted to the debt\'s category, capped at 100%', async () => {
    const bank = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const debt = await createAccount({
      name: 'Álvaro',
      emoji: '👤',
      kind: 'debt',
      debtDirection: 'owed_to_me',
      debtAmount: 10000,
      revolving: false,
    })
    expect(await getDebtProgress(debt)).toEqual({ paid: 0, remaining: 10000, percent: 0 })

    await createTransaction({
      accountId: bank.id,
      categoryId: debt.categoryId as string,
      type: 'income',
      amount: 4000,
      date: '2026-08-01',
      notes: '',
    })
    expect(await getDebtProgress(debt)).toEqual({ paid: 4000, remaining: 6000, percent: 40 })

    // overpaying caps the percent at 100 and clamps remaining at 0
    await createTransaction({
      accountId: bank.id,
      categoryId: debt.categoryId as string,
      type: 'income',
      amount: 8000,
      date: '2026-08-15',
      notes: '',
    })
    expect(await getDebtProgress(debt)).toEqual({ paid: 12000, remaining: 0, percent: 100 })
  })

  it('archives a debt once fully paid, keeping its category and transactions', async () => {
    const bank = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const debt = await createAccount({
      name: 'Paula',
      emoji: '👤',
      kind: 'debt',
      debtDirection: 'owed_to_me',
      debtAmount: 5000,
      revolving: false,
    })
    await createTransaction({
      accountId: bank.id,
      categoryId: debt.categoryId as string,
      type: 'income',
      amount: 5000,
      date: '2026-08-01',
      notes: '',
    })

    await archiveDebtIfPaid(debt.id)

    expect(await listAccounts('debt')).toEqual([])
    const [category] = await listCategories('income')
    expect(category.id).toBe(debt.categoryId)
    const transactions = await listTransactions(2026)
    expect(transactions).toHaveLength(1)
  })

  it('never archives a revolving debt (credit card), even fully paid', async () => {
    const bank = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const card = await createAccount({
      name: 'Crédito B. Chile',
      emoji: '💳',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 100000,
      revolving: true,
    })
    await createTransaction({
      accountId: bank.id,
      categoryId: card.categoryId as string,
      type: 'expense',
      amount: 100000,
      date: '2026-08-01',
      notes: '',
    })
    expect(await getDebtProgress(card)).toEqual({ paid: 100000, remaining: 0, percent: 100 })

    await archiveDebtIfPaid(card.id)

    expect(await listAccounts('debt')).toHaveLength(1)
  })

  it('does not archive a debt that is only partially paid', async () => {
    const bank = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const debt = await createAccount({
      name: 'Paula',
      emoji: '👤',
      kind: 'debt',
      debtDirection: 'owed_to_me',
      debtAmount: 5000,
      revolving: false,
    })
    await createTransaction({
      accountId: bank.id,
      categoryId: debt.categoryId as string,
      type: 'income',
      amount: 2000,
      date: '2026-08-01',
      notes: '',
    })

    await archiveDebtIfPaid(debt.id)

    expect(await listAccounts('debt')).toHaveLength(1)
  })
})

describe('getMonthlyTotalsForYear', () => {
  it('buckets expense/income totals into 12 months', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
      revolving: false,
    })
    const salary = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income', monthlyBudget: null })
    const groceries = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
      monthlyBudget: null,
    })
    await createTransaction({
      accountId: account.id,
      categoryId: salary.id,
      type: 'income',
      amount: 500000,
      date: '2026-01-05',
      notes: '',
    })
    await createTransaction({
      accountId: account.id,
      categoryId: groceries.id,
      type: 'expense',
      amount: 40000,
      date: '2026-03-10',
      notes: '',
    })

    const months = await getMonthlyTotalsForYear(2026)
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: 0, expense: 0, income: 500000 })
    expect(months[2]).toEqual({ month: 2, expense: 40000, income: 0 })
    expect(months[1]).toEqual({ month: 1, expense: 0, income: 0 })
  })
})
