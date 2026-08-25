import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  createAccount,
  createCategory,
  createTransaction,
  getAccountBalance,
  getAccountsTotalBalance,
  getCategoryTotals,
  getYearTotals,
  listAccounts,
  listCategories,
  listTransactions,
  softDeleteAccount,
  softDeleteCategory,
  softDeleteTransaction,
  updateAccount,
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
    const salary = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
    const groceries = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
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
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
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
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
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
    await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
    await createCategory({ name: 'Supermercado', emoji: '🛒', type: 'expense' })
    const income = await listCategories('income')
    const expense = await listCategories('expense')
    expect(income.map((c) => c.name)).toEqual(['Sueldo'])
    expect(expense.map((c) => c.name)).toEqual(['Supermercado'])
  })

  it('excludes soft-deleted categories', async () => {
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
    await softDeleteCategory(category.id)
    expect(await listCategories()).toEqual([])
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
    const salary = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
    const groceries = await createCategory({
      name: 'Supermercado',
      emoji: '🛒',
      type: 'expense',
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
    const category = await createCategory({ name: 'Sueldo', emoji: '💰', type: 'income' })
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
