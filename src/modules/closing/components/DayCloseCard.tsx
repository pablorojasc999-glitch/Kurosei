import { useCallback, useState } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { useSupabaseSession } from '../../../shared/hooks/useSupabaseSession'
import { closeDay, listClosuresForDate, reopenDay } from '../db/closingRepository'
import type { ClosableModule, ClosureKind } from '../domain/types'
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
  /** Avisa a quien lo embeba (p. ej. la hoja de detalle del calendario) que el cierre cambió, para que refresque lo que muestra. */
  onChange?: () => void
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
export function DayCloseCard({ date, module, prompt, onChange }: DayCloseCardProps) {
  const session = useSupabaseSession()
  const { data: closures, refresh } = useRemoteQuery(
    useCallback(async () => {
      if (session === undefined) return undefined
      return session ? listClosuresForDate(date) : []
    }, [session, date]),
  )
  const { isSubmitting, guard } = useSubmitGuard()
  const [error, setError] = useState<string | null>(null)

  if (!closures) return null
  const day = buildDayCompletion({ date, closures, log: undefined })
  const state = day[module]

  async function handleClose(kind: ClosureKind) {
    setError(null)
    try {
      await closeDay(date, module, kind)
      await refresh()
      onChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  async function handleReopen() {
    setError(null)
    try {
      await reopenDay(date, module)
      await refresh()
      onChange?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

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
          onClick={() => void guard(handleReopen)}
        >
          Reabrir
        </button>
        {error && <p className="error">{error}</p>}
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
          onClick={() => void guard(() => handleClose('done'))}
        >
          {DONE_LABELS[module]}
        </button>
        <button
          type="button"
          className="day-close-secondary"
          disabled={isSubmitting}
          onClick={() => void guard(() => handleClose('none'))}
        >
          {EMPTY_LABELS[module]}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
