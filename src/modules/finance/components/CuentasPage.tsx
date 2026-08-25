import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  createAccount,
  getAccountBalance,
  listAccounts,
  softDeleteAccount,
  updateAccount,
} from '../db/financeRepository'
import type { DebtDirection, FinanceAccount } from '../domain/types'
import { formatMoney } from '../lib/money'
import { BalanceHeader } from './BalanceHeader'

type SubTab = 'cuentas' | 'deudas' | 'total'

export function CuentasPage() {
  const [subTab, setSubTab] = useState<SubTab>('cuentas')
  const accountRows = useLiveQuery(async () => {
    const accounts = await listAccounts('account')
    return Promise.all(
      accounts.map(async (account) => ({
        account,
        balance: await getAccountBalance(account.id),
      })),
    )
  }, [])
  const debts = useLiveQuery(() => listAccounts('debt'), [])

  const [formKind, setFormKind] = useState<'account' | 'debt' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [debtDirection, setDebtDirection] = useState<DebtDirection>('i_owe')
  const [debtAmount, setDebtAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  function resetForm() {
    setFormKind(null)
    setEditingId(null)
    setName('')
    setEmoji('')
    setDebtDirection('i_owe')
    setDebtAmount('')
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
            })
          } else {
            await createAccount({
              name: trimmedName,
              emoji: trimmedEmoji,
              kind: 'debt',
              debtDirection,
              debtAmount: amount,
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
    debts?.filter((d) => d.debtDirection === 'i_owe').reduce((s, d) => s + (d.debtAmount ?? 0), 0) ??
    0
  const owedToMeTotal =
    debts
      ?.filter((d) => d.debtDirection === 'owed_to_me')
      .reduce((s, d) => s + (d.debtAmount ?? 0), 0) ?? 0

  return (
    <div className="page">
      <h1>Cuentas</h1>
      <BalanceHeader />

      <div className="finance-subtabs">
        <button
          type="button"
          className={subTab === 'cuentas' ? 'active' : ''}
          onClick={() => setSubTab('cuentas')}
        >
          Cuentas
        </button>
        <button
          type="button"
          className={subTab === 'deudas' ? 'active' : ''}
          onClick={() => setSubTab('deudas')}
        >
          Deudas
        </button>
        <button
          type="button"
          className={subTab === 'total' ? 'active' : ''}
          onClick={() => setSubTab('total')}
        >
          Total
        </button>
      </div>

      {subTab === 'cuentas' && (
        <section>
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
            {accountRows?.length === 0 && (
              <p className="empty-hint">Todavía no agregaste ninguna cuenta.</p>
            )}
          </ul>
          <button
            type="button"
            className="finance-add-button"
            onClick={() => {
              resetForm()
              setFormKind('account')
            }}
          >
            + Añadir cuenta financiera
          </button>
        </section>
      )}

      {subTab === 'deudas' && (
        <section>
          <ul className="finance-account-list">
            {debts?.map((debt) => (
              <li key={debt.id} className="finance-account-row">
                <button
                  type="button"
                  className="finance-account-row-body"
                  onClick={() => startEditDebt(debt)}
                >
                  <span className="finance-account-emoji">{debt.emoji || '📄'}</span>
                  <span className="finance-account-name">
                    {debt.name}
                    <span className="finance-account-subtitle">
                      {debt.debtDirection === 'i_owe' ? 'Yo debo' : 'Me deben'}
                    </span>
                  </span>
                  <span
                    className={`finance-account-balance ${
                      debt.debtDirection === 'i_owe' ? 'finance-amount--expense' : 'finance-amount--income'
                    }`}
                  >
                    {formatMoney(debt.debtAmount ?? 0)}
                  </span>
                </button>
                <ConfirmDeleteButton
                  variant="icon"
                  label="Eliminar deuda"
                  confirmMessage={`¿Eliminar "${debt.name}"?`}
                  onConfirm={() => softDeleteAccount(debt.id)}
                />
              </li>
            ))}
            {debts?.length === 0 && (
              <p className="empty-hint">Sin deudas registradas (CAE, tarjetas, dinero prestado…).</p>
            )}
          </ul>
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
        </section>
      )}

      {subTab === 'total' && (
        <section>
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
        </section>
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
