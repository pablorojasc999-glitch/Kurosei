import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { ExecutedSet, SessionExercise, StrengthSession } from '../domain/types'

export async function getSessionForDay(
  dayId: string,
): Promise<StrengthSession | undefined> {
  return db.training_sessions
    .where('dayId')
    .equals(dayId)
    .filter((s) => s.deletedAt === null)
    .first()
}

export async function startSession(dayId: string): Promise<StrengthSession> {
  const existing = await getSessionForDay(dayId)
  if (existing) {
    return existing
  }
  const timestamp = nowIso()
  const session: StrengthSession = {
    id: generateId(),
    dayId,
    startedAt: timestamp,
    endedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_sessions.add(session)
  return session
}

export async function endSession(sessionId: string): Promise<void> {
  const timestamp = nowIso()
  await db.training_sessions.update(sessionId, {
    endedAt: timestamp,
    updatedAt: timestamp,
  })
}

export async function reopenSession(sessionId: string): Promise<void> {
  await db.training_sessions.update(sessionId, {
    endedAt: null,
    updatedAt: nowIso(),
  })
}

/** Deletes a session entirely, cascading to its exercises and their sets. */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessionExercises = await listSessionExercises(sessionId)
  for (const se of sessionExercises) {
    await deleteSessionExercise(se.id)
  }
  await db.training_sessions.update(sessionId, { deletedAt: nowIso() })
}

export async function listSessionExercises(
  sessionId: string,
): Promise<SessionExercise[]> {
  return db.training_session_exercises
    .where('sessionId')
    .equals(sessionId)
    .filter((se) => se.deletedAt === null)
    .sortBy('order')
}

export interface AddSessionExerciseInput {
  sessionId: string
  exerciseId: string
  notes: string
}

export async function addSessionExercise(
  input: AddSessionExerciseInput,
): Promise<SessionExercise> {
  const siblings = await listSessionExercises(input.sessionId)
  const nextOrder = siblings.length
    ? Math.max(...siblings.map((se) => se.order)) + 1
    : 0
  const timestamp = nowIso()
  const sessionExercise: SessionExercise = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_session_exercises.add(sessionExercise)
  return sessionExercise
}

export async function deleteSessionExercise(id: string): Promise<void> {
  const timestamp = nowIso()
  const sets = await listExecutedSets(id)
  await db.transaction(
    'rw',
    db.training_session_exercises,
    db.training_executed_sets,
    async () => {
      await db.training_session_exercises.update(id, { deletedAt: timestamp })
      await Promise.all(
        sets.map((s) =>
          db.training_executed_sets.update(s.id, { deletedAt: timestamp }),
        ),
      )
    },
  )
}

export async function listExecutedSets(
  sessionExerciseId: string,
): Promise<ExecutedSet[]> {
  return db.training_executed_sets
    .where('sessionExerciseId')
    .equals(sessionExerciseId)
    .filter((s) => s.deletedAt === null)
    .sortBy('setNumber')
}

export interface CreateExecutedSetInput {
  sessionExerciseId: string
  weightKg: number | null
  reps: number
  rpe: number | null
  eva: number | null
  notes: string
}

export async function createExecutedSet(
  input: CreateExecutedSetInput,
): Promise<ExecutedSet> {
  const siblings = await listExecutedSets(input.sessionExerciseId)
  const nextSetNumber = siblings.length
    ? Math.max(...siblings.map((s) => s.setNumber)) + 1
    : 1
  const timestamp = nowIso()
  const previousSet = siblings.at(-1)
  const restTakenSeconds = previousSet
    ? Math.round(
        (new Date(timestamp).getTime() -
          new Date(previousSet.performedAt).getTime()) /
          1000,
      )
    : null

  const executedSet: ExecutedSet = {
    id: generateId(),
    ...input,
    setNumber: nextSetNumber,
    performedAt: timestamp,
    restTakenSeconds,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_executed_sets.add(executedSet)
  return executedSet
}

export async function deleteExecutedSet(id: string): Promise<void> {
  await db.training_executed_sets.update(id, { deletedAt: nowIso() })
}

/**
 * All-time history for an exercise at a specific rep count, across every
 * session — e.g. "show me every set of bench press I've done for 3 reps".
 */
export async function listExecutedSetsForExerciseByReps(
  exerciseId: string,
  reps: number,
): Promise<ExecutedSet[]> {
  const sessionExerciseIds = await db.training_session_exercises
    .where('exerciseId')
    .equals(exerciseId)
    .filter((se) => se.deletedAt === null)
    .primaryKeys()

  if (sessionExerciseIds.length === 0) return []

  const sets = await db.training_executed_sets
    .where('sessionExerciseId')
    .anyOf(sessionExerciseIds)
    .filter((s) => s.deletedAt === null && s.reps === reps)
    .toArray()

  return sets.sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
  )
}
