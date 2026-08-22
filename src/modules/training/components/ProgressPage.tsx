import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import { BodyMap } from './BodyMap'
import { listAllExecutedSetsWithContext } from '../db/metricsQueries'
import { listWeeksWithContext } from '../db/planningRepository'
import { matchBodyRegion } from '../lib/bodyMap'
import type { BodyRegionKey } from '../lib/bodyMap'
import { calculateE1rm } from '../lib/e1rm'
import { formatDate } from '../lib/format'
import { buildE1rmTrend, muscleGroupStressIndex, muscleGroupVolume } from '../lib/metrics'
import {
  calculateStressIndex,
  classifyStressLevel,
  STRESS_LEVEL_LABELS,
} from '../lib/stressIndex'

function weekLabel(week: {
  macrocycleName: string
  mesocycleName: string
  order: number
  dayDates: string[]
}): string {
  const range =
    week.dayDates.length > 0
      ? ` (${formatDate(week.dayDates[0])} - ${formatDate(week.dayDates[week.dayDates.length - 1])})`
      : ''
  return `${week.macrocycleName} / ${week.mesocycleName} / Semana ${week.order + 1}${range}`
}

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
  const weeks = useLiveQuery(() => listWeeksWithContext(), [])

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [selectedWeekId, setSelectedWeekId] = useState('')
  const [now] = useState(() => Date.now())

  if (!setsWithContext || !exercises || !muscleGroups || !contributions || !weeks) {
    return null
  }

  const nowIso = new Date(now).toISOString()
  const currentOrPastWeeks = weeks.filter(
    (w) => w.dayDates.length > 0 && w.dayDates[0] <= nowIso,
  )
  const defaultWeekId =
    currentOrPastWeeks[currentOrPastWeeks.length - 1]?.id ?? weeks[0]?.id ?? ''
  const activeWeekId = weeks.some((w) => w.id === selectedWeekId)
    ? selectedWeekId
    : defaultWeekId

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

  const weekSets = setsWithE1rm.filter((s) => s.weekId === activeWeekId)
  const contributionsByExercise = new Map<
    string,
    { muscleGroupId: string; factor: number }[]
  >()
  for (const c of contributions) {
    const list = contributionsByExercise.get(c.exerciseId) ?? []
    list.push({ muscleGroupId: c.muscleGroupId, factor: c.factor })
    contributionsByExercise.set(c.exerciseId, list)
  }
  const volumeByGroup = [
    ...muscleGroupVolume(weekSets, contributionsByExercise).entries(),
  ].sort((a, b) => b[1] - a[1])
  const maxVolume = Math.max(1, ...volumeByGroup.map(([, v]) => v))

  const valuesByRegion: Partial<Record<BodyRegionKey, number>> = {}
  for (const [groupId, value] of volumeByGroup) {
    const region = matchBodyRegion(muscleGroupName(groupId))
    if (!region) continue
    valuesByRegion[region] = (valuesByRegion[region] ?? 0) + value
  }
  const maxRegionValue = Math.max(1, ...Object.values(valuesByRegion))

  const stressByGroup = [
    ...muscleGroupStressIndex(
      weekSets,
      contributionsByExercise,
      calculateStressIndex,
    ).entries(),
  ].sort((a, b) => b[1] - a[1])

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
        <h2>Volumen semanal</h2>
        {weeks.length === 0 ? (
          <p className="empty-hint">
            Todavía no armaste una semana en Periodización — el volumen se
            cuenta por semana planificada.
          </p>
        ) : (
          <select
            value={activeWeekId}
            onChange={(e) => setSelectedWeekId(e.target.value)}
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {weekLabel(w)}
              </option>
            ))}
          </select>
        )}
      </section>

      <section>
        <h2>Mapa corporal</h2>
        <BodyMap valuesByRegion={valuesByRegion} maxValue={maxRegionValue} />
      </section>

      <section>
        <h2>Series por grupo muscular</h2>
        {volumeByGroup.length === 0 ? (
          <p className="empty-hint">Sin series en esta semana.</p>
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
        <h2>Estrés por grupo muscular</h2>
        {stressByGroup.length === 0 ? (
          <p className="empty-hint">Sin series con RPE cargado en esta semana.</p>
        ) : (
          <ul className="stress-list">
            {stressByGroup.map(([groupId, value]) => {
              const level = classifyStressLevel(value)
              return (
                <li key={groupId} className={`stress-row stress-row--${level}`}>
                  <span>{muscleGroupName(groupId)}</span>
                  <span className="numeric">{value.toFixed(1)}</span>
                  <span className="stress-badge">
                    {STRESS_LEVEL_LABELS[level]}
                  </span>
                </li>
              )
            })}
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
