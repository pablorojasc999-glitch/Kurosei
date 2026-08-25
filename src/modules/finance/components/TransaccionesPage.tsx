import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { toDateKey } from '../../training/lib/calendarGrid'
import {
  createTransaction,
  getCategoryTotalsForMonth,
  listAccounts,
  listCategories,
  listTransactions,
  softDeleteTransaction,
  updateTransaction,
} from '../db/financeRepository'
import type { FinanceCategoryType, FinanceTransaction } from '../domain/types'
import { formatMoney, formatSignedMoney } from '../lib/money'
import { toMonthKey } from '../lib/month'
import { useAccountsTotalBalance } from '../lib/useAccountsTotalBalance'
import { BalanceHeader } from './BalanceHeader'
import { YearNav } from './YearNav'

function formatDateHeader(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const weekday = d.toLocaleDateString('es-CL', { weekday: 'long' })
  const monthName = d.toLocaleDateString('es-CL', { month: 'long' })
  return `${weekday} ${d.getDate()} de ${monthName}`
}

export function TransaccionesPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const transactions = useLiveQuery(() => listTransactions(year), [year])
  const accounts = useLiveQuery(() => listAccounts('account'), [])
  const categories = useLiveQuery(() => listCategories(), [])
  const finalBalance = useAccountsTotalBalance()

  const currentMonthKey = toMonthKey(new Date())
  const currentMonthSpend = useLiveQuery(
    () => getCategoryTotalsForMonth(currentMonthKey),
    [currentMonthKey],
  )
  const budgetedCategories = (categories ?? []).filter(
    (c) => c.type === 'expense' && c.monthlyBudget !== null && c.monthlyBudget > 0,
  )
  const currentMonthLabel = new Date().toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [type, setType] = useState<FinanceCategoryType>('expense')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => toDateKey(new Date()))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  const categoriesForType = categories?.filter((c) => c.type === type) ?? []

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setType('expense')
    setAccountId('')
    setCategoryId('')
    setAmount('')
    setDate(toDateKey(new Date()))
    setNotes('')
    setError(null)
  }

  function startEdit(t: FinanceTransaction) {
    setShowForm(true)
    setEditingId(t.id)
    setType(t.type)
    setAccountId(t.accountId)
    setCategoryId(t.categoryId)
    setAmount(String(t.amount))
    setDate(t.date)
    setNotes(t.notes)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        const parsedAmount = Number(amount)
        if (!accountId) throw new Error('Elegí una cuenta.')
        if (!categoryId) throw new Error('Elegí una categoría.')
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          throw new Error('El monto debe ser mayor a 0.')
        }
        const input = {
          accountId,
          categoryId,
          type,
          amount: parsedAmount,
          date,
          notes: notes.trim(),
        }
        if (editingId) {
          await updateTransaction(editingId, input)
        } else {
          await createTransaction(input)
        }
        resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]))

  const groups: Array<{ date: string; transactions: FinanceTransaction[] }> = []
  for (const t of transactions ?? []) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.date) last.transactions.push(t)
    else groups.push({ date: t.date, transactions: [t] })
  }

  const canAddTransaction = (accounts?.length ?? 0) > 0 && (categories?.length ?? 0) > 0

  return (
    <div className="page">
      <h1>Transacciones</h1>
      <BalanceHeader />
      <YearNav year={year} onChange={setYear} />

      <div className="finance-summary-row">
        <div className="finance-summary-card">
          <span>Saldo inicial</span>
          <strong>{formatMoney(0)}</strong>
        </div>
        <div className="finance-summary-card">
          <span>Saldo final</span>
          <strong>{formatMoney(finalBalance ?? 0)}</strong>
        </div>
      </div>

      {budgetedCategories.length > 0 && (
        <section>
          <h2>Presupuestos de {currentMonthLabel}</h2>
          <ul className="finance-budget-list">
            {budgetedCategories.map((category) => {
              const budget = category.monthlyBudget as number
              const spent = currentMonthSpend?.get(category.id) ?? 0
              const pct = Math.min(Math.round((spent / budget) * 100), 999)
              const overBudget = spent > budget
              return (
                <li key={category.id} className="finance-budget-row">
                  <div className="finance-budget-row-header">
                    <span>
                      {category.emoji} {category.name}
                    </span>
                    <span className={overBudget ? 'finance-amount--expense' : undefined}>
                      {formatMoney(spent)} / {formatMoney(budget)} ({pct}%)
                    </span>
                  </div>
                  <div className="finance-budget-bar">
                    <div
                      className={`finance-budget-bar-fill${overBudget ? ' finance-budget-bar-fill--over' : ''}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="finance-add-button"
        disabled={!canAddTransaction}
        onClick={() => {
          resetForm()
          setShowForm(true)
        }}
      >
        + Añadir transacción
      </button>
      {!canAddTransaction && (
        <p className="empty-hint">
          Primero creá al menos una cuenta (pestaña Cuentas) y una categoría (pestaña
          Categorías).
        </p>
      )}

      {showForm && (
        <section>
          <h2>{editingId ? 'Editar transacción' : 'Nueva transacción'}</h2>
          <form onSubmit={handleSubmit} className="entity-form">
            <label>
              Tipo
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as FinanceCategoryType)
                  setCategoryId('')
                }}
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </label>
            <label>
              Categoría
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">Elegir categoría</option>
                {categoriesForType.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cuenta
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                <option value="">Elegir cuenta</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Fecha
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              Nota (opcional)
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {editingId ? 'Guardar cambios' : 'Guardar transacción'}
            </button>
            <button type="button" onClick={resetForm}>
              Cancelar
            </button>
          </form>
        </section>
      )}

      <ul className="finance-transaction-groups">
        {groups.map((group) => {
          const dayNet = group.transactions.reduce(
            (sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount),
            0,
          )
          return (
            <li key={group.date}>
              <div className="finance-transaction-date-header">
                <span>{formatDateHeader(group.date)}</span>
                <strong className={dayNet >= 0 ? 'finance-amount--income' : 'finance-amount--expense'}>
                  {formatSignedMoney(dayNet, dayNet >= 0 ? 1 : -1)}
                </strong>
              </div>
              <ul className="finance-transaction-list">
                {group.transactions.map((t) => {
                  const category = categoryById.get(t.categoryId)
                  const account = accountById.get(t.accountId)
                  const subtitle = [account?.name, t.notes].filter(Boolean).join(' · ')
                  return (
                    <li key={t.id} className="finance-transaction-row">
                      <button
                        type="button"
                        className="finance-transaction-row-body"
                        onClick={() => startEdit(t)}
                      >
                        <span className="finance-transaction-emoji">
                          {category?.emoji || '🏷️'}
                        </span>
                        <span className="finance-transaction-info">
                          <strong>{category?.name ?? 'Categoría eliminada'}</strong>
                          {subtitle && (
                            <span className="finance-transaction-subtitle">{subtitle}</span>
                          )}
                        </span>
                        <span
                          className={
                            t.type === 'income'
                              ? 'finance-amount--income'
                              : 'finance-amount--expense'
                          }
                        >
                          {formatSignedMoney(t.amount, t.type === 'income' ? 1 : -1)}
                        </span>
                      </button>
                      <ConfirmDeleteButton
                        variant="icon"
                        label="Eliminar transacción"
                        confirmMessage="¿Eliminar esta transacción?"
                        onConfirm={() => softDeleteTransaction(t.id)}
                      />
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
        {groups.length === 0 && (
          <p className="empty-hint">Sin transacciones registradas en {year}.</p>
        )}
      </ul>
    </div>
  )
}
