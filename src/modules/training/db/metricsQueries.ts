import {
  getDayById,
  listAllDays,
  listPlannedExercisesForExercise,
  listPlannedSets,
} from './planningRepository'
import {
  getSessionForDay,
  listAllExecutedSets,
  listAllSessionExercises,
  listAllSessions,
  listExecutedSets,
  listSessionExercises,
} from './executionRepository'
import { averageRpeDeviation, type RpePair } from '../lib/metrics'
import type { ExecutedSet } from '../domain/types'

export interface ExecutedSetWithContext extends ExecutedSet {
  exerciseId: string
  sessionId: string
  weekId: string | null
}

/**
 * Every executed set across all sessions, joined up to its exerciseId,
 * sessionId, and the weekId of the planning week its session's day belongs
 * to (null for a session on an ad-hoc/unplanned day).
 */
export async function listAllExecutedSetsWithContext(): Promise<
  ExecutedSetWithContext[]
> {
  const [sets, sessionExercises, sessions, days] = await Promise.all([
    listAllExecutedSets(),
    listAllSessionExercises(),
    listAllSessions(),
    listAllDays(),
  ])
  const sessionExerciseById = new Map(sessionExercises.map((se) => [se.id, se]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const weekIdByDayId = new Map(days.map((d) => [d.id, d.weekId]))

  return sets.flatMap((s) => {
    const se = sessionExerciseById.get(s.sessionExerciseId)
    if (!se) return []
    const session = sessionById.get(se.sessionId)
    const weekId = session ? (weekIdByDayId.get(session.dayId) ?? null) : null
    return [{ ...s, exerciseId: se.exerciseId, sessionId: se.sessionId, weekId }]
  })
}

/**
 * Per-day average RPE deviation (actual - planned) for one exercise, most
 * recent day first — the input to a deload/fatigue alert. Matches planned
 * vs. executed sets by (day, exercise, set number); days without both a
 * plan and a logged session for the exercise are skipped.
 */
export async function getRecentRpeDeviations(
  exerciseId: string,
  limit: number,
): Promise<number[]> {
  const plannedExercises = await listPlannedExercisesForExercise(exerciseId)

  const days = await Promise.all(plannedExercises.map((pe) => getDayById(pe.dayId)))
  const dayById = new Map(
    days.filter((d) => d && d.deletedAt === null).map((d) => [d!.id, d!]),
  )

  const plannedExercisesByRecentDay = plannedExercises
    .filter((pe) => dayById.has(pe.dayId))
    .sort(
      (a, b) =>
        new Date(dayById.get(b.dayId)!.date).getTime() -
        new Date(dayById.get(a.dayId)!.date).getTime(),
    )

  const deviations: number[] = []

  for (const plannedExercise of plannedExercisesByRecentDay) {
    if (deviations.length >= limit) break

    const plannedSets = (await listPlannedSets(plannedExercise.id)).filter(
      (ps) => ps.targetRpe !== null,
    )
    if (plannedSets.length === 0) continue

    const session = await getSessionForDay(plannedExercise.dayId)
    if (!session) continue

    const sessionExercise = (await listSessionExercises(session.id)).find(
      (se) => se.exerciseId === exerciseId,
    )
    if (!sessionExercise) continue

    const executedSets = (await listExecutedSets(sessionExercise.id)).filter(
      (s) => s.rpe !== null,
    )
    if (executedSets.length === 0) continue

    const executedBySetNumber = new Map(
      executedSets.map((s) => [s.setNumber, s.rpe as number]),
    )

    const pairs: RpePair[] = []
    for (const plannedSet of plannedSets) {
      const actualRpe = executedBySetNumber.get(plannedSet.setNumber)
      if (actualRpe !== undefined) {
        pairs.push({ plannedRpe: plannedSet.targetRpe as number, actualRpe })
      }
    }
    if (pairs.length === 0) continue

    deviations.push(averageRpeDeviation(pairs))
  }

  return deviations
}
