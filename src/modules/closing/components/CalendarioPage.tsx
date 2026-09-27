import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import {
  addMonths,
  buildMonthGrid,
  startOfMonth,
  toDateKey,
} from '../../training/lib/calendarGrid'
import { listDayCompletions } from '../db/closingQueries'
import { firstClosureDate } from '../db/closingRepository'
import { CompletionRing } from './CompletionRing'
import { DayDetailSheet } from './DayDetailSheet'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface CalendarioPageProps {
  onOpenDay: (date: Date) => void
}

/**
 * El mes de un vistazo: un anillo por día con lo que se cerró y lo que falta.
 *
 * Es la respuesta a "¿me quedó algo a medias esta semana?", que hasta ahora
 * había que contestar entrando día por día en cada módulo.
 */
export function CalendarioPage({ onOpenDay }: CalendarioPageProps) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<string | null>(null)

  const cells = buildMonthGrid(monthStart)
  const from = toDateKey(cells[0])
  const to = toDateKey(cells[cells.length - 1])
  const completions = useLiveQuery(() => listDayCompletions(from, to), [from, to])
  const startedAt = useLiveQuery(() => firstClosureDate(), [])

  const byDate = new Map((completions ?? []).map((d) => [d.date, d]))
  const todayKey = toDateKey(new Date())
  const monthLabel = monthStart.toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })
  // Sólo los días del mes que se está mirando, sin el futuro —un día que
  // todavía no pasó no está pendiente— y sin lo anterior al primer cierre, que
  // son días de cuando esto no existía y sólo servirían para desanimar.
  const delMes = (completions ?? []).filter(
    (d) =>
      d.date.slice(0, 7) === toDateKey(monthStart).slice(0, 7) &&
      d.date <= todayKey &&
      startedAt != null &&
      d.date >= startedAt,
  )
  const completos = delMes.filter((d) => d.complete).length

  return (
    <div className="page">
      <h1>Constancia</h1>

      <div className="day-nav">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setMonthStart((m) => addMonths(m, -1))}
        >
          ‹
        </button>
        <span className="day-nav-label">
          <strong>{monthLabel}</strong>
          <span className="constancia-score">
            {delMes.length === 0
              ? 'La cuenta arranca el primer día que cierres'
              : `${completos} de ${delMes.length} día${delMes.length === 1 ? '' : 's'} completo${
                  delMes.length === 1 ? '' : 's'
                }`}
          </span>
        </span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => setMonthStart((m) => addMonths(m, 1))}
        >
          ›
        </button>
      </div>

      <section className="elevated-section">
        <div className="constancia-grid">
          {WEEKDAYS.map((d) => (
            <span key={d} className="constancia-weekday">
              {d}
            </span>
          ))}
          {cells.map((cell) => {
            const key = toDateKey(cell)
            const day = byDate.get(key)
            const outside = cell.getMonth() !== monthStart.getMonth()
            const future = key > todayKey
            // Antes del primer cierre no hay nada que reclamar: se dibuja
            // liso, igual que el futuro, para que el calendario no muestre
            // dieciocho días pendientes que el contador no cuenta.
            const beforeStart = startedAt == null || key < startedAt
            return (
              <button
                key={key}
                type="button"
                className={[
                  'constancia-cell',
                  outside ? 'constancia-cell--outside' : '',
                  key === todayKey ? 'constancia-cell--today' : '',
                  future || beforeStart ? 'constancia-cell--future' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${cell.getDate()}: ${day ? `${day.doneCount} de 4 cerrados` : 'sin datos'}`}
                onClick={() => setSelected(key)}
              >
                {day && !future && !beforeStart ? (
                  <CompletionRing day={day} size={34}>
                    {cell.getDate()}
                  </CompletionRing>
                ) : (
                  <span className="constancia-plain">{cell.getDate()}</span>
                )}
              </button>
            )
          })}
        </div>

        <ul className="constancia-legend">
          <li>
            <span className="legend-dot legend-dot--training" /> Entrenamiento
          </li>
          <li>
            <span className="legend-dot legend-dot--nutrition" /> Nutrición
          </li>
          <li>
            <span className="legend-dot legend-dot--finance" /> Finanzas
          </li>
          <li>
            <span className="legend-dot legend-dot--bitacora" /> Bitácora
          </li>
        </ul>
        <p className="empty-hint">
          Cada arco es un módulo, siempre en el mismo lugar: arriba entrenamiento y
          después en el sentido del reloj. Tocá un día para cerrarlo.
        </p>
      </section>

      {selected && (
        <DayDetailSheet
          date={selected}
          onClose={() => setSelected(null)}
          onOpenDay={onOpenDay}
        />
      )}
    </div>
  )
}
