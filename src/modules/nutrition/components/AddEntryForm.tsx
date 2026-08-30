import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import type { FoodItem } from '../domain/types'
import { FoodDetail } from './FoodDetail'

export interface ManualEntryValues {
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes: string
}

interface AddEntryFormProps {
  foods: FoodItem[]
  onAddFood: (foodId: string, quantity: number, notes: string) => Promise<void>
  onAddManual: (input: ManualEntryValues) => Promise<void>
  onDone: () => void
}

/** Adds an entry to whatever the caller is building — a date's Registro or a Plantilla — the caller supplies where it actually gets saved via `onAddFood`/`onAddManual`. */
export function AddEntryForm({ foods, onAddFood, onAddManual, onDone }: AddEntryFormProps) {
  const [mode, setMode] = useState<'food' | 'manual'>('food')
  const [search, setSearch] = useState('')
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [manualName, setManualName] = useState('')
  const [calories, setCalories] = useState('')
  const [proteinG, setProteinG] = useState('')
  const [carbsG, setCarbsG] = useState('')
  const [fatG, setFatG] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  const matches = foods
    .filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 8)

  function selectFood(food: FoodItem) {
    setSelectedFood(food)
    setQuantity(String(food.servingAmount))
  }

  async function handleAddFood(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        if (!selectedFood) throw new Error('Elegí un alimento.')
        const parsedQuantity = Number(quantity)
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
          throw new Error('La cantidad debe ser mayor a 0.')
        }
        await onAddFood(selectedFood.id, parsedQuantity, '')
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        if (!manualName.trim()) throw new Error('El nombre no puede estar vacío.')
        const parsed = {
          calories: Number(calories),
          proteinG: Number(proteinG),
          carbsG: Number(carbsG),
          fatG: Number(fatG),
        }
        if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0)) {
          throw new Error('Calorías, proteínas, carbohidratos y grasas son obligatorios.')
        }
        await onAddManual({ manualName: manualName.trim(), notes: '', ...parsed })
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  return (
    <div className="nutrition-add-entry">
      <div className="nutrition-add-entry-tabs">
        <button
          type="button"
          className={mode === 'food' ? 'active' : ''}
          onClick={() => setMode('food')}
        >
          Alimento
        </button>
        <button
          type="button"
          className={mode === 'manual' ? 'active' : ''}
          onClick={() => setMode('manual')}
        >
          Ingreso manual
        </button>
      </div>

      {mode === 'food' ? (
        <form onSubmit={handleAddFood} className="entity-form">
          {!selectedFood ? (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar alimento..."
                autoFocus
              />
              <ul className="nutrition-food-search-results">
                {matches.map((food) => (
                  <li key={food.id}>
                    <button type="button" onClick={() => selectFood(food)}>
                      {food.emoji} {food.name}
                      {food.brand && <span className="tag">{food.brand}</span>}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && search.trim() !== '' && (
                  <p className="empty-hint">Ningún alimento coincide.</p>
                )}
              </ul>
            </>
          ) : (
            <>
              <label>
                {selectedFood.emoji} {selectedFood.name}
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <FoodDetail food={selectedFood} quantity={Number(quantity) || 0} />
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={isSubmitting}>
                Agregar
              </button>
              <button type="button" onClick={() => setSelectedFood(null)}>
                Elegir otro alimento
              </button>
            </>
          )}
        </form>
      ) : (
        <form onSubmit={handleAddManual} className="entity-form">
          <label>
            Nombre
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ej. Almuerzo restaurante X"
              required
              autoFocus
            />
          </label>
          <label>
            Calorías (kcal)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
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
              value={proteinG}
              onChange={(e) => setProteinG(e.target.value)}
              required
            />
          </label>
          <label>
            Carbohidratos (g)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={carbsG}
              onChange={(e) => setCarbsG(e.target.value)}
              required
            />
          </label>
          <label>
            Grasas (g)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={fatG}
              onChange={(e) => setFatG(e.target.value)}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            Agregar
          </button>
        </form>
      )}
      <button type="button" onClick={onDone}>
        Cancelar
      </button>
    </div>
  )
}
