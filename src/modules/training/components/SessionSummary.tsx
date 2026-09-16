import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../shared/db/database'
import { listAllExecutedSetsWithContext } from '../db/metricsQueries'
import { e1rmForSet } from '../lib/e1rm'
import { isNewPR, maxOrNull, muscleGroupVolume, tonnage } from '../lib/metrics'
import { mergeMuscleGroupTotals } from '../lib/muscleGroupTotals'

interface SessionSummaryProps {
  sessionId: string
}

export function SessionSummary({ sessionId }: SessionSummaryProps) {
  const allExecutedSets = useLiveQuery(() => listAllExecutedSetsWithContext(), [])
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

  if (!allExecutedSets || !exercises || !contributions) {
    return null
  }

  // Sin peso anotado no hay e1RM: un ejercicio a peso corporal no marca récord
  // de carga en cada sesión sólo porque "0" gana cuando no hay nada anterior.
  const setsWithContext = allExecutedSets.map((s) => ({ ...s, e1rm: e1rmForSet(s) }))

  const thisSessionSets = setsWithContext.filter((s) => s.sessionId === sessionId)
  if (thisSessionSets.length === 0) return null

  const thisTonnage = tonnage(
    thisSessionSets.map((s) => ({ weightKg: s.weightKg ?? 0, reps: s.reps })),
  )

  const contributionsByExercise = new Map<
    string,
    { muscleGroupId: string; factor: number }[]
  >()
  for (const c of contributions) {
    const list = contributionsByExercise.get(c.exerciseId) ?? []
    list.push({ muscleGroupId: c.muscleGroupId, factor: c.factor })
    contributionsByExercise.set(c.exerciseId, list)
  }
  const volumeByGroup = muscleGroupVolume(thisSessionSets, contributionsByExercise)
  const volumeTotals = mergeMuscleGroupTotals(volumeByGroup, muscleGroupName)

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

    const weights = (sets: typeof thisExerciseSets) =>
      sets.map((s) => s.weightKg).filter((w): w is number => w !== null)
    const e1rms = (sets: typeof thisExerciseSets) =>
      sets.map((s) => s.e1rm).filter((v): v is number => v !== null)

    const bestWeightThisSession = maxOrNull(weights(thisExerciseSets))
    if (
      bestWeightThisSession !== null &&
      isNewPR(bestWeightThisSession, maxOrNull(weights(historicalSets)))
    ) {
      prs.push({ exerciseId, type: 'weight' })
    }

    const bestE1rmThisSession = maxOrNull(e1rms(thisExerciseSets))
    if (
      bestE1rmThisSession !== null &&
      isNewPR(bestE1rmThisSession, maxOrNull(e1rms(historicalSets)))
    ) {
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
      <p className="summary-tonnage numeric">{Math.round(thisTonnage)} kg de tonelaje</p>
      {isSessionVolumePR && <span className="pr-badge">🏆 PR de volumen de sesión</span>}

      {volumeTotals.length > 0 && (
        <div className="muscle-volume-list">
          {volumeTotals.map((g) => (
            <span key={g.key} className="muscle-volume-chip">
              {g.name}: {g.value.toFixed(1)} series
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
