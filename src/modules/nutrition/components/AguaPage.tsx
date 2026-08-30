import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { addWaterEntry, getWaterTotalMl, listWaterEntriesForDate, softDeleteWaterEntry } from '../db/nutritionRepository'

export function AguaPage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const dateKey = toDateKey(selectedDate)

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
    <div className="page">
      <h1>Agua</h1>

      <div className="day-nav">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          aria-label="Día anterior"
        >
          ‹
        </button>
        <span className="day-nav-label">
          <DayHeaderLabel date={selectedDate} />
        </span>
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      <div className="nutrition-water-total">{totalMl} ml</div>

      <form onSubmit={handleSubmit} className="entity-form">
        <label>
          Agregar (ml)
          <input
            type="number"
            step="any"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej. 293"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Agregar</button>
      </form>

      <ul className="finance-transaction-list">
        {entries?.map((entry) => (
          <li key={entry.id} className="finance-transaction-row">
            <span className="finance-transaction-row-body">
              <span className="finance-transaction-emoji">💧</span>
              <span className="finance-transaction-info">
                <strong>{entry.amountMl} ml</strong>
              </span>
            </span>
            <ConfirmDeleteButton
              variant="icon"
              label="Eliminar registro de agua"
              confirmMessage="¿Eliminar este registro?"
              onConfirm={() => softDeleteWaterEntry(entry.id)}
            />
          </li>
        ))}
        {entries?.length === 0 && <p className="empty-hint">Todavía no registraste agua hoy.</p>}
      </ul>
    </div>
  )
}
