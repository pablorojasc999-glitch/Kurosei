import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { createFood, listFoods, softDeleteFood, updateFood } from '../db/nutritionRepository'
import type { FoodItem, NutrientProfile, ServingUnit } from '../domain/types'

function parseNum(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

type MicroFieldKey = Exclude<keyof NutrientProfile, 'calories' | 'proteinG' | 'carbsG' | 'fatG'>

const MICRO_FIELDS: Array<{ key: MicroFieldKey; label: string }> = [
  { key: 'saturatedFatG', label: 'Grasas saturadas (g)' },
  { key: 'transFatG', label: 'Grasas trans (g)' },
  { key: 'fiberG', label: 'Fibra (g)' },
  { key: 'sugarG', label: 'Azúcares (g)' },
  { key: 'sodiumMg', label: 'Sodio (mg)' },
  { key: 'cholesterolMg', label: 'Colesterol (mg)' },
  { key: 'potassiumMg', label: 'Potasio (mg)' },
  { key: 'calciumMg', label: 'Calcio (mg)' },
  { key: 'ironMg', label: 'Hierro (mg)' },
  { key: 'magnesiumMg', label: 'Magnesio (mg)' },
  { key: 'zincMg', label: 'Zinc (mg)' },
  { key: 'vitaminAMcg', label: 'Vitamina A (mcg)' },
  { key: 'vitaminCMg', label: 'Vitamina C (mg)' },
  { key: 'vitaminDMcg', label: 'Vitamina D (mcg)' },
  { key: 'vitaminEMg', label: 'Vitamina E (mg)' },
  { key: 'vitaminKMcg', label: 'Vitamina K (mcg)' },
  { key: 'vitaminB1Mg', label: 'Vitamina B1 (mg)' },
  { key: 'vitaminB2Mg', label: 'Vitamina B2 (mg)' },
  { key: 'vitaminB3Mg', label: 'Vitamina B3 (mg)' },
  { key: 'vitaminB6Mg', label: 'Vitamina B6 (mg)' },
  { key: 'vitaminB9Mcg', label: 'Vitamina B9 / Folato (mcg)' },
  { key: 'vitaminB12Mcg', label: 'Vitamina B12 (mcg)' },
]

interface FoodFormState {
  name: string
  brand: string
  emoji: string
  servingAmount: string
  servingUnit: ServingUnit
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  micros: Record<MicroFieldKey, string>
}

const EMPTY_MICROS = Object.fromEntries(
  MICRO_FIELDS.map((f) => [f.key, '']),
) as Record<MicroFieldKey, string>

const EMPTY_FORM: FoodFormState = {
  name: '',
  brand: '',
  emoji: '',
  servingAmount: '100',
  servingUnit: 'g',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  micros: EMPTY_MICROS,
}

function formToInput(form: FoodFormState) {
  const micros = Object.fromEntries(
    MICRO_FIELDS.map((f) => [f.key, parseNum(form.micros[f.key])]),
  ) as Record<MicroFieldKey, number | null>
  return {
    name: form.name.trim(),
    brand: form.brand.trim(),
    emoji: form.emoji.trim(),
    servingAmount: Number(form.servingAmount),
    servingUnit: form.servingUnit,
    calories: Number(form.calories),
    proteinG: Number(form.proteinG) || 0,
    carbsG: Number(form.carbsG) || 0,
    fatG: Number(form.fatG) || 0,
    ...micros,
  }
}

function foodToForm(food: FoodItem): FoodFormState {
  const micros = Object.fromEntries(
    MICRO_FIELDS.map((f) => [f.key, food[f.key] !== null ? String(food[f.key]) : '']),
  ) as Record<MicroFieldKey, string>
  return {
    name: food.name,
    brand: food.brand,
    emoji: food.emoji,
    servingAmount: String(food.servingAmount),
    servingUnit: food.servingUnit,
    calories: String(food.calories),
    proteinG: String(food.proteinG),
    carbsG: String(food.carbsG),
    fatG: String(food.fatG),
    micros,
  }
}

export function BibliotecaPage() {
  const foods = useLiveQuery(() => listFoods(), [])

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FoodFormState>(EMPTY_FORM)
  const [showMicros, setShowMicros] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowMicros(false)
    setError(null)
  }

  function startEdit(food: FoodItem) {
    setShowForm(true)
    setEditingId(food.id)
    setForm(foodToForm(food))
    setShowMicros(false)
    setError(null)
  }

  function updateField<K extends keyof FoodFormState>(key: K, value: FoodFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateMicro(key: MicroFieldKey, value: string) {
    setForm((prev) => ({ ...prev, micros: { ...prev.micros, [key]: value } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        if (!form.name.trim()) throw new Error('El nombre no puede estar vacío.')
        const servingAmount = Number(form.servingAmount)
        if (!Number.isFinite(servingAmount) || servingAmount <= 0) {
          throw new Error('La porción de referencia debe ser mayor a 0.')
        }
        const calories = Number(form.calories)
        if (!Number.isFinite(calories) || calories < 0) {
          throw new Error('Las calorías son obligatorias y deben ser un número válido.')
        }
        const input = formToInput(form)
        if (editingId) {
          await updateFood(editingId, input)
        } else {
          await createFood(input)
        }
        resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const filteredFoods = foods?.filter((f) =>
    f.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="page">
      <h1>Biblioteca de alimentos</h1>

      <button
        type="button"
        className="finance-add-button"
        onClick={() => {
          resetForm()
          setShowForm(true)
        }}
      >
        + Añadir alimento
      </button>

      {showForm && (
        <section>
          <h2>{editingId ? 'Editar alimento' : 'Nuevo alimento'}</h2>
          <form onSubmit={handleSubmit} className="entity-form">
            <label>
              Nombre
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </label>
            <label>
              Marca (opcional)
              <input
                value={form.brand}
                onChange={(e) => updateField('brand', e.target.value)}
                placeholder="Ej. Nestlé"
              />
            </label>
            <label>
              Emoji
              <input
                value={form.emoji}
                onChange={(e) => updateField('emoji', e.target.value)}
                placeholder="🍎"
                maxLength={4}
              />
            </label>
            <label>
              Porción de referencia
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min={0}
                value={form.servingAmount}
                onChange={(e) => updateField('servingAmount', e.target.value)}
                required
              />
            </label>
            <label>
              Unidad
              <select
                value={form.servingUnit}
                onChange={(e) => updateField('servingUnit', e.target.value as ServingUnit)}
              >
                <option value="g">Gramos</option>
                <option value="ml">Mililitros</option>
                <option value="unidad">Unidad</option>
              </select>
            </label>
            <label>
              Calorías (kcal)
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min={0}
                value={form.calories}
                onChange={(e) => updateField('calories', e.target.value)}
                required
              />
            </label>
            <label>
              Proteínas (g)
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min={0}
                value={form.proteinG}
                onChange={(e) => updateField('proteinG', e.target.value)}
              />
            </label>
            <label>
              Carbohidratos (g)
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min={0}
                value={form.carbsG}
                onChange={(e) => updateField('carbsG', e.target.value)}
              />
            </label>
            <label>
              Grasas (g)
              <input
                type="number"
                step="any"
                inputMode="decimal"
                min={0}
                value={form.fatG}
                onChange={(e) => updateField('fatG', e.target.value)}
              />
            </label>

            <button
              type="button"
              className="collapsible-toggle"
              onClick={() => setShowMicros((prev) => !prev)}
            >
              {showMicros ? 'Ocultar micronutrientes' : 'Agregar micronutrientes (opcional)'}
            </button>
            {showMicros && (
              <div className="micronutrient-grid">
                {MICRO_FIELDS.map(({ key, label }) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      min={0}
                      value={form.micros[key]}
                      onChange={(e) => updateMicro(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}

            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {editingId ? 'Guardar cambios' : 'Guardar alimento'}
            </button>
            <button type="button" onClick={resetForm}>
              Cancelar
            </button>
          </form>
        </section>
      )}

      <section>
        <h2>Alimentos</h2>
        <input
          type="search"
          className="exercise-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar alimento..."
        />
        <ul className="exercise-list">
          {filteredFoods?.map((food) => (
            <li key={food.id} className="exercise-item">
              <div>
                <strong>
                  {food.emoji} {food.name}
                </strong>{' '}
                {food.brand && <span className="tag">{food.brand}</span>}
                <div className="finance-transaction-subtitle">
                  {food.calories} kcal por {food.servingAmount}{' '}
                  {food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit}
                </div>
              </div>
              <div className="exercise-item-actions">
                <button type="button" onClick={() => startEdit(food)}>
                  Editar
                </button>
                <ConfirmDeleteButton
                  onConfirm={() => softDeleteFood(food.id)}
                  confirmMessage={`¿Eliminar "${food.name}"?`}
                />
              </div>
            </li>
          ))}
          {filteredFoods?.length === 0 && (
            <p className="empty-hint">Ningún alimento coincide con la búsqueda.</p>
          )}
        </ul>
      </section>
    </div>
  )
}
