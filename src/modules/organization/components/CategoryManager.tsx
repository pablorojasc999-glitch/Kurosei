import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  listCategories,
  reorderCategory,
  updateCategory,
} from '../db/organizationRepository'
import type { TimeBlockCategory } from '../domain/types'

const EMPTY_FORM = { name: '', color: '#8b5cf6', emoji: '✨' }

export function CategoryManager() {
  useEffect(() => {
    ensureDefaultCategories()
  }, [])

  const categories = useLiveQuery(() => listCategories(), [])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  function openNewForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  function openEditForm(category: TimeBlockCategory) {
    setEditingId(category.id)
    setForm({ name: category.name, color: category.color, emoji: category.emoji })
    setError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const name = form.name.trim()
    if (!name) {
      setError('Ponle un nombre a la categoría.')
      return
    }
    await guard(async () => {
      const input = { name, color: form.color, emoji: form.emoji.trim() || '⬤' }
      if (editingId) {
        await updateCategory(editingId, input)
      } else {
        await createCategory(input)
      }
      closeForm()
    })
  }

  if (!categories) return null

  return (
    <div>
      <p className="empty-hint">
        Estas categorías son las que vas a usar para bloquear tu tiempo. Cada
        una tiene un color y un emoji propio.
      </p>

      <ul className="entity-list category-list">
        {categories.map((category, index) => (
          <li key={category.id} className="list-card">
            <div className="category-card-main">
              <span
                className="category-swatch"
                style={{ background: category.color }}
                aria-hidden
              >
                {category.emoji}
              </span>
              <span className="list-card-line">{category.name}</span>
            </div>
            <div className="list-card-actions">
              <button
                type="button"
                className="icon-button"
                disabled={index === 0}
                onClick={() => reorderCategory(category.id, 'up')}
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={index === categories.length - 1}
                onClick={() => reorderCategory(category.id, 'down')}
                aria-label="Bajar"
              >
                ↓
              </button>
              <button type="button" onClick={() => openEditForm(category)}>
                Editar
              </button>
              <ConfirmDeleteButton
                onConfirm={() => deleteCategory(category.id)}
                confirmMessage="¿Eliminar categoría? Sus bloques también se eliminarán."
              />
            </div>
          </li>
        ))}
      </ul>

      {showForm ? (
        <form className="entity-form category-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Estudio"
              autoFocus
            />
          </label>
          <div className="category-form-row">
            <label className="category-form-emoji">
              Emoji
              <input
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="🎯"
                maxLength={4}
              />
            </label>
            <label className="category-form-color">
              Color
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Guardar cambios' : 'Crear categoría'}
          </button>
          <button type="button" onClick={closeForm}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="load-plan-button" onClick={openNewForm}>
          + Nueva categoría
        </button>
      )}
    </div>
  )
}
