import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  createAccount,
  createCategory,
  createTransaction,
  getAccountBalance,
  getAccountsTotalBalance,
  getCategoryTotals,
  getCategoryTotalsForMonth,
  getMonthlyTotalsForYear,
  getYearTotals,
  listAccounts,
  listCategories,
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
    })
    const bank = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
    })
    const debt = await createAccount({
      name: 'CAE',
      emoji: '🎓',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 500000,
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
    })
    await createAccount({
      name: 'CAE',
      emoji: '🎓',
      kind: 'debt',
      debtDirection: 'i_owe',
      debtAmount: 500000,
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

describe('getMonthlyTotalsForYear', () => {
  it('buckets expense/income totals into 12 months', async () => {
    const account = await createAccount({
      name: 'Banco',
      emoji: '🏦',
      kind: 'account',
      debtDirection: null,
      debtAmount: null,
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
