import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { toDateKey } from '../../training/lib/calendarGrid'
import { listEntriesForDateRange } from '../db/nutritionRepository'
import type { FoodItem } from '../domain/types'
import { formatNutrient, scaleNutrientProfile } from '../lib/nutrients'
import { suggestedFoods } from '../lib/suggestedFoods'
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
  /** Cabecera del panel, p. ej. "Agregar a Almuerzo". */
  title: string
  subtitle?: string
  onAddFood: (foodId: string, quantity: number, notes: string) => Promise<void>
  onAddManual: (input: ManualEntryValues) => Promise<void>
  onDone: () => void
}

/** Cuántos días atrás se miran los registros para proponer alimentos. */
const SUGGESTION_DAYS = 30

/** Los atajos de porción, como múltiplos de la porción de referencia del alimento. */
const PORTIONS: Array<{ factor: number; label: string }> = [
  { factor: 0.5, label: '½' },
  { factor: 1, label: '1' },
  { factor: 1.5, label: '1½' },
  { factor: 2, label: '2' },
]

/** Lo que suma o resta el paso: las unidades van de una en una, lo que se pesa de diez en diez. */
function stepFor(food: FoodItem): number {
  return food.servingUnit === 'unidad' ? 1 : 10
}

/** Sin decimales de más: 100, no 100.0, pero 1.5 sigue siendo 1.5. */
function trimNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** Adds an entry to whatever the caller is building — a date's Registro or a Plantilla — the caller supplies where it actually gets saved via `onAddFood`/`onAddManual`. */
export function AddEntryForm({
  foods,
  title,
  subtitle,
  onAddFood,
  onAddManual,
  onDone,
}: AddEntryFormProps) {
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

  // La ventana se fija al abrir el panel: si dependiera de `new Date()` en cada
  // render, la consulta se rehacía en cada tecla del buscador.
  const suggestionWindow = useMemo(() => {
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - SUGGESTION_DAYS)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return { from: toDateKey(from), to: toDateKey(today), recentSince: toDateKey(yesterday) }
  }, [])

  const recentEntries = useLiveQuery(
    () => listEntriesForDateRange(suggestionWindow.from, suggestionWindow.to),
    [suggestionWindow.from, suggestionWindow.to],
  )

  const suggestions = useMemo(
    () => suggestedFoods(foods, recentEntries ?? [], { recentSince: suggestionWindow.recentSince }),
    [foods, recentEntries, suggestionWindow.recentSince],
  )

  const trimmedSearch = search.trim().toLowerCase()
  const matches = foods
    .filter((f) => f.name.toLowerCase().includes(trimmedSearch))
    .slice(0, 8)

  const hasSuggestions = suggestions.recent.length > 0 || suggestions.frequent.length > 0

  function selectFood(food: FoodItem, presetQuantity?: number) {
    setSelectedFood(food)
    setQuantity(trimNumber(presetQuantity ?? food.servingAmount))
    setError(null)
  }

  function stepQuantity(direction: 1 | -1) {
    if (!selectedFood) return
    const step = stepFor(selectedFood)
    const current = Number(quantity) || 0
    setQuantity(trimNumber(Math.max(step, current + direction * step)))
  }

  /** Agrega el alimento sin pasar por la pantalla de cantidad: la porción ya es la de siempre. */
  async function quickAdd(food: FoodItem, presetQuantity: number) {
    setError(null)
    await guard(async () => {
      try {
        await onAddFood(food.id, presetQuantity, '')
        onDone()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
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

  function foodRow(food: FoodItem, presetQuantity: number) {
    const unit = food.servingUnit === 'unidad' ? 'un' : food.servingUnit
    return (
      <li key={food.id} className="nutrition-food-row">
        <button type="button" onClick={() => selectFood(food, presetQuantity)}>
          <span className="nutrition-food-row-emoji">{food.emoji}</span>
          <span className="nutrition-food-row-name">
            {food.name}
            {food.brand && <span className="tag">{food.brand}</span>}
          </span>
          <span className="nutrition-food-row-qty numeric">
            {trimNumber(presetQuantity)} {unit}
          </span>
        </button>
        <button
          type="button"
          className="nutrition-food-row-quick"
          aria-label={`Agregar ${food.name} directo`}
          disabled={isSubmitting}
          onClick={() => void quickAdd(food, presetQuantity)}
        >
          +
        </button>
      </li>
    )
  }

  const previewCalories = selectedFood
    ? scaleNutrientProfile(selectedFood, Number(quantity) || 0).calories
    : 0

  return (
    <BottomSheet title={title} subtitle={subtitle} onClose={onDone}>
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
          <form onSubmit={handleAddFood} className="entity-form" autoComplete="off">
            {!selectedFood ? (
              <>
                <input
                  autoComplete="off"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar alimento..."
                />

                {trimmedSearch === '' && hasSuggestions ? (
                  // Con el buscador vacío se proponen los de siempre: así lo
                  // habitual se anota sin escribir nada.
                  <>
                    {suggestions.recent.length > 0 && (
                      <>
                        <span className="nutrition-suggestion-label">Hoy y ayer</span>
                        <ul className="nutrition-food-search-results">
                          {suggestions.recent.map((s) => foodRow(s.food, s.quantity))}
                        </ul>
                      </>
                    )}
                    {suggestions.frequent.length > 0 && (
                      <>
                        <span className="nutrition-suggestion-label">Lo que más repites</span>
                        <ul className="nutrition-food-search-results">
                          {suggestions.frequent.map((s) => foodRow(s.food, s.quantity))}
                        </ul>
                      </>
                    )}
                  </>
                ) : (
                  <ul className="nutrition-food-search-results">
                    {matches.map((food) => foodRow(food, food.servingAmount))}
                    {matches.length === 0 && trimmedSearch !== '' && (
                      <p className="empty-hint">Ningún alimento coincide.</p>
                    )}
                    {matches.length === 0 && trimmedSearch === '' && (
                      <p className="empty-hint">Buscá un alimento para agregarlo.</p>
                    )}
                  </ul>
                )}
                {error && <p className="error">{error}</p>}
              </>
            ) : (
              <>
                <div className="nutrition-picked-food">
                  <span className="nutrition-food-row-emoji">{selectedFood.emoji}</span>
                  <span className="nutrition-food-row-name">{selectedFood.name}</span>
                  <button
                    type="button"
                    className="sheet-link"
                    onClick={() => setSelectedFood(null)}
                  >
                    cambiar
                  </button>
                </div>

                {/* Lo normal es no tocar nada: la porción ya viene puesta. Los
                    pasos y los atajos evitan el teclado cuando hay que ajustar. */}
                <div className="nutrition-quantity-stepper">
                  <button
                    type="button"
                    aria-label="Menos cantidad"
                    onClick={() => stepQuantity(-1)}
                  >
                    −
                  </button>
                  <label className="nutrition-quantity-field">
                    <input
                      autoComplete="off"
                      type="number"
                      step="any"
                      inputMode="decimal"
                      min={0}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                      aria-label={`Cantidad en ${selectedFood.servingUnit}`}
                    />
                    <span>{selectedFood.servingUnit === 'unidad' ? 'unidad' : selectedFood.servingUnit}</span>
                  </label>
                  <button type="button" aria-label="Más cantidad" onClick={() => stepQuantity(1)}>
                    +
                  </button>
                </div>

                <div className="nutrition-portions">
                  {PORTIONS.map(({ factor, label }) => {
                    const value = selectedFood.servingAmount * factor
                    const active = Math.abs(Number(quantity) - value) < 0.005
                    return (
                      <button
                        key={label}
                        type="button"
                        className={active ? 'active' : ''}
                        onClick={() => setQuantity(trimNumber(value))}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <FoodDetail
                  food={selectedFood}
                  quantity={Number(quantity) || 0}
                  showHeader={false}
                />
                {error && <p className="error">{error}</p>}
              </>
            )}

            {selectedFood && (
              <div className="nutrition-add-entry-foot">
                <button type="submit" className="nutrition-add-cta" disabled={isSubmitting}>
                  Agregar {selectedFood.name}
                  <span className="nutrition-add-cta-kcal">
                    {formatNutrient(previewCalories)} kcal
                  </span>
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleAddManual} className="entity-form" autoComplete="off">
            <label>
              Nombre
              <input
                autoComplete="off"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ej. Almuerzo restaurante X"
                required
              />
            </label>
            <label>
              Calorías (kcal)
              <input
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
                autoComplete="off"
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
            <div className="nutrition-add-entry-foot">
              <button type="submit" className="nutrition-add-cta" disabled={isSubmitting}>
                Agregar
              </button>
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  )
}
