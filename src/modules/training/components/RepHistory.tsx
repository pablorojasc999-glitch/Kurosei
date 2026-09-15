import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { listExecutedSetsForExerciseByReps } from '../db/executionRepository'
import {
  e1rmOfSet,
  rankRepHistory,
  REP_HISTORY_LIMIT,
  REP_HISTORY_MODE_LABELS,
  type RepHistoryMode,
} from '../lib/repHistory'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

interface RepHistoryProps {
  exerciseId: string
  reps: number
}

const MODES: RepHistoryMode[] = ['recientes', 'e1rm']

export function RepHistory({ exerciseId, reps }: RepHistoryProps) {
  const history = useLiveQuery(
    () => listExecutedSetsForExerciseByReps(exerciseId, reps),
    [exerciseId, reps],
  )
  const [mode, setMode] = useState<RepHistoryMode>('recientes')

  if (!reps || Number.isNaN(reps)) return null
  if (!history?.length) {
    return (
      <p className="rep-history-empty">Sin historial previo a {reps} reps.</p>
    )
  }

  const shown = rankRepHistory(history, mode)

  return (
    <div className="rep-history">
      <div className="rep-history-header">
        <span className="rep-history-title">Historial a {reps} reps</span>
        <div className="rep-history-modes" role="group" aria-label="Ordenar historial">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`rep-history-mode${mode === m ? ' rep-history-mode--on' : ''}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {REP_HISTORY_MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <ul className="rep-history-list">
        {shown.map((s) => (
          <li key={s.id}>
            <span>{formatDate(s.performedAt)}</span>
            <span>
              {s.weightKg ?? '-'} kg × {s.reps}
              {s.rpe !== null && ` · RPE ${s.rpe}`}
            </span>
            <span>e1RM {Math.round(e1rmOfSet(s))}</span>
          </li>
        ))}
      </ul>
      {history.length > REP_HISTORY_LIMIT && (
        <span className="rep-history-more">
          {shown.length} de {history.length} series a {reps} reps
        </span>
      )}
    </div>
  )
}
