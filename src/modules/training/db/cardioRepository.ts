import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { CardioSession } from '../domain/types'

/** Ya no pasa por Dexie: habla directo con Supabase. */
function client() {
  if (!supabase) throw new Error('El cardio necesita conexión para funcionar.')
  return supabase
}

export async function listCardioSessions(dayId: string): Promise<CardioSession[]> {
  const { data, error } = await client()
    .from('training_cardio_sessions')
    .select('*')
    .eq('dayId', dayId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as CardioSession[]).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
}

/** Todas las sesiones de cardio no borradas — para cruces con otras tablas (ver bitacoraQueries.ts). */
export async function listAllCardioSessions(): Promise<CardioSession[]> {
  const { data, error } = await client().from('training_cardio_sessions').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as CardioSession[]
}

export interface CreateCardioSessionInput {
  dayId: string
  exerciseId: string
  startedAt: string
  durationMinutes: number
  distanceKm: number | null
  caloriesBurned: number | null
  notes: string
}

export async function createCardioSession(
  input: CreateCardioSessionInput,
): Promise<CardioSession> {
  const timestamp = nowIso()
  const session: CardioSession = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('training_cardio_sessions').insert({ ...session, userId })
  if (error) throw new Error(error.message)
  return session
}

export async function deleteCardioSession(id: string): Promise<void> {
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_cardio_sessions')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
