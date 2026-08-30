import type { FoodItem } from '../domain/types'
import { MICRO_FIELDS, formatNutrient, scaleNutrientProfile } from '../lib/nutrients'

interface FoodDetailProps {
  food: FoodItem
  quantity: number
}

/** Full macro + micronutrient breakdown for a food, scaled to `quantity` — used both while adding an entry and when reviewing one already logged. Renders inline (never a fixed-position overlay) so it simply scrolls with the page instead of ever getting clipped. */
export function FoodDetail({ food, quantity }: FoodDetailProps) {
  const scaled = scaleNutrientProfile(food, quantity)
  const unit = food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit
  const micros = MICRO_FIELDS.filter(({ key }) => scaled[key] !== null)

  return (
    <div className="nutrition-food-detail">
      <div className="nutrition-food-detail-header">
        <span className="nutrition-food-detail-emoji">{food.emoji}</span>
        <span className="nutrition-entry-info">
          <strong>{food.name}</strong>
          {food.brand && <span className="finance-transaction-subtitle">{food.brand}</span>}
        </span>
      </div>
      <p className="contributions-hint">
        Valores para {formatNutrient(quantity)} {unit}
      </p>
      <div className="finance-summary-row">
        <div className="finance-summary-card">
          <span>Calorías</span>
          <strong>{formatNutrient(scaled.calories)}</strong>
        </div>
        <div className="finance-summary-card">
          <span>Proteínas</span>
          <strong>{formatNutrient(scaled.proteinG)} g</strong>
        </div>
        <div className="finance-summary-card">
          <span>Carbos</span>
          <strong>{formatNutrient(scaled.carbsG)} g</strong>
        </div>
        <div className="finance-summary-card">
          <span>Grasas</span>
          <strong>{formatNutrient(scaled.fatG)} g</strong>
        </div>
      </div>
      {micros.length > 0 && (
        <div className="nutrition-food-detail-micros">
          <span className="bitacora-nutrition-summary-label">Micronutrientes</span>
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
    </div>
  )
}
