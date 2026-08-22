import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import { listAllExecutedSetsWithContext } from '../db/metricsQueries'
import { calculateE1rm } from '../lib/e1rm'
import { formatDate } from '../lib/format'
import { buildE1rmTrend, muscleGroupVolume } from '../lib/metrics'

const RECENT_DAYS = 7
const RECENT_WINDOW_MS = RECENT_DAYS * 24 * 60 * 60 * 1000

export function ProgressPage() {
  const setsWithContext = useLiveQuery(() => listAllExecutedSetsWithContext(), [])
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

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [now] = useState(() => Date.now())

  if (!setsWithContext || !exercises || !muscleGroups || !contributions) {
    return null
  }

  function exerciseName(id: string): string {
    return exercises?.find((e) => e.id === id)?.name ?? '?'
  }
  function muscleGroupName(id: string): string {
    return muscleGroups?.find((g) => g.id === id)?.name ?? '?'
  }

  const setsWithE1rm = setsWithContext.map((s) => ({
    ...s,
    e1rm: calculateE1rm({
      weightKg: s.weightKg ?? 0,
      reps: s.reps,
      rpe: s.rpe ?? undefined,
    }),
  }))

  const exerciseIdsWithHistory = [
    ...new Set(setsWithE1rm.map((s) => s.exerciseId)),
  ].sort((a, b) => exerciseName(a).localeCompare(exerciseName(b)))

  if (exerciseIdsWithHistory.length === 0) {
    return (
      <div className="page">
        <h1>Progreso</h1>
        <p className="empty-hint">
          Todavía no registraste series ejecutadas — entrená alguna sesión
          para ver tus métricas acá.
        </p>
      </div>
    )
  }

  const personalRecords = exerciseIdsWithHistory.map((exerciseId) => {
    const sets = setsWithE1rm.filter((s) => s.exerciseId === exerciseId)
    return {
      exerciseId,
      maxWeight: Math.max(...sets.map((s) => s.weightKg ?? 0)),
      maxE1rm: Math.max(...sets.map((s) => s.e1rm)),
    }
  })

  const recentCutoff = now - RECENT_WINDOW_MS
  const recentSets = setsWithE1rm.filter(
    (s) => new Date(s.performedAt).getTime() >= recentCutoff,
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
  const volumeByGroup = [
    ...muscleGroupVolume(recentSets, contributionsByExercise).entries(),
  ].sort((a, b) => b[1] - a[1])
  const maxVolume = Math.max(1, ...volumeByGroup.map(([, v]) => v))

  const trendExerciseId = exerciseIdsWithHistory.includes(selectedExerciseId)
    ? selectedExerciseId
    : exerciseIdsWithHistory[0]
  const trendPoints = buildE1rmTrend(
    setsWithE1rm
      .filter((s) => s.exerciseId === trendExerciseId)
      .map((s) => ({ date: s.performedAt, e1rm: s.e1rm })),
  )

  return (
    <div className="page">
      <h1>Progreso</h1>

      <section>
        <h2>Récords personales</h2>
        <ul className="pr-table">
          {personalRecords.map((pr) => (
            <li key={pr.exerciseId} className="pr-row">
              <span>{exerciseName(pr.exerciseId)}</span>
              <span className="numeric">{pr.maxWeight} kg</span>
              <span className="numeric">e1RM {Math.round(pr.maxE1rm)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Volumen por grupo muscular (últimos {RECENT_DAYS} días)</h2>
        {volumeByGroup.length === 0 ? (
          <p className="empty-hint">Sin series recientes.</p>
        ) : (
          <ul className="volume-bars">
            {volumeByGroup.map(([groupId, value]) => (
              <li key={groupId} className="volume-bar-row">
                <span className="volume-bar-label">{muscleGroupName(groupId)}</span>
                <div className="volume-bar-track">
                  <div
                    className="volume-bar-fill"
                    style={{ width: `${(value / maxVolume) * 100}%` }}
                  />
                </div>
                <span className="volume-bar-value numeric">
                  {value.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Tendencia de e1RM</h2>
        <select
          value={trendExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
        >
          {exerciseIdsWithHistory.map((id) => (
            <option key={id} value={id}>
              {exerciseName(id)}
            </option>
          ))}
        </select>
        {trendPoints.length === 0 ? (
          <p className="empty-hint">Sin historial para este ejercicio.</p>
        ) : (
          <ul className="trend-list">
            {trendPoints.map((p, i) => (
              <li key={i} className="trend-row">
                <span>{formatDate(p.date)}</span>
                <span className="numeric">{Math.round(p.e1rm)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
