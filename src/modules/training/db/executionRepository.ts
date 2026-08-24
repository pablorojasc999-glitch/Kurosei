import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { ExecutedSet, SessionExercise, StrengthSession } from '../domain/types'

/**
 * The active StrengthSession for a day, if one exists. If more than one row
 * somehow matches (a leftover duplicate from a race before `startSession`
 * became transactional), the most recently updated one wins — an unsorted
 * `.first()` would pick an arbitrary one by primary key instead.
 */
export async function getSessionForDay(
  dayId: string,
): Promise<StrengthSession | undefined> {
  const sessions = await db.training_sessions
    .where('dayId')
    .equals(dayId)
    .filter((s) => s.deletedAt === null)
    .toArray()
  if (sessions.length === 0) return undefined
  return sessions.reduce((latest, s) => (s.updatedAt > latest.updatedAt ? s : latest))
}

/**
 * Starts (or resumes) the session for a day. Runs as one transaction so two
 * near-simultaneous calls (e.g. a fast double-tap on "Iniciar sesión")
 * can't both pass the "doesn't exist yet" check and create two sessions.
 */
export async function startSession(dayId: string): Promise<StrengthSession> {
  return db.transaction('rw', db.training_sessions, async () => {
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
  })
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
  const timestamp = nowIso()
  await db.training_sessions.update(sessionId, {
    deletedAt: timestamp,
    updatedAt: timestamp,
  })
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
    closedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_session_exercises.add(sessionExercise)
  return sessionExercise
}

/**
 * Swaps a session exercise's position with its previous ('up') or next
 * ('down') sibling within the same session. A no-op at either end of the
 * list.
 */
export async function reorderSessionExercise(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const sessionExercise = await db.training_session_exercises.get(id)
  if (!sessionExercise) return
  const siblings = await listSessionExercises(sessionExercise.sessionId)
  const index = siblings.findIndex((se) => se.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  await db.transaction('rw', db.training_session_exercises, async () => {
    await db.training_session_exercises.update(sessionExercise.id, {
      order: target.order,
      updatedAt: timestamp,
    })
    await db.training_session_exercises.update(target.id, {
      order: sessionExercise.order,
      updatedAt: timestamp,
    })
  })
}

/** Closes or reopens a session exercise, locking/unlocking its set-log form. */
export async function setSessionExerciseClosed(
  id: string,
  closed: boolean,
): Promise<void> {
  await db.training_session_exercises.update(id, {
    closedAt: closed ? nowIso() : null,
    updatedAt: nowIso(),
  })
}

export async function deleteSessionExercise(id: string): Promise<void> {
  const timestamp = nowIso()
  const sets = await listExecutedSets(id)
  await db.transaction(
    'rw',
    db.training_session_exercises,
    db.training_executed_sets,
    async () => {
      await db.training_session_exercises.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
      })
      await Promise.all(
        sets.map((s) =>
          db.training_executed_sets.update(s.id, {
            deletedAt: timestamp,
            updatedAt: timestamp,
          }),
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

/** Total executed sets across every exercise in a session, for calorie estimation. */
export async function countExecutedSetsForSession(sessionId: string): Promise<number> {
  const sessionExercises = await listSessionExercises(sessionId)
  if (sessionExercises.length === 0) return 0
  return db.training_executed_sets
    .where('sessionExerciseId')
    .anyOf(sessionExercises.map((se) => se.id))
    .filter((s) => s.deletedAt === null)
    .count()
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

export interface UpdateExecutedSetInput {
  weightKg: number | null
  reps: number
  rpe: number | null
  eva: number | null
  notes: string
}

export async function updateExecutedSet(
  id: string,
  input: UpdateExecutedSetInput,
): Promise<void> {
  await db.training_executed_sets.update(id, {
    ...input,
    updatedAt: nowIso(),
  })
}

export async function deleteExecutedSet(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.training_executed_sets.update(id, {
    deletedAt: timestamp,
    updatedAt: timestamp,
  })
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
