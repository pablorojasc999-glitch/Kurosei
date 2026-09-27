import { useLiveQuery } from 'dexie-react-hooks'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { closeDay, listClosuresForDate, reopenDay } from '../db/closingRepository'
import type { ClosableModule } from '../domain/types'
import {
  buildDayCompletion,
  EMPTY_LABELS,
  MODULE_LABELS,
  type ModuleState,
} from '../lib/dayCompletion'

interface DayCloseCardProps {
  /** `YYYY-MM-DD`. */
  date: string
  module: ClosableModule
  /** La pregunta de arriba; sin esto se arma una a partir del módulo. */
  prompt?: string
}

const DONE_LABELS: Record<ClosableModule, string> = {
  training: 'Entrené',
  nutrition: 'Registré todo',
  finance: 'Registré todo',
}

function stateLabel(module: ClosableModule, state: ModuleState): string {
  if (state === 'empty') return EMPTY_LABELS[module]
  return DONE_LABELS[module]
}

/**
 * El cierre de un módulo en un día: las dos respuestas posibles, o la
 * confirmación de la que ya se dio.
 *
 * Hacen falta las dos porque "no hay datos" y "no había nada que registrar" se
 * ven igual desde la base. Sin el segundo botón, un día de descanso o sin
 * gastos quedaría pendiente para siempre y la lista de pendientes dejaría de
 * servir de tanto ruido.
 */
export function DayCloseCard({ date, module, prompt }: DayCloseCardProps) {
  const closures = useLiveQuery(() => listClosuresForDate(date), [date])
  const { isSubmitting, guard } = useSubmitGuard()

  if (!closures) return null
  const day = buildDayCompletion({ date, closures, log: undefined })
  const state = day[module]

  if (state !== 'pending') {
    return (
      <div className="day-close day-close--done">
        <span className="day-close-check" aria-hidden="true">
          ✓
        </span>
        <span className="day-close-state">{stateLabel(module, state)}</span>
        <button
          type="button"
          className="day-close-reopen"
          disabled={isSubmitting}
          onClick={() => void guard(() => reopenDay(date, module))}
        >
          Reabrir
        </button>
      </div>
    )
  }

  return (
    <div className="day-close">
      <p className="day-close-prompt">
        {prompt ?? `¿Listo con ${MODULE_LABELS[module].toLowerCase()} de este día?`}
      </p>
      <div className="day-close-actions">
        <button
          type="button"
          className="day-close-primary"
          disabled={isSubmitting}
          onClick={() =>
            void guard(async () => {
              await closeDay(date, module, 'done')
            })
          }
        >
          {DONE_LABELS[module]}
        </button>
        <button
          type="button"
          className="day-close-secondary"
          disabled={isSubmitting}
          onClick={() =>
            void guard(async () => {
              await closeDay(date, module, 'none')
            })
          }
        >
          {EMPTY_LABELS[module]}
        </button>
      </div>
    </div>
  )
}
