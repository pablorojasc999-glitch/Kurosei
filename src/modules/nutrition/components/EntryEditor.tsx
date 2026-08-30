import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import type { FoodItem, NutritionEntryKind } from '../domain/types'
import { FoodDetail } from './FoodDetail'

export interface ManualEditValues {
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

/** Shape shared by `NutritionEntry` and `MealTemplateEntry` — everything this editor reads, regardless of which one it's editing. */
interface EditableEntry {
  kind: NutritionEntryKind
  quantity: number | null
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

interface EntryEditorProps {
  entry: EditableEntry
  food: FoodItem | undefined
  onSaveQuantity: (quantity: number) => Promise<void>
  onSaveManual: (input: ManualEditValues) => Promise<void>
}

/** Inline editor for an already-logged entry — a quantity field (rescaling the linked food's macros) for a `food` entry, or the full name+macros form for a `manual` one. Rendered below the row, same "never a modal" pattern as `FoodDetail`. */
export function EntryEditor({ entry, food, onSaveQuantity, onSaveManual }: EntryEditorProps) {
  const isFood = entry.kind === 'food' && !!food
  const [quantity, setQuantity] = useState(String(entry.quantity ?? ''))
  const [manualName, setManualName] = useState(entry.manualName)
  const [calories, setCalories] = useState(String(entry.calories))
  const [proteinG, setProteinG] = useState(String(entry.proteinG))
  const [carbsG, setCarbsG] = useState(String(entry.carbsG))
  const [fatG, setFatG] = useState(String(entry.fatG))
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  async function handleSaveQuantity(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      const parsed = Number(quantity)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('La cantidad debe ser mayor a 0.')
        return
      }
      await onSaveQuantity(parsed)
    })
  }

  async function handleSaveManual(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      if (!manualName.trim()) {
        setError('El nombre no puede estar vacío.')
        return
      }
      const parsed = {
        calories: Number(calories),
        proteinG: Number(proteinG),
        carbsG: Number(carbsG),
        fatG: Number(fatG),
      }
      if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0)) {
        setError('Calorías, proteínas, carbohidratos y grasas son obligatorios.')
        return
      }
      await onSaveManual({ manualName: manualName.trim(), ...parsed })
    })
  }

  if (isFood && food) {
    return (
      <div className="nutrition-entry-editor">
        <form onSubmit={handleSaveQuantity} className="entity-form">
          <label>
            Cantidad ({food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit})
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
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            Guardar
          </button>
        </form>
        <FoodDetail food={food} quantity={Number(quantity) || 0} />
      </div>
    )
  }

  return (
    <div className="nutrition-entry-editor">
      <form onSubmit={handleSaveManual} className="entity-form">
        <label>
          Nombre
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
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
          Guardar
        </button>
      </form>
    </div>
  )
}
