import { db } from '../../../shared/db/database'
import { toDateKey } from '../lib/calendarGrid'
import type { DateRange } from '../lib/progressScope'

export interface DailyMetric {
  date: string
  /** True if a bitácora entry exists for this date at all (regardless of which fields were filled). */
  hasLog: boolean
  bodyWeightKg: number | null
  calories: number | null
  carbsG: number | null
  proteinG: number | null
  fatG: number | null
  sleepHours: number | null
  waterLiters: number | null
  steps: number | null
  stress: number | null
  stimulants: number | null
  fatigue: number | null
  creatineTaken: boolean
  omega3Taken: boolean
  vitaminDTaken: boolean
  /** Sum of that day's CardioSession.caloriesBurned. */
  cardioCaloriesBurned: number
  /** Sum of that day's CardioSession.distanceKm. */
  cardioDistanceKm: number
  /** `performedAt` of every executed set logged that day, for calorie estimation. */
  strengthSetTimestamps: string[]
  /** True if a strength session was started that day (finished or not). */
  hadStrengthSession: boolean
}

/**
 * One row per calendar day in `range`, combining that day's bitácora entry
 * (if any) with the calorie/duration inputs `calorieExpenditure.ts` needs —
 * drives Progreso's charts relating training to the bitácora.
 */
export async function listDailyMetricsInRange(range: DateRange): Promise<DailyMetric[]> {
  const [days, dailyLogs] = await Promise.all([
    db.training_days.filter((d) => d.deletedAt === null).toArray(),
    db.training_daily_logs.filter((l) => l.deletedAt === null).toArray(),
  ])

  const domainDates: string[] = []
  for (
    let cursor = new Date(range.start);
    cursor.toISOString() < range.end;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    domainDates.push(toDateKey(cursor))
  }
  const domainDateSet = new Set(domainDates)

  const dayIdToDateKey = new Map<string, string>()
  for (const d of days) {
    const dateKey = toDateKey(new Date(d.date))
    if (domainDateSet.has(dateKey)) {
      dayIdToDateKey.set(d.id, dateKey)
    }
  }
  const relevantDayIds = new Set(dayIdToDateKey.keys())

  const [sessions, cardioSessions] = await Promise.all([
    db.training_sessions
      .filter((s) => s.deletedAt === null && relevantDayIds.has(s.dayId))
      .toArray(),
    db.training_cardio_sessions
      .filter((c) => c.deletedAt === null && relevantDayIds.has(c.dayId))
      .toArray(),
  ])

  const cardioCaloriesByDate = new Map<string, number>()
  const cardioDistanceByDate = new Map<string, number>()
  for (const c of cardioSessions) {
    const dateKey = dayIdToDateKey.get(c.dayId)
    if (!dateKey) continue
    cardioCaloriesByDate.set(dateKey, (cardioCaloriesByDate.get(dateKey) ?? 0) + (c.caloriesBurned ?? 0))
    cardioDistanceByDate.set(dateKey, (cardioDistanceByDate.get(dateKey) ?? 0) + (c.distanceKm ?? 0))
  }

  const sessionIdToDateKey = new Map<string, string>()
  const hadStrengthSessionDates = new Set<string>()
  for (const s of sessions) {
    const dateKey = dayIdToDateKey.get(s.dayId)
    if (!dateKey) continue
    hadStrengthSessionDates.add(dateKey)
    sessionIdToDateKey.set(s.id, dateKey)
  }
  const relevantSessionIds = new Set(sessionIdToDateKey.keys())

  const sessionExercises = await db.training_session_exercises
    .filter((se) => se.deletedAt === null && relevantSessionIds.has(se.sessionId))
    .toArray()
  const sessionExerciseIdToDateKey = new Map<string, string>()
  for (const se of sessionExercises) {
    const dateKey = sessionIdToDateKey.get(se.sessionId)
    if (dateKey) sessionExerciseIdToDateKey.set(se.id, dateKey)
  }
  const relevantSessionExerciseIds = new Set(sessionExerciseIdToDateKey.keys())

  const executedSets = await db.training_executed_sets
    .filter((s) => s.deletedAt === null && relevantSessionExerciseIds.has(s.sessionExerciseId))
    .toArray()
  const strengthSetTimestampsByDate = new Map<string, string[]>()
  for (const set of executedSets) {
    const dateKey = sessionExerciseIdToDateKey.get(set.sessionExerciseId)
    if (!dateKey) continue
    const existing = strengthSetTimestampsByDate.get(dateKey) ?? []
    existing.push(set.performedAt)
    strengthSetTimestampsByDate.set(dateKey, existing)
  }

  // If a date somehow has more than one row (e.g. leftover duplicates from
  // before upsertDailyLog started deduplicating), sort oldest-first so the
  // most recently updated one is the last write into the map and wins.
  const dailyLogByDate = new Map(
    dailyLogs
      .filter((l) => domainDateSet.has(l.date))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((l) => [l.date, l]),
  )

  return domainDates.map((date) => {
    const log = dailyLogByDate.get(date) ?? null
    return {
      date,
      hasLog: log !== null,
      bodyWeightKg: log?.bodyWeightKg ?? null,
      calories: log?.calories ?? null,
      carbsG: log?.carbsG ?? null,
      proteinG: log?.proteinG ?? null,
      fatG: log?.fatG ?? null,
      sleepHours: log?.sleepHours ?? null,
      waterLiters: log?.waterLiters ?? null,
      steps: log?.steps ?? null,
      stress: log?.stress ?? null,
      stimulants: log?.stimulants ?? null,
      fatigue: log?.fatigue ?? null,
      creatineTaken: log?.creatineTaken ?? false,
      omega3Taken: log?.omega3Taken ?? false,
      vitaminDTaken: log?.vitaminDTaken ?? false,
      cardioCaloriesBurned: cardioCaloriesByDate.get(date) ?? 0,
      cardioDistanceKm: cardioDistanceByDate.get(date) ?? 0,
      strengthSetTimestamps: strengthSetTimestampsByDate.get(date) ?? [],
      hadStrengthSession: hadStrengthSessionDates.has(date),
    }
  })
}
