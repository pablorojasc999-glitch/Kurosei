import { useState } from 'react'
import type { FoodItem } from '../domain/types'
import { MICRO_FIELDS, formatNutrient, scaleNutrientProfile } from '../lib/nutrients'

interface FoodDetailProps {
  food: FoodItem
  quantity: number
  /** Fuera cuando quien llama ya nombra el alimento justo encima, para no decirlo dos veces seguidas. */
  showHeader?: boolean
}

/** Full macro + micronutrient breakdown for a food, scaled to `quantity` — used both while adding an entry and when reviewing one already logged. Renders inline (never a fixed-position overlay) so it simply scrolls with the page instead of ever getting clipped. */
export function FoodDetail({ food, quantity, showHeader = true }: FoodDetailProps) {
  // Los micros se abren a mano: son hasta 22 filas, y desplegadas empujaban
  // fuera de la vista lo que de verdad se mira al anotar, que son las calorías.
  const [showMicros, setShowMicros] = useState(false)

  const scaled = scaleNutrientProfile(food, quantity)
  const unit = food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit
  const micros = MICRO_FIELDS.filter(({ key }) => scaled[key] !== null)

  return (
    <div className="nutrition-food-detail">
      {showHeader && (
        <div className="nutrition-food-detail-header">
          <span className="nutrition-food-detail-emoji">{food.emoji}</span>
          <span className="nutrition-entry-info">
            <strong>{food.name}</strong>
            {food.brand && <span className="finance-transaction-subtitle">{food.brand}</span>}
          </span>
        </div>
      )}

      {/* Las cuatro cifras en una tira de una fila, como la de la Bitácora: en
          tarjetas grandes ocupaban más que el propio acto de elegir. */}
      <div className="nutrition-macro-strip">
        <span>
          <small>kcal</small>
          {formatNutrient(scaled.calories)}
        </span>
        <span>
          <small>Prot</small>
          {formatNutrient(scaled.proteinG)}
        </span>
        <span>
          <small>Carb</small>
          {formatNutrient(scaled.carbsG)}
        </span>
        <span>
          <small>Grasa</small>
          {formatNutrient(scaled.fatG)}
        </span>
      </div>
      <p className="contributions-hint">
        Para {formatNutrient(quantity)} {unit}
      </p>

      {micros.length > 0 && (
        <>
          <button
            type="button"
            className="nutrition-micros-toggle"
            aria-expanded={showMicros}
            onClick={() => setShowMicros((prev) => !prev)}
          >
            <span className="nutrition-micros-caret" aria-hidden="true">
              ▸
            </span>
            Micronutrientes
          </button>
          {showMicros && (
            <div className="nutrition-food-detail-micros">
              <ul>
                {micros.map(({ key, label, unit: microUnit }) => (
                  <li key={key}>
                    <span>{label}</span>
                    <span>
                      {formatNutrient(scaled[key] as number)} {microUnit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
