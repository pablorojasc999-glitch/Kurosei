import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { ExecutedSet, SessionExercise, StrengthSession } from '../domain/types'

/** Ya no pasa por Dexie: habla directo con Supabase. */
function client() {
  if (!supabase) throw new Error('La sesión necesita conexión para funcionar.')
  return supabase
}

/**
 * The active StrengthSession for a day, if one exists. If more than one row
 * somehow matches (a leftover duplicate from a race before `startSession`
 * became transactional), the most recently updated one wins — an unsorted
 * read would pick an arbitrary one instead.
 */
export async function getSessionForDay(
  dayId: string,
): Promise<StrengthSession | undefined> {
  const { data, error } = await client()
    .from('training_sessions')
    .select('*')
    .eq('dayId', dayId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  const sessions = data as StrengthSession[]
  if (sessions.length === 0) return undefined
  return sessions.reduce((latest, s) => (s.updatedAt > latest.updatedAt ? s : latest))
}

/**
 * Starts (or resumes) the session for a day.
 *
 * No hay transacción entre cliente y Supabase que evite que dos toques casi
 * simultáneos pasen juntos el "no existe todavía" y creen dos sesiones — el
 * mismo riesgo que ya se acepta en el resto de los repositorios migrados.
 */
export async function startSession(dayId: string): Promise<StrengthSession> {
  const existing = await getSessionForDay(dayId)
  if (existing) return existing
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
  const userId = await requireUserId()
  const { error } = await client().from('training_sessions').insert({ ...session, userId })
  if (error) throw new Error(error.message)
  return session
}

export async function endSession(sessionId: string): Promise<void> {
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_sessions')
    .update({ endedAt: timestamp, updatedAt: timestamp })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}

/**
 * Corrige a mano las horas de la sesión.
 *
 * `endedAt` puede quedar en null para volver a dejarla abierta, que es lo que
 * hace "Reabrir sesión"; por eso el campo se distingue de "no lo toques"
 * (ausente) y de "bórralo" (null).
 */
export async function updateSessionTimes(
  sessionId: string,
  times: { startedAt?: string; endedAt?: string | null },
): Promise<void> {
  const changes: Record<string, unknown> = { updatedAt: nowIso() }
  if (times.startedAt !== undefined) changes.startedAt = times.startedAt
  if (times.endedAt !== undefined) changes.endedAt = times.endedAt
  const { error } = await client().from('training_sessions').update(changes).eq('id', sessionId)
  if (error) throw new Error(error.message)
}

export async function reopenSession(sessionId: string): Promise<void> {
  const { error } = await client()
    .from('training_sessions')
    .update({ endedAt: null, updatedAt: nowIso() })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}

/** Deletes a session entirely, cascading to its exercises and their sets. */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessionExercises = await listSessionExercises(sessionId)
  for (const se of sessionExercises) {
    await deleteSessionExercise(se.id)
  }
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_sessions')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}

/** Todas las sesiones no borradas — para cruces con otras tablas (ver metricsQueries.ts). */
export async function listAllSessions(): Promise<StrengthSession[]> {
  const { data, error } = await client().from('training_sessions').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as StrengthSession[]
}

/** Todos los ejercicios de sesión no borrados — para cruces con otras tablas (ver metricsQueries.ts). */
export async function listAllSessionExercises(): Promise<SessionExercise[]> {
  const { data, error } = await client()
    .from('training_session_exercises')
    .select('*')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as SessionExercise[]
}

/** Todas las series ejecutadas no borradas — para cruces con otras tablas (ver metricsQueries.ts). */
export async function listAllExecutedSets(): Promise<ExecutedSet[]> {
  const { data, error } = await client().from('training_executed_sets').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as ExecutedSet[]
}

export async function listSessionExercises(
  sessionId: string,
): Promise<SessionExercise[]> {
  const { data, error } = await client()
    .from('training_session_exercises')
    .select('*')
    .eq('sessionId', sessionId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as SessionExercise[]).sort((a, b) => a.order - b.order)
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
  const userId = await requireUserId()
  const { error } = await client()
    .from('training_session_exercises')
    .insert({ ...sessionExercise, userId })
  if (error) throw new Error(error.message)
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
  const { data, error } = await client()
    .from('training_session_exercises')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const sessionExercise = data as SessionExercise | null
  if (!sessionExercise) return
  const siblings = await listSessionExercises(sessionExercise.sessionId)
  const index = siblings.findIndex((se) => se.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  const { error: error1 } = await client()
    .from('training_session_exercises')
    .update({ order: target.order, updatedAt: timestamp })
    .eq('id', sessionExercise.id)
  if (error1) throw new Error(error1.message)
  const { error: error2 } = await client()
    .from('training_session_exercises')
    .update({ order: sessionExercise.order, updatedAt: timestamp })
    .eq('id', target.id)
  if (error2) throw new Error(error2.message)
}

/** Closes or reopens a session exercise, locking/unlocking its set-log form. */
export async function setSessionExerciseClosed(
  id: string,
  closed: boolean,
): Promise<void> {
  const { error } = await client()
    .from('training_session_exercises')
    .update({ closedAt: closed ? nowIso() : null, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSessionExercise(id: string): Promise<void> {
  const timestamp = nowIso()
  const sets = await listExecutedSets(id)
  const { error } = await client()
    .from('training_session_exercises')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
  for (const s of sets) {
    const { error: setError } = await client()
      .from('training_executed_sets')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', s.id)
    if (setError) throw new Error(setError.message)
  }
}

export async function listExecutedSets(
  sessionExerciseId: string,
): Promise<ExecutedSet[]> {
  const { data, error } = await client()
    .from('training_executed_sets')
    .select('*')
    .eq('sessionExerciseId', sessionExerciseId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as ExecutedSet[]).sort((a, b) => a.setNumber - b.setNumber)
}

/** Total executed sets across every exercise in a session, for calorie estimation. */
export async function countExecutedSetsForSession(sessionId: string): Promise<number> {
  const sessionExercises = await listSessionExercises(sessionId)
  if (sessionExercises.length === 0) return 0
  const { data, error } = await client()
    .from('training_executed_sets')
    .select('id')
    .in('sessionExerciseId', sessionExercises.map((se) => se.id))
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Array<{ id: string }>).length
}

export interface CreateExecutedSetInput {
  sessionExerciseId: string
  weightKg: number | null
  reps: number
  rpe: number | null
  eva: number | null
  notes: string
  dropSet: boolean
  restPause: boolean
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
  const userId = await requireUserId()
  const { error } = await client().from('training_executed_sets').insert({ ...executedSet, userId })
  if (error) throw new Error(error.message)
  return executedSet
}

export interface UpdateExecutedSetInput {
  weightKg: number | null
  reps: number
  rpe: number | null
  eva: number | null
  notes: string
  dropSet: boolean
  restPause: boolean
}

export async function updateExecutedSet(
  id: string,
  input: UpdateExecutedSetInput,
): Promise<void> {
  const { error } = await client()
    .from('training_executed_sets')
    .update({ ...input, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteExecutedSet(id: string): Promise<void> {
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_executed_sets')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * All-time history for an exercise at a specific rep count, across every
 * session — e.g. "show me every set of bench press I've done for 3 reps".
 */
export async function listExecutedSetsForExerciseByReps(
  exerciseId: string,
  reps: number,
): Promise<ExecutedSet[]> {
  const { data, error } = await client()
    .from('training_session_exercises')
    .select('id')
    .eq('exerciseId', exerciseId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  const sessionExerciseIds = (data as Array<{ id: string }>).map((se) => se.id)
  if (sessionExerciseIds.length === 0) return []

  const { data: setsData, error: setsError } = await client()
    .from('training_executed_sets')
    .select('*')
    .in('sessionExerciseId', sessionExerciseIds)
    .eq('reps', reps)
    .is('deletedAt', null)
  if (setsError) throw new Error(setsError.message)

  return (setsData as ExecutedSet[]).sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime(),
  )
}
