import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  createCategory,
  getCategoryTotals,
  getYearTotals,
  listCategories,
  softDeleteCategory,
  updateCategory,
} from '../db/financeRepository'
import type { FinanceCategory, FinanceCategoryType } from '../domain/types'
import { formatMoney } from '../lib/money'
import { BalanceHeader } from './BalanceHeader'
import { YearNav } from './YearNav'

export function CategoriasPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const categories = useLiveQuery(() => listCategories(), [])
  const categoryTotals = useLiveQuery(() => getCategoryTotals(year), [year])
  const yearTotals = useLiveQuery(() => getYearTotals(year), [year])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [type, setType] = useState<FinanceCategoryType>('expense')
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setEmoji('')
    setType('expense')
    setError(null)
  }

  function startEdit(category: FinanceCategory) {
    setShowForm(true)
    setEditingId(category.id)
    setName(category.name)
    setEmoji(category.emoji)
    setType(category.type)
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
        if (editingId) {
          await updateCategory(editingId, { name: trimmedName, emoji: trimmedEmoji })
        } else {
          await createCategory({ name: trimmedName, emoji: trimmedEmoji, type })
        }
        resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  return (
    <div className="page">
      <h1>Categorías</h1>
      <BalanceHeader />
      <YearNav year={year} onChange={setYear} />

      <div className="finance-summary-row">
        <div className="finance-summary-card finance-summary-card--expense">
          <span>Gastos</span>
          <strong>{formatMoney(yearTotals?.expense ?? 0)}</strong>
        </div>
        <div className="finance-summary-card finance-summary-card--income">
          <span>Ingresos</span>
          <strong>{formatMoney(yearTotals?.income ?? 0)}</strong>
        </div>
      </div>

      <div className="finance-category-grid">
        {categories?.map((category) => (
          <div
            key={category.id}
            className={`finance-category-card finance-category-card--${category.type}`}
          >
            <ConfirmDeleteButton
              variant="icon"
              className="icon-button finance-category-delete"
              label="Eliminar categoría"
              confirmMessage={`¿Eliminar "${category.name}"?`}
              onConfirm={() => softDeleteCategory(category.id)}
            />
            <button
              type="button"
              className="finance-category-card-body"
              onClick={() => startEdit(category)}
            >
              <span className="finance-category-emoji">{category.emoji || '🏷️'}</span>
              <span className="finance-category-name">{category.name}</span>
              <span className="finance-category-total">
                {formatMoney(categoryTotals?.get(category.id) ?? 0)}
              </span>
            </button>
          </div>
        ))}
        <button
          type="button"
          className="finance-category-card finance-category-card--add"
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
        >
          <span className="finance-category-emoji">+</span>
          <span className="finance-category-name">Añadir</span>
        </button>
      </div>

      {showForm && (
        <section>
          <h2>{editingId ? 'Editar categoría' : 'Nueva categoría'}</h2>
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
                placeholder="🛒"
                maxLength={4}
              />
            </label>
            {!editingId && (
              <label>
                Tipo
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as FinanceCategoryType)}
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
              </label>
            )}
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {editingId ? 'Guardar cambios' : 'Guardar categoría'}
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
