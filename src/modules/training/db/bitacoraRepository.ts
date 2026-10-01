import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { DailyLog, Sex, UserProfile } from '../domain/types'

/**
 * Ya no pasa por Dexie: habla directo con Supabase, como cualquier pantalla
 * de una app en línea — se pide, se escribe, se vuelve a pedir. Sin conexión
 * no hay perfil ni bitácora que mostrar.
 */
function client() {
  if (!supabase) throw new Error('La bitácora necesita conexión para funcionar.')
  return supabase
}

/**
 * The single profile row, if the user has ever saved one. If more than one
 * exists (e.g. two tabs racing to create it before the multi-tab guard
 * existed), the most recently updated one wins.
 */
export async function getProfile(): Promise<UserProfile | null> {
  const { data, error } = await client()
    .from('training_user_profile')
    .select('*')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  const profiles = data as UserProfile[]
  if (profiles.length === 0) return null
  return profiles.reduce((latest, p) => (p.updatedAt > latest.updatedAt ? p : latest))
}

export interface UpsertProfileInput {
  heightCm: number | null
  birthDate: string | null
  sex: Sex | null
  bodyFatPercent: number | null
  muscleMassPercent: number | null
}

/**
 * Creates the profile row on first save, updates it in place afterwards.
 * Also soft-deletes any other duplicate rows so future reads stay
 * unambiguous (see `getProfile`).
 */
export async function upsertProfile(input: UpsertProfileInput): Promise<UserProfile> {
  const existing = await getProfile()
  const timestamp = nowIso()
  if (existing) {
    const { error } = await client()
      .from('training_user_profile')
      .update({ ...input, updatedAt: timestamp })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    await deleteDuplicateProfiles(existing.id, timestamp)
    return { ...existing, ...input, updatedAt: timestamp }
  }
  const profile: UserProfile = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('training_user_profile').insert({ ...profile, userId })
  if (error) throw new Error(error.message)
  return profile
}

/** Soft-deletes every profile row except `keepId` (see `upsertProfile`). */
async function deleteDuplicateProfiles(keepId: string, timestamp: string): Promise<void> {
  const { data, error } = await client()
    .from('training_user_profile')
    .select('id')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  const others = (data as Array<{ id: string }>).filter((p) => p.id !== keepId)
  for (const { id } of others) {
    const { error: updateError } = await client()
      .from('training_user_profile')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', id)
    if (updateError) throw new Error(updateError.message)
  }
}

/**
 * The bitácora entry for a calendar day (`date` as a `YYYY-MM-DD` key), if
 * one was ever saved. If more than one row exists for that date, the most
 * recently updated one wins — see `getProfile` for why an unsorted read
 * isn't safe here.
 */
export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const { data, error } = await client()
    .from('training_daily_logs')
    .select('*')
    .eq('date', date)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  const logs = data as DailyLog[]
  if (logs.length === 0) return null
  return logs.reduce((latest, l) => (l.updatedAt > latest.updatedAt ? l : latest))
}

/**
 * Todas las bitácoras sin borrar, sin filtrar por fecha — para el cruce con
 * las demás tablas de Entrenamiento (todavía en Dexie), ver
 * `bitacoraQueries.ts`.
 */
export async function listDailyLogs(): Promise<DailyLog[]> {
  const { data, error } = await client().from('training_daily_logs').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as DailyLog[]
}

/** Las bitácoras de un rango de fechas (claves `YYYY-MM-DD`), ambas incluidas. */
export async function listDailyLogsInRange(from: string, to: string): Promise<DailyLog[]> {
  const { data, error } = await client()
    .from('training_daily_logs')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as DailyLog[]
}

/** Soft-deletes every bitácora row for `date` except `keepId` (see `upsertDailyLog`). */
async function deleteDuplicateDailyLogs(date: string, keepId: string, timestamp: string): Promise<void> {
  const { data, error } = await client()
    .from('training_daily_logs')
    .select('id')
    .eq('date', date)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  const others = (data as Array<{ id: string }>).filter((l) => l.id !== keepId)
  for (const { id } of others) {
    const { error: updateError } = await client()
      .from('training_daily_logs')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', id)
    if (updateError) throw new Error(updateError.message)
  }
}

export interface UpsertDailyLogInput {
  bodyWeightKg: number | null
  calories: number | null
  carbsG: number | null
  proteinG: number | null
  fatG: number | null
  sleepHours: number | null
  creatineTaken: boolean
  omega3Taken: boolean
  vitaminDTaken: boolean
  waterLiters: number | null
  stress: number | null
  stimulants: number | null
  fatigue: number | null
  steps: number | null
}

/**
 * Creates the day's bitácora entry on first save, updates it in place
 * afterwards. Also soft-deletes any other duplicate rows for that date so
 * future reads stay unambiguous (see `getDailyLog`).
 */
export async function upsertDailyLog(
  date: string,
  input: UpsertDailyLogInput,
): Promise<DailyLog> {
  const existing = await getDailyLog(date)
  const timestamp = nowIso()
  if (existing) {
    const { error } = await client()
      .from('training_daily_logs')
      .update({ ...input, updatedAt: timestamp })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    await deleteDuplicateDailyLogs(date, existing.id, timestamp)
    return { ...existing, ...input, updatedAt: timestamp }
  }
  const log: DailyLog = {
    id: generateId(),
    date,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('training_daily_logs').insert({ ...log, userId })
  if (error) throw new Error(error.message)
  return log
}
