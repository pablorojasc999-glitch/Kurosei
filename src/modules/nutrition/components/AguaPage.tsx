import { useState } from 'react'
import { useSupabaseSession } from '../../../shared/hooks/useSupabaseSession'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { WaterSection } from './WaterSection'

export function AguaPage() {
  const session = useSupabaseSession()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))

  // Ya no hay copia local: sin sesión no hay a quién pedirle el agua.
  if (session === undefined) {
    return (
      <div className="page">
        <h1>Agua</h1>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="page">
        <h1>Agua</h1>
        <p className="empty-hint">
          Iniciá sesión (el ícono de arriba a la derecha) para ver y editar el agua.
        </p>
      </div>
    )
  }

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

      {/* La misma sección que el registro diario: una sola implementación. */}
      <WaterSection dateKey={toDateKey(selectedDate)} />
    </div>
  )
}
