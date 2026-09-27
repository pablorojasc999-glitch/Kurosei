import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addDays, formatDayHeader, parseDateInput, toDateKey } from '../../training/lib/calendarGrid'
import { firstClosureDate } from '../db/closingRepository'
import { listDayCompletions } from '../db/closingQueries'
import { MODULE_LABELS, pendingModules } from '../lib/dayCompletion'
import { CompletionRing } from './CompletionRing'
import { DayDetailSheet } from './DayDetailSheet'

/** Hasta cuánto para atrás se ofrece ponerse al día. */
const WINDOW_DAYS = 30

interface PendientesPageProps {
  onOpenDay: (date: Date) => void
}

/**
 * Los días que quedaron a medias, del más reciente al más viejo.
 *
 * El calendario dice dónde están los huecos; esto los pone en fila para poder
 * cerrarlos de corrido sin ir buscándolos. El día de hoy no aparece: recién
 * está pasando, y meterlo lo dejaría siempre arriba como si fuera una deuda.
 */
export function PendientesPage({ onOpenDay }: PendientesPageProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const today = new Date()
  const to = toDateKey(addDays(today, -1))
  const windowStart = toDateKey(addDays(today, -WINDOW_DAYS))
  const data = useLiveQuery(async () => {
    const first = await firstClosureDate()
    if (first === null) return { started: false, days: [] }
    // Nunca antes del primer día cerrado: lo de antes no son días a medias,
    // son días de cuando esto no existía.
    const from = first > windowStart ? first : windowStart
    return { started: true, days: await listDayCompletions(from, to) }
  }, [windowStart, to])

  const pendientes = (data?.days ?? []).filter((d) => !d.complete).reverse()

  return (
    <div className="page">
      <h1>Pendientes</h1>

      {data === undefined ? (
        <p className="empty-hint">Cargando…</p>
      ) : !data.started ? (
        <section className="elevated-section">
          <p className="pendientes-clear">Todavía no empezaste</p>
          <p className="empty-hint">
            La cuenta arranca el primer día que cierres. Andá a Registro y cerrá el de
            hoy; desde ahí, los que queden a medias aparecen acá.
          </p>
        </section>
      ) : pendientes.length === 0 ? (
        <section className="elevated-section">
          <p className="pendientes-clear">Sin pendientes</p>
          <p className="empty-hint">
            Todo lo que llevás registrado está cerrado.
          </p>
        </section>
      ) : (
        <>
          <p className="empty-hint">
            {pendientes.length} día{pendientes.length === 1 ? '' : 's'} a medias. Tocá uno
            para cerrarlo.
          </p>
          <ul className="pendientes-list">
            {pendientes.map((day) => (
              <li key={day.date}>
                <button
                  type="button"
                  className="pendiente-row"
                  onClick={() => setSelected(day.date)}
                >
                  <CompletionRing day={day} size={38} />
                  <span className="pendiente-main">
                    <span className="pendiente-date">
                      {formatDayHeader(parseDateInput(day.date))}
                    </span>
                    <span className="pendiente-missing">
                      Falta {pendingModules(day).map((k) => MODULE_LABELS[k].toLowerCase()).join(', ')}
                    </span>
                  </span>
                  <span className="pendiente-count">{day.doneCount}/4</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
