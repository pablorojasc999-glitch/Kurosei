import { useLiveQuery } from 'dexie-react-hooks'
import { getRecentRpeDeviations } from '../db/metricsQueries'
import { needsDeloadAlert } from '../lib/metrics'

const RECENT_SESSIONS_TO_CHECK = 3

interface DeloadAlertProps {
  exerciseId: string
}

export function DeloadAlert({ exerciseId }: DeloadAlertProps) {
  const deviations = useLiveQuery(
    () => getRecentRpeDeviations(exerciseId, RECENT_SESSIONS_TO_CHECK),
    [exerciseId],
  )

  if (!deviations || !needsDeloadAlert(deviations)) return null

  return (
    <p className="deload-alert">
      ⚠️ RPE por encima de lo planificado en las últimas {deviations.length}{' '}
      sesiones — considerá un deload.
    </p>
  )
}
