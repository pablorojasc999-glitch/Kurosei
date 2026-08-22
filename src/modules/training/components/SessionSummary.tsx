import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../shared/db/database'
import { calculateE1rm } from '../lib/e1rm'
import { isNewPR, muscleGroupVolume, tonnage } from '../lib/metrics'

interface SessionSummaryProps {
  sessionId: string
}

export function SessionSummary({ sessionId }: SessionSummaryProps) {
  const allSessionExercises = useLiveQuery(
    () =>
      db.training_session_exercises.filter((se) => se.deletedAt === null).toArray(),
    [],
  )
  const allExecutedSets = useLiveQuery(
    () => db.training_executed_sets.filter((s) => s.deletedAt === null).toArray(),
    [],
  )
  const exercises = useLiveQuery(
    () => db.training_exercises.filter((e) => e.deletedAt === null).toArray(),
    [],
  )
  const muscleGroups = useLiveQuery(
    () => db.training_muscle_groups.filter((g) => g.deletedAt === null).toArray(),
    [],
  )
  const contributions = useLiveQuery(
    () =>
      db.training_exercise_muscle_contributions
        .filter((c) => c.deletedAt === null)
        .toArray(),
    [],
  )

  if (!allSessionExercises || !allExecutedSets || !exercises || !contributions) {
    return null
  }

  const sessionExerciseIdToExerciseId = new Map(
    allSessionExercises.map((se) => [se.id, se.exerciseId]),
  )
  const sessionExerciseIdToSessionId = new Map(
    allSessionExercises.map((se) => [se.id, se.sessionId]),
  )

  const setsWithContext = allExecutedSets.map((s) => ({
    ...s,
    exerciseId: sessionExerciseIdToExerciseId.get(s.sessionExerciseId) ?? '',
    sessionId: sessionExerciseIdToSessionId.get(s.sessionExerciseId) ?? '',
    e1rm: calculateE1rm({ weightKg: s.weightKg ?? 0, reps: s.reps, rpe: s.rpe ?? undefined }),
  }))

  const thisSessionSets = setsWithContext.filter((s) => s.sessionId === sessionId)
  if (thisSessionSets.length === 0) return null

  const thisTonnage = tonnage(
    thisSessionSets.map((s) => ({ weightKg: s.weightKg ?? 0, reps: s.reps })),
  )

  const contributionsByExercise = new Map<
    string,
    { muscleGroupId: string; percentage: number }[]
  >()
  for (const c of contributions) {
    const list = contributionsByExercise.get(c.exerciseId) ?? []
    list.push({ muscleGroupId: c.muscleGroupId, percentage: c.percentage })
    contributionsByExercise.set(c.exerciseId, list)
  }
  const volumeByGroup = muscleGroupVolume(thisSessionSets, contributionsByExercise)

  function exerciseName(id: string): string {
    return exercises?.find((e) => e.id === id)?.name ?? '?'
  }
  function muscleGroupName(id: string): string {
    return muscleGroups?.find((g) => g.id === id)?.name ?? '?'
  }

  const exerciseIdsInSession = [...new Set(thisSessionSets.map((s) => s.exerciseId))]

  const prs: { exerciseId: string; type: 'weight' | 'e1rm' }[] = []
  for (const exerciseId of exerciseIdsInSession) {
    const historicalSets = setsWithContext.filter(
      (s) => s.exerciseId === exerciseId && s.sessionId !== sessionId,
    )
    const thisExerciseSets = thisSessionSets.filter(
      (s) => s.exerciseId === exerciseId,
    )

    const priorMaxWeight = historicalSets.length
      ? Math.max(...historicalSets.map((s) => s.weightKg ?? 0))
      : null
    const bestWeightThisSession = Math.max(
      ...thisExerciseSets.map((s) => s.weightKg ?? 0),
    )
    if (isNewPR(bestWeightThisSession, priorMaxWeight)) {
      prs.push({ exerciseId, type: 'weight' })
    }

    const priorMaxE1rm = historicalSets.length
      ? Math.max(...historicalSets.map((s) => s.e1rm))
      : null
    const bestE1rmThisSession = Math.max(...thisExerciseSets.map((s) => s.e1rm))
    if (isNewPR(bestE1rmThisSession, priorMaxE1rm)) {
      prs.push({ exerciseId, type: 'e1rm' })
    }
  }

  const tonnageBySession = new Map<string, number>()
  for (const s of setsWithContext) {
    if (!s.sessionId) continue
    tonnageBySession.set(
      s.sessionId,
      (tonnageBySession.get(s.sessionId) ?? 0) + (s.weightKg ?? 0) * s.reps,
    )
  }
  const priorMaxSessionTonnage = Math.max(
    0,
    ...[...tonnageBySession.entries()]
      .filter(([id]) => id !== sessionId)
      .map(([, t]) => t),
  )
  const isSessionVolumePR = isNewPR(
    thisTonnage,
    tonnageBySession.size > 1 ? priorMaxSessionTonnage : null,
  )

  return (
    <div className="session-summary">
      <h3>Resumen de la sesión</h3>
      <p className="summary-tonnage">{Math.round(thisTonnage)} kg de tonelaje</p>
      {isSessionVolumePR && <span className="pr-badge">🏆 PR de volumen de sesión</span>}

      {volumeByGroup.size > 0 && (
        <div className="muscle-volume-list">
          {[...volumeByGroup.entries()].map(([groupId, sets]) => (
            <span key={groupId} className="muscle-volume-chip">
              {muscleGroupName(groupId)}: {sets.toFixed(1)} series
            </span>
          ))}
        </div>
      )}

      {prs.length > 0 && (
        <div className="pr-list">
          {prs.map((pr, i) => (
            <span key={i} className="pr-badge">
              🏆 {exerciseName(pr.exerciseId)} ·{' '}
              {pr.type === 'weight' ? 'peso máximo' : 'e1RM máximo'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
