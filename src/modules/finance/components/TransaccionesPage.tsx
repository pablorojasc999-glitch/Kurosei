import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { toDateKey } from '../../training/lib/calendarGrid'
import {
  createTransaction,
  getCategoryTotalsForMonth,
  listAccounts,
  listCategories,
  listCategoryBudgets,
  listTransactionsForMonth,
  softDeleteTransaction,
  updateTransaction,
} from '../db/financeRepository'
import type { FinanceCategoryType, FinanceTransaction } from '../domain/types'
import { budgetsForMonth } from '../lib/budgets'
import { sortCategoriesForGrid } from '../lib/categoryOrder'
import { formatMoney, formatSignedMoney } from '../lib/money'
import {
  financialMonthOptions,
  formatMonthKey,
  monthKeyOfDate,
  toMonthKey,
} from '../lib/month'
import { useAccountsTotalBalance } from '../lib/useAccountsTotalBalance'
import { BalanceHeader } from './BalanceHeader'
import { MonthNav } from './MonthNav'

function formatDateHeader(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const weekday = d.toLocaleDateString('es-CL', { weekday: 'long' })
  const monthName = d.toLocaleDateString('es-CL', { month: 'long' })
  return `${weekday} ${d.getDate()} de ${monthName}`
}

export function TransaccionesPage() {
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()))
  // La lista sigue al mes financiero, no al de la fecha: así lo que se ve acá
  // es exactamente lo que suma Categorías para ese mes.
  const transactions = useLiveQuery(() => listTransactionsForMonth(monthKey), [monthKey])
  const accounts = useLiveQuery(() => listAccounts('account'), [])
  const categories = useLiveQuery(() => listCategories(), [])
  const finalBalance = useAccountsTotalBalance()

  const monthSpend = useLiveQuery(() => getCategoryTotalsForMonth(monthKey), [monthKey])
  const allBudgets = useLiveQuery(() => listCategoryBudgets(), [])
  const monthBudgets = useMemo(
    () => budgetsForMonth(allBudgets ?? [], monthKey),
    [allBudgets, monthKey],
  )
  // Mismo criterio que la grilla de Categorías: de mayor a menor presupuesto.
  // Acá sólo quedan gastos con presupuesto puesto, así que el orden sale del
  // monto y los empates se resuelven alfabéticamente.
  const budgetedCategories = useMemo(
    () =>
      sortCategoriesForGrid(
        (categories ?? []).filter(
          (c) => c.type === 'expense' && (monthBudgets.get(c.id) ?? 0) > 0,
        ),
        monthBudgets,
      ),
    [categories, monthBudgets],
  )
  const monthLabel = formatMonthKey(monthKey)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [type, setType] = useState<FinanceCategoryType>('expense')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => toDateKey(new Date()))
  // Por defecto sigue a la fecha; se separa sólo si se elige otro a mano.
  const [financialMonth, setFinancialMonth] = useState(() => toMonthKey(new Date()))
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
    // Nace imputada al mes que se está mirando, que es donde se la espera.
    setFinancialMonth(monthKey)
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
    setFinancialMonth(t.financialMonth)
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
          financialMonth,
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
  // Ingresos siempre antes que gastos, y dentro de cada grupo de mayor a menor monto.
  for (const group of groups) {
    group.transactions.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'income' ? -1 : 1
      return b.amount - a.amount
    })
  }

  const canAddTransaction = (accounts?.length ?? 0) > 0 && (categories?.length ?? 0) > 0

  return (
    <div className="page">
      <h1>Transacciones</h1>
      <BalanceHeader />
      <MonthNav monthKey={monthKey} onChange={setMonthKey} />

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
          <h2>Presupuestos de {monthLabel}</h2>
          <ul className="finance-budget-list">
            {budgetedCategories.map((category) => {
              const budget = monthBudgets.get(category.id) as number
              const spent = monthSpend?.get(category.id) ?? 0
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
        <BottomSheet
          title={editingId ? 'Editar transacción' : 'Nueva transacción'}
          onClose={resetForm}
        >
          <form onSubmit={handleSubmit} className="entity-form" autoComplete="off">
            <label>
              Tipo
              <select
                autoComplete="off"
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
              <select autoComplete="off" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
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
              <select autoComplete="off" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
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
                autoComplete="off"
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
              <input
                autoComplete="off"
                type="date"
                value={date}
                onChange={(e) => {
                  const next = e.target.value
                  // Mientras el mes financiero siga al de la fecha, se mueve
                  // con ella. Si ya se eligió otro a mano, no se pisa.
                  if (financialMonth === monthKeyOfDate(date)) {
                    setFinancialMonth(monthKeyOfDate(next))
                  }
                  setDate(next)
                }}
                required
              />
            </label>
            <label>
              Mes financiero
              <select
                autoComplete="off"
                value={financialMonth}
                onChange={(e) => setFinancialMonth(e.target.value)}
              >
                {financialMonthOptions(date, financialMonth).map((option) => (
                  <option key={option} value={option}>
                    {formatMonthKey(option)}
                  </option>
                ))}
              </select>
              <span className="finance-field-hint">
                A qué mes se le imputa. Por defecto el de la fecha, pero una compra de fin de
                mes puede ir al siguiente: es lo que cuentan los totales y los presupuestos.
              </span>
            </label>
            <label>
              Nota (opcional)
              <input autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {editingId ? 'Guardar cambios' : 'Guardar transacción'}
            </button>
            <button type="button" onClick={resetForm}>
              Cancelar
            </button>
          </form>
        </BottomSheet>
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
                          {t.financialMonth !== monthKeyOfDate(t.date) && (
                            // Imputada a otro mes: se dice, porque si no el
                            // total del mes no cuadraría con lo que se ve acá.
                            <span className="finance-transaction-month">
                              cuenta en {formatMonthKey(t.financialMonth)}
                            </span>
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
          <p className="empty-hint">Sin movimientos imputados a {monthLabel}.</p>
        )}
      </ul>
    </div>
  )
}
