import { useState } from 'react'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { WaterSection } from './WaterSection'

export function AguaPage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))

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
