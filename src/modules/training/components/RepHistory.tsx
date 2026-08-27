import { useLiveQuery } from 'dexie-react-hooks'
import { listExecutedSetsForExerciseByReps } from '../db/executionRepository'
import { calculateE1rm } from '../lib/e1rm'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

interface RepHistoryProps {
  exerciseId: string
  reps: number
}

export function RepHistory({ exerciseId, reps }: RepHistoryProps) {
  const history = useLiveQuery(
    () => listExecutedSetsForExerciseByReps(exerciseId, reps),
    [exerciseId, reps],
  )

  if (!reps || Number.isNaN(reps)) return null
  if (!history?.length) {
    return (
      <p className="rep-history-empty">Sin historial previo a {reps} reps.</p>
    )
  }

  return (
    <div className="rep-history">
      <span className="rep-history-title">Historial a {reps} reps</span>
      <ul className="rep-history-list">
        {history.map((s) => (
          <li key={s.id}>
            <span>{formatDate(s.performedAt)}</span>
            <span>
              {s.weightKg ?? '-'} kg × {s.reps}
              {s.rpe !== null && ` · RPE ${s.rpe}`}
            </span>
            <span>
              e1RM{' '}
              {Math.round(
                calculateE1rm({
                  weightKg: s.weightKg ?? 0,
                  reps: s.reps,
                  rpe: s.rpe ?? undefined,
                }),
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
