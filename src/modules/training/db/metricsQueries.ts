import { db } from '../../../shared/db/database'
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
    db.training_executed_sets.filter((s) => s.deletedAt === null).toArray(),
    db.training_session_exercises.filter((se) => se.deletedAt === null).toArray(),
    db.training_sessions.filter((s) => s.deletedAt === null).toArray(),
    db.training_days.filter((d) => d.deletedAt === null).toArray(),
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
  const plannedExercises = await db.training_planned_exercises
    .where('exerciseId')
    .equals(exerciseId)
    .filter((pe) => pe.deletedAt === null)
    .toArray()

  const days = await Promise.all(
    plannedExercises.map((pe) => db.training_days.get(pe.dayId)),
  )
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

    const plannedSets = await db.training_planned_sets
      .where('plannedExerciseId')
      .equals(plannedExercise.id)
      .filter((ps) => ps.deletedAt === null && ps.targetRpe !== null)
      .toArray()
    if (plannedSets.length === 0) continue

    const session = await db.training_sessions
      .where('dayId')
      .equals(plannedExercise.dayId)
      .filter((s) => s.deletedAt === null)
      .first()
    if (!session) continue

    const sessionExercise = await db.training_session_exercises
      .where('sessionId')
      .equals(session.id)
      .filter((se) => se.deletedAt === null && se.exerciseId === exerciseId)
      .first()
    if (!sessionExercise) continue

    const executedSets = await db.training_executed_sets
      .where('sessionExerciseId')
      .equals(sessionExercise.id)
      .filter((s) => s.deletedAt === null && s.rpe !== null)
      .toArray()
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
