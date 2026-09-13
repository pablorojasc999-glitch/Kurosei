import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  addWaterEntry,
  getWaterTotalMl,
  listWaterEntriesForDate,
  softDeleteWaterEntry,
} from '../db/nutritionRepository'

interface WaterSectionProps {
  /** `YYYY-MM-DD`. La fecha la pone quien la usa: acá no se navega entre días. */
  dateKey: string
}

/**
 * El agua de un día: total, alta y baja de registros.
 *
 * Vive aparte de la página para que el registro diario y la pestaña Agua sean
 * la misma cosa y no dos implementaciones que se van separando con el tiempo.
 */
export function WaterSection({ dateKey }: WaterSectionProps) {
  const entries = useLiveQuery(() => listWaterEntriesForDate(dateKey), [dateKey])
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresá una cantidad válida en ml.')
      return
    }
    await addWaterEntry(dateKey, parsed)
    setAmount('')
  }

  const totalMl = getWaterTotalMl(entries ?? [])

  return (
    <section className="nutrition-meal-section">
      <div className="nutrition-meal-section-header">
        <h2>Agua</h2>
        <span className="nutrition-meal-section-totals">💧 {totalMl} ml</span>
      </div>

      <form onSubmit={handleSubmit} className="nutrition-water-form" autoComplete="off">
        <label>
          <span className="sr-only">Cantidad en mililitros</span>
          <input
            autoComplete="off"
            type="number"
            step="any"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej. 293 ml"
          />
        </label>
        <button type="submit" disabled={amount.trim() === ''}>
          Agregar
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {entries?.length === 0 ? (
        <p className="empty-hint">Todavía no registraste agua.</p>
      ) : (
        <ul className="nutrition-water-list">
          {entries?.map((entry) => (
            <li key={entry.id} className="nutrition-water-row">
              <span className="nutrition-water-amount">💧 {entry.amountMl} ml</span>
              <ConfirmDeleteButton
                variant="icon"
                label="Eliminar registro de agua"
                confirmMessage="¿Eliminar este registro?"
                onConfirm={() => softDeleteWaterEntry(entry.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
