import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  archiveDebtIfPaid,
  createAccount,
  ensureDebtCategoryId,
  getAccountBalance,
  getDebtProgress,
  listAccounts,
  softDeleteAccount,
  updateAccount,
} from '../db/financeRepository'
import type { DebtDirection, FinanceAccount } from '../domain/types'
import { formatMoney } from '../lib/money'
import { BalanceHeader } from './BalanceHeader'

export function CuentasPage() {
  const accountRows = useLiveQuery(async () => {
    const accounts = await listAccounts('account')
    return Promise.all(
      accounts.map(async (account) => ({
        account,
        balance: await getAccountBalance(account.id),
      })),
    )
  }, [])
  const debts = useLiveQuery(async () => {
    const rows = await listAccounts('debt')
    return Promise.all(
      rows.map(async (debt) => ({ debt, progress: await getDebtProgress(debt) })),
    )
  }, [])

  // Backfill a category link onto debts created before payments were tracked this way.
  useEffect(() => {
    listAccounts('debt').then((rows) => {
      for (const debt of rows) {
        if (!debt.categoryId) void ensureDebtCategoryId(debt)
      }
    })
  }, [])

  // A debt whose linked category now covers its goal amount gets archived automatically —
  // it disappears from this list, but its category and transaction history stay.
  useEffect(() => {
    if (!debts) return
    for (const { debt, progress } of debts) {
      if (progress.percent >= 100) void archiveDebtIfPaid(debt.id)
    }
  }, [debts])

  const [formKind, setFormKind] = useState<'account' | 'debt' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [debtDirection, setDebtDirection] = useState<DebtDirection>('i_owe')
  const [debtAmount, setDebtAmount] = useState('')
  const [revolving, setRevolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  function resetForm() {
    setFormKind(null)
    setEditingId(null)
    setName('')
    setEmoji('')
    setDebtDirection('i_owe')
    setDebtAmount('')
    setRevolving(false)
    setError(null)
  }

  function startEditAccount(account: FinanceAccount) {
    setFormKind('account')
    setEditingId(account.id)
    setName(account.name)
    setEmoji(account.emoji)
    setError(null)
  }

  function startEditDebt(debt: FinanceAccount) {
    setFormKind('debt')
    setEditingId(debt.id)
    setName(debt.name)
    setEmoji(debt.emoji)
    setDebtDirection(debt.debtDirection ?? 'i_owe')
    setDebtAmount(debt.debtAmount !== null ? String(debt.debtAmount) : '')
    setRevolving(debt.revolving ?? false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        const trimmedName = name.trim()
        const trimmedEmoji = emoji.trim()
        if (!trimmedName) throw new Error('El nombre no puede estar vacío.')

        if (formKind === 'debt') {
          const amount = Number(debtAmount)
          if (!Number.isFinite(amount) || amount < 0) {
            throw new Error('El monto debe ser un número válido.')
          }
          if (editingId) {
            await updateAccount(editingId, {
              name: trimmedName,
              emoji: trimmedEmoji,
              debtDirection,
              debtAmount: amount,
              revolving,
            })
          } else {
            await createAccount({
              name: trimmedName,
              emoji: trimmedEmoji,
              kind: 'debt',
              debtDirection,
              debtAmount: amount,
              revolving,
            })
          }
        } else {
          if (editingId) {
            await updateAccount(editingId, { name: trimmedName, emoji: trimmedEmoji })
          } else {
            await createAccount({
              name: trimmedName,
              emoji: trimmedEmoji,
              kind: 'account',
              debtDirection: null,
              debtAmount: null,
              revolving: false,
            })
          }
        }
        resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const accountsTotal = accountRows?.reduce((sum, r) => sum + r.balance, 0) ?? 0
  const iOweTotal =
    debts
      ?.filter(({ debt }) => debt.debtDirection === 'i_owe')
      .reduce((s, { progress }) => s + progress.remaining, 0) ?? 0
  const owedToMeTotal =
    debts
      ?.filter(({ debt }) => debt.debtDirection === 'owed_to_me')
      .reduce((s, { progress }) => s + progress.remaining, 0) ?? 0

  const isEmpty = (accountRows?.length ?? 0) === 0 && (debts?.length ?? 0) === 0

  return (
    <div className="page">
      <h1>Cuentas</h1>
      <BalanceHeader />

      <ul className="finance-account-list">
        {accountRows?.map(({ account, balance }) => (
          <li key={account.id} className="finance-account-row">
            <button
              type="button"
              className="finance-account-row-body"
              onClick={() => startEditAccount(account)}
            >
              <span className="finance-account-emoji">{account.emoji || '💳'}</span>
              <span className="finance-account-name">{account.name}</span>
              <span className="finance-account-balance">{formatMoney(balance)}</span>
            </button>
            <ConfirmDeleteButton
              variant="icon"
              label="Eliminar cuenta"
              confirmMessage={`¿Eliminar "${account.name}"?`}
              onConfirm={() => softDeleteAccount(account.id)}
            />
          </li>
        ))}
        {debts?.map(({ debt, progress }) => (
          <li key={debt.id} className="finance-account-row">
            <button
              type="button"
              className="finance-account-row-body finance-debt-row-body"
              onClick={() => startEditDebt(debt)}
            >
              <div className="finance-debt-row-top">
                <span className="finance-account-emoji">{debt.emoji || '📄'}</span>
                <span className="finance-account-name">
                  {debt.name}
                  <span className="finance-account-subtitle">
                    {debt.debtDirection === 'i_owe' ? 'Yo debo' : 'Me deben'}
                  </span>
                </span>
                <span
                  className={`finance-account-balance ${
                    debt.debtDirection === 'i_owe'
                      ? 'finance-amount--expense'
                      : 'finance-amount--income'
                  }`}
                >
                  {formatMoney(progress.remaining)}
                </span>
              </div>
              <div className="finance-debt-progress">
                <div className="finance-budget-bar">
                  <div
                    className="finance-budget-bar-fill"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <span className="finance-debt-progress-label">
                  {formatMoney(progress.paid)} pagado de {formatMoney(debt.debtAmount ?? 0)} ·{' '}
                  {progress.percent}%
                  {debt.revolving && ' · variable'}
                </span>
              </div>
            </button>
            <ConfirmDeleteButton
              variant="icon"
              label="Eliminar deuda"
              confirmMessage={`¿Eliminar "${debt.name}"?`}
              onConfirm={() => softDeleteAccount(debt.id)}
            />
          </li>
        ))}
        {isEmpty && (
          <p className="empty-hint">
            Todavía no agregaste ninguna cuenta ni deuda (CAE, tarjetas, dinero prestado…).
          </p>
        )}
      </ul>

      <div className="finance-add-row">
        <button
          type="button"
          className="finance-add-button"
          onClick={() => {
            resetForm()
            setFormKind('account')
          }}
        >
          + Añadir cuenta
        </button>
        <button
          type="button"
          className="finance-add-button"
          onClick={() => {
            resetForm()
            setFormKind('debt')
          }}
        >
          + Añadir deuda
        </button>
      </div>

      {!isEmpty && (
        <ul className="finance-total-breakdown">
          <li>
            <span>Cuentas</span>
            <strong>{formatMoney(accountsTotal)}</strong>
          </li>
          <li>
            <span>Me deben</span>
            <strong className="finance-amount--income">{formatMoney(owedToMeTotal)}</strong>
          </li>
          <li>
            <span>Yo debo</span>
            <strong className="finance-amount--expense">{formatMoney(iOweTotal)}</strong>
          </li>
          <li className="finance-total-breakdown-net">
            <span>Patrimonio neto</span>
            <strong>{formatMoney(accountsTotal + owedToMeTotal - iOweTotal)}</strong>
          </li>
        </ul>
      )}

      {formKind && (
        <section>
          <h2>
            {editingId
              ? `Editar ${formKind === 'debt' ? 'deuda' : 'cuenta'}`
              : formKind === 'debt'
                ? 'Nueva deuda'
                : 'Nueva cuenta'}
          </h2>
          <form onSubmit={handleSubmit} className="entity-form">
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Emoji
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="💳"
                maxLength={4}
              />
            </label>
            {formKind === 'debt' && (
              <>
                <label>
                  Dirección
                  <select
                    value={debtDirection}
                    onChange={(e) => setDebtDirection(e.target.value as DebtDirection)}
                  >
                    <option value="i_owe">Yo debo</option>
                    <option value="owed_to_me">Me deben</option>
                  </select>
                </label>
                <label>
                  Monto
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    required
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={revolving}
                    onChange={(e) => setRevolving(e.target.checked)}
                  />
                  Es un saldo variable (tarjeta de crédito, línea de crédito)
                </label>
                {revolving && (
                  <p className="contributions-hint">
                    Vas a poder editar el monto cada vez que sumes un cargo nuevo. Los pagos se
                    registran como transacciones de esta categoría y, a diferencia de un préstamo,
                    no se archiva sola al quedar en $0.
                  </p>
                )}
              </>
            )}
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {editingId ? 'Guardar cambios' : 'Guardar'}
            </button>
            <button type="button" onClick={resetForm}>
              Cancelar
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
