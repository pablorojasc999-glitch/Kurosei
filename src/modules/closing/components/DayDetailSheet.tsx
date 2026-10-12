import { useCallback } from 'react'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { getDailyLog } from '../../training/db/bitacoraRepository'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { formatDayHeader, parseDateInput } from '../../training/lib/calendarGrid'
import { listClosuresForDate } from '../db/closingRepository'
import type { ClosableModule } from '../domain/types'
import {
  buildDayCompletion,
  missingBitacoraFields,
  MODULE_LABELS,
  pendingModules,
} from '../lib/dayCompletion'
import { CompletionRing } from './CompletionRing'
import { DayCloseCard } from './DayCloseCard'

const CLOSABLE: ClosableModule[] = ['training', 'nutrition', 'finance']

interface DayDetailSheetProps {
  date: string
  onClose: () => void
  /** Abre ese día en Registro, para ir a llenar lo que falte. */
  onOpenDay: (date: Date) => void
  /** Avisa al calendario que algo cambió, para que refresque sus anillos. */
  onChange: () => void
}

/**
 * Todo lo que le falta a un día, y los botones para cerrarlo sin salir de acá.
 *
 * Existe porque Finanzas navega por mes y no por día: su cierre diario no
 * tiene dónde vivir en su propia pantalla. Y de paso resuelve el caso real de
 * ponerse al día con una semana entera sin ir módulo por módulo.
 */
export function DayDetailSheet({ date, onClose, onOpenDay, onChange }: DayDetailSheetProps) {
  const { data, refresh } = useRemoteQuery(
    useCallback(async () => {
      const [closures, log] = await Promise.all([listClosuresForDate(date), getDailyLog(date)])
      return { closures, log }
    }, [date]),
  )

  // Un cierre adentro de una de las tarjetas cambia tanto lo que se ve acá
  // (el resumen de arriba) como el anillo del día en el calendario.
  async function handleChange() {
    await refresh()
    onChange()
  }

  const day = data
    ? buildDayCompletion({ date, closures: data.closures, log: data.log ?? undefined })
    : null
  const faltan = data ? missingBitacoraFields(data.log ?? undefined) : []

  return (
    <BottomSheet
      title={formatDayHeader(parseDateInput(date))}
      subtitle={day ? `${day.doneCount} de 4 cerrados` : undefined}
      onClose={onClose}
    >
      {day && (
        <>
          <div className="day-detail-head">
            <CompletionRing day={day} size={34} />
            <p className="day-detail-summary">
              {day.complete
                ? 'Este día está completo.'
                : `Falta ${day.doneCount === 3 ? 'uno' : `${4 - day.doneCount}`}: ${pendingModules(
                    day,
                  )
                    .map((k) => MODULE_LABELS[k].toLowerCase())
                    .join(', ')}.`}
            </p>
          </div>

          {CLOSABLE.map((module) => (
            <section key={module} className="day-detail-module">
              <h3>{MODULE_LABELS[module]}</h3>
              <DayCloseCard date={date} module={module} onChange={handleChange} />
            </section>
          ))}

          <section className="day-detail-module">
            <h3>{MODULE_LABELS.bitacora}</h3>
            {/* La bitácora no se cierra a mano: acá todo campo que falta es un
                campo que falta, así que un botón sería pedir dos veces lo mismo. */}
            {faltan.length === 0 ? (
              <div className="day-close day-close--done">
                <span className="day-close-check" aria-hidden="true">
                  ✓
                </span>
                <span className="day-close-state">Completa</span>
              </div>
            ) : (
              <div className="day-close">
                <p className="day-close-prompt">
                  Falta{faltan.length === 1 ? '' : 'n'}:{' '}
                  {faltan.map((f) => f.label).join(', ')}.
                </p>
                <div className="day-close-actions">
                  <button
                    type="button"
                    className="day-close-primary"
                    onClick={() => {
                      onOpenDay(parseDateInput(date))
                      onClose()
                    }}
                  >
                    Completar bitácora
                  </button>
                </div>
              </div>
            )}
          </section>

          <button
            type="button"
            className="sheet-link"
            onClick={() => {
              onOpenDay(parseDateInput(date))
              onClose()
            }}
          >
            Abrir este día en Registro →
          </button>
        </>
      )}
    </BottomSheet>
  )
}
