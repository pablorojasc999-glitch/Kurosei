import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import { BodyMap } from './BodyMap'
import { listAllExecutedSetsWithContext } from '../db/metricsQueries'
import {
  listMacrocycles,
  listMesocyclesWithContext,
  listWeeksWithContext,
} from '../db/planningRepository'
import { matchBodyRegion } from '../lib/bodyMap'
import type { BodyRegionKey } from '../lib/bodyMap'
import { toDateKey } from '../lib/calendarGrid'
import { calculateE1rm } from '../lib/e1rm'
import { formatDate } from '../lib/format'
import { buildE1rmTrend, muscleGroupStressIndex, muscleGroupVolume } from '../lib/metrics'
import { dayRange, inclusiveRange, isWithinRange } from '../lib/progressScope'
import type { DateRange, ScopeKind } from '../lib/progressScope'
import {
  calculateStressIndex,
  classifyStressLevel,
  STRESS_LEVEL_LABELS,
} from '../lib/stressIndex'

const SCOPE_KIND_LABELS: Record<ScopeKind, string> = {
  macro: 'Macrociclo',
  meso: 'Mesociclo',
  week: 'Semana',
  day: 'Día',
}

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

/** Picks the most recent item whose startDate is today-or-earlier, falling back to the first item. */
function defaultCurrentOrPastId(
  items: { id: string; startDate: string }[],
  nowIso: string,
): string {
  const currentOrPast = items.filter((i) => i.startDate <= nowIso)
  return currentOrPast[currentOrPast.length - 1]?.id ?? items[0]?.id ?? ''
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
  const macrocycles = useLiveQuery(() => listMacrocycles(), [])
  const mesocycles = useLiveQuery(() => listMesocyclesWithContext(), [])
  const weeks = useLiveQuery(() => listWeeksWithContext(), [])

  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [scopeKind, setScopeKind] = useState<ScopeKind>('week')
  const [scopeMacroId, setScopeMacroId] = useState('')
  const [scopeMesoId, setScopeMesoId] = useState('')
  const [scopeWeekId, setScopeWeekId] = useState('')
  const [scopeDay, setScopeDay] = useState('')
  const [now] = useState(() => Date.now())

  if (
    !setsWithContext ||
    !exercises ||
    !muscleGroups ||
    !contributions ||
    !macrocycles ||
    !mesocycles ||
    !weeks
  ) {
    return null
  }

  const nowIso = new Date(now).toISOString()
  const todayKey = toDateKey(new Date(now))

  const activeMacroId = macrocycles.some((m) => m.id === scopeMacroId)
    ? scopeMacroId
    : defaultCurrentOrPastId(macrocycles, nowIso)
  const activeMesoId = mesocycles.some((m) => m.id === scopeMesoId)
    ? scopeMesoId
    : defaultCurrentOrPastId(mesocycles, nowIso)
  const currentOrPastWeeks = weeks.filter(
    (w) => w.dayDates.length > 0 && w.dayDates[0] <= nowIso,
  )
  const defaultWeekId =
    currentOrPastWeeks[currentOrPastWeeks.length - 1]?.id ?? weeks[0]?.id ?? ''
  const activeWeekId = weeks.some((w) => w.id === scopeWeekId) ? scopeWeekId : defaultWeekId
  const activeDay = scopeDay || todayKey

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

  const allExerciseIds = [...new Set(setsWithE1rm.map((s) => s.exerciseId))].sort((a, b) =>
    exerciseName(a).localeCompare(exerciseName(b)),
  )

  if (allExerciseIds.length === 0) {
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

  let activeRange: DateRange | null = null
  if (scopeKind === 'macro') {
    const macro = macrocycles.find((m) => m.id === activeMacroId)
    activeRange = macro ? inclusiveRange(macro.startDate, macro.endDate) : null
  } else if (scopeKind === 'meso') {
    const meso = mesocycles.find((m) => m.id === activeMesoId)
    activeRange = meso ? inclusiveRange(meso.startDate, meso.endDate) : null
  } else if (scopeKind === 'week') {
    const week = weeks.find((w) => w.id === activeWeekId)
    activeRange =
      week && week.dayDates.length > 0
        ? inclusiveRange(week.dayDates[0], week.dayDates[week.dayDates.length - 1])
        : null
  } else {
    activeRange = dayRange(activeDay)
  }

  const scopedSets = activeRange
    ? setsWithE1rm.filter((s) => isWithinRange(s.performedAt, activeRange as DateRange))
    : []

  const scopedExerciseIds = [...new Set(scopedSets.map((s) => s.exerciseId))].sort((a, b) =>
    exerciseName(a).localeCompare(exerciseName(b)),
  )

  const personalRecords = scopedExerciseIds.map((exerciseId) => {
    const sets = scopedSets.filter((s) => s.exerciseId === exerciseId)
    const maxWeight = Math.max(...sets.map((s) => s.weightKg ?? 0))
    const maxWeightSet = sets.find((s) => (s.weightKg ?? 0) === maxWeight)
    return {
      exerciseId,
      maxWeight,
      maxWeightReps: maxWeightSet?.reps ?? null,
      maxWeightRpe: maxWeightSet?.rpe ?? null,
      maxE1rm: Math.max(...sets.map((s) => s.e1rm)),
    }
  })

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
    ...muscleGroupVolume(scopedSets, contributionsByExercise).entries(),
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
      scopedSets,
      contributionsByExercise,
      calculateStressIndex,
    ).entries(),
  ].sort((a, b) => b[1] - a[1])

  const trendExerciseId = allExerciseIds.includes(selectedExerciseId)
    ? selectedExerciseId
    : allExerciseIds[0]
  const trendPoints = buildE1rmTrend(
    scopedSets
      .filter((s) => s.exerciseId === trendExerciseId)
      .map((s) => ({ date: s.performedAt, e1rm: s.e1rm })),
  )

  return (
    <div className="page">
      <h1>Progreso</h1>

      <section>
        <h2>Periodo</h2>
        <div className="sub-tabs">
          {(Object.keys(SCOPE_KIND_LABELS) as ScopeKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={scopeKind === kind ? 'active' : ''}
              onClick={() => setScopeKind(kind)}
            >
              {SCOPE_KIND_LABELS[kind]}
            </button>
          ))}
        </div>

        {scopeKind === 'macro' &&
          (macrocycles.length === 0 ? (
            <p className="empty-hint">Todavía no armaste un macrociclo en Periodización.</p>
          ) : (
            <select
              className="week-select"
              value={activeMacroId}
              onChange={(e) => setScopeMacroId(e.target.value)}
            >
              {macrocycles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({formatDate(m.startDate)} - {formatDate(m.endDate)})
                </option>
              ))}
            </select>
          ))}

        {scopeKind === 'meso' &&
          (mesocycles.length === 0 ? (
            <p className="empty-hint">Todavía no armaste un mesociclo en Periodización.</p>
          ) : (
            <select
              className="week-select"
              value={activeMesoId}
              onChange={(e) => setScopeMesoId(e.target.value)}
            >
              {mesocycles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.macrocycleName} / {m.name} ({formatDate(m.startDate)} - {formatDate(m.endDate)})
                </option>
              ))}
            </select>
          ))}

        {scopeKind === 'week' &&
          (weeks.length === 0 ? (
            <p className="empty-hint">Todavía no armaste una semana en Periodización.</p>
          ) : (
            <select
              className="week-select"
              value={activeWeekId}
              onChange={(e) => setScopeWeekId(e.target.value)}
            >
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {weekLabel(w)}
                </option>
              ))}
            </select>
          ))}

        {scopeKind === 'day' && (
          <input
            type="date"
            value={activeDay}
            onChange={(e) => setScopeDay(e.target.value)}
          />
        )}
      </section>

      <section>
        <h2>Récords personales</h2>
        {personalRecords.length === 0 ? (
          <p className="empty-hint">Sin series registradas en este periodo.</p>
        ) : (
          <ul className="pr-table">
            {personalRecords.map((pr) => (
              <li key={pr.exerciseId} className="pr-row">
                <span>{exerciseName(pr.exerciseId)}</span>
                <span className="numeric">
                  {pr.maxWeight} kg
                  {pr.maxWeightReps !== null && ` × ${pr.maxWeightReps}`}
                  {pr.maxWeightRpe !== null && ` · RPE ${pr.maxWeightRpe}`}
                </span>
                <span className="numeric">e1RM {Math.round(pr.maxE1rm)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Mapa corporal</h2>
        <BodyMap valuesByRegion={valuesByRegion} maxValue={maxRegionValue} />
      </section>

      <section>
        <h2>Series por grupo muscular</h2>
        {volumeByGroup.length === 0 ? (
          <p className="empty-hint">Sin series en este periodo.</p>
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
          <p className="empty-hint">Sin series con RPE cargado en este periodo.</p>
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
          {allExerciseIds.map((id) => (
            <option key={id} value={id}>
              {exerciseName(id)}
            </option>
          ))}
        </select>
        {trendPoints.length === 0 ? (
          <p className="empty-hint">Sin historial para este ejercicio en este periodo.</p>
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
