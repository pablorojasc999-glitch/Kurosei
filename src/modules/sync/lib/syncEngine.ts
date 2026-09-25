import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntityTable } from 'dexie'
import { db } from '../../../shared/db/database'
import { supabase } from '../../../shared/supabase/client'
import type { SyncedEntity } from '../../training/domain/types'

/** Every Dexie store that mirrors to Supabase, in a stable sync order. */
export const SYNC_TABLE_NAMES = [
  'training_muscle_groups',
  'training_exercises',
  'training_exercise_muscle_contributions',
  'training_macrocycles',
  'training_mesocycles',
  'training_weeks',
  'training_days',
  'training_planned_exercises',
  'training_planned_sets',
  'training_sessions',
  'training_session_exercises',
  'training_executed_sets',
  'training_cardio_sessions',
  'training_user_profile',
  'training_daily_logs',
  'finance_accounts',
  'finance_categories',
  'finance_category_budgets',
  'finance_transactions',
  'nutrition_foods',
  'nutrition_meal_sections',
  'nutrition_entries',
  'nutrition_water_entries',
  'nutrition_meal_templates',
  'nutrition_meal_template_entries',
  'nutrition_goal_plans',
  'grocery_items',
] as const

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number]

const LAST_SYNCED_KEY = 'kurosei_last_synced_at'
/**
 * Hasta dónde se ha bajado, medido con el reloj del servidor.
 *
 * Va aparte del corte de subida porque son dos relojes distintos: lo que se
 * sube se compara contra las fechas que escribió este dispositivo, y lo que se
 * baja contra las que puso el servidor al recibir cada fila.
 */
const LAST_PULLED_KEY = 'kurosei_last_pulled_at'
const EPOCH = '1970-01-01T00:00:00.000Z'

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(LAST_SYNCED_KEY)
}

function setLastSyncedAt(value: string): void {
  localStorage.setItem(LAST_SYNCED_KEY, value)
}

export function getLastPulledAt(): string | null {
  return localStorage.getItem(LAST_PULLED_KEY)
}

function setLastPulledAt(value: string): void {
  localStorage.setItem(LAST_PULLED_KEY, value)
}

/**
 * Compara dos fechas por el instante que representan, no por el texto.
 *
 * Postgres devuelve `2026-09-25T13:55:47.26+00:00` y `toISOString()` produce
 * `2026-09-25T13:55:47.260Z`: el mismo instante escrito de dos formas, que
 * comparadas como texto no dan lo que uno espera.
 */
function isAfter(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b)
}

function localTable(tableName: SyncTableName): EntityTable<SyncedEntity, 'id'> {
  return db.table(tableName)
}

/** Upserts every local row changed since `since` to Supabase. */
export async function pushTable(
  client: SupabaseClient,
  tableName: SyncTableName,
  userId: string,
  since: string,
): Promise<void> {
  const changed = await localTable(tableName)
    .filter((row) => isAfter(row.updatedAt, since))
    .toArray()
  if (changed.length === 0) return

  const rows = changed.map((row) => ({ ...row, userId }))
  const { error } = await client.from(tableName).upsert(rows)
  if (error) throw new Error(`${tableName}: ${error.message}`)
}

/**
 * Baja las filas que el servidor recibió después de `since` y las mezcla en
 * Dexie, gana la más nueva por `updatedAt` — una fila remota sólo pisa a la
 * local si es estrictamente más nueva, o si la local no existe.
 *
 * El filtro va por `syncedAt`, que pone el servidor al recibir cada fila, y no
 * por `updatedAt`, que lo pone el dispositivo que la escribió. Son dos cosas
 * distintas: una fila anotada en el teléfono a las 13:42 y subida a las 14:10
 * aparece en el servidor recién a las 14:10, y cualquier otro dispositivo que
 * haya sincronizado entremedio ya tendría su corte pasadas las 13:42. Con el
 * filtro por `updatedAt` esa fila no se bajaba nunca más, y la sincronización
 * terminaba sin error porque la consulta no devolvía nada.
 *
 * Devuelve el `syncedAt` más alto que vio, que es hasta dónde se bajó de
 * verdad.
 */
export async function pullTable(
  client: SupabaseClient,
  tableName: SyncTableName,
  userId: string,
  since: string,
): Promise<string | null> {
  const { data, error } = await client
    .from(tableName)
    .select('*')
    .eq('userId', userId)
    .gt('syncedAt', since)
  if (error) throw new Error(`${tableName}: ${error.message}`)
  if (!data || data.length === 0) return null

  const table = localTable(tableName)
  let highest: string | null = null
  for (const remoteRow of data as Array<
    SyncedEntity & { userId: string; syncedAt?: string }
  >) {
    const { userId: _userId, syncedAt, ...localRow } = remoteRow
    // `syncedAt` es del servidor: no se guarda ni se devuelve al subir, o se
    // estaría mandando de vuelta una marca que sólo el servidor puede poner.
    if (syncedAt !== undefined && (highest === null || isAfter(syncedAt, highest))) {
      highest = syncedAt
    }
    const existing = await table.get(localRow.id)
    if (!existing || isAfter(localRow.updatedAt, existing.updatedAt)) {
      await table.put(localRow as SyncedEntity)
    }
  }
  return highest
}

export type SyncStatus =
  | { kind: 'idle'; lastSyncedAt: string | null }
  | { kind: 'syncing' }
  | { kind: 'error'; message: string; lastSyncedAt: string | null }

let currentStatus: SyncStatus = { kind: 'idle', lastSyncedAt: getLastSyncedAt() }
const listeners = new Set<(status: SyncStatus) => void>()

function setStatus(status: SyncStatus): void {
  currentStatus = status
  for (const listener of listeners) listener(status)
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

/** Subscribes to sync status changes; returns an unsubscribe function. */
export function subscribeSyncStatus(
  listener: (status: SyncStatus) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Corre un ciclo completo para `userId`: sube lo que cambió acá desde la
 * última vez y baja lo que el servidor recibió desde la última vez, mezclando
 * con gana-la-más-nueva por `updatedAt`.
 *
 * Son dos cortes y no uno porque cada uno vive en un reloj distinto: el de
 * subida compara fechas de este dispositivo contra un momento de este
 * dispositivo, y el de bajada compara fechas del servidor contra un momento
 * del servidor. Mezclarlos era el motivo de que un teléfono y un computador
 * dijeran los dos "sincronizado" con datos distintos.
 *
 * Ninguno de los dos avanza hasta que todas las tablas pasaron sin error, así
 * que un fallo reintenta desde donde quedó.
 */
export async function syncNow(userId: string): Promise<void> {
  if (!supabase) {
    throw new Error('La sincronización no está configurada.')
  }
  const pushedSince = getLastSyncedAt() ?? EPOCH
  const pulledSince = getLastPulledAt() ?? EPOCH
  const syncStartedAt = new Date().toISOString()

  setStatus({ kind: 'syncing' })
  try {
    for (const tableName of SYNC_TABLE_NAMES) {
      await pushTable(supabase, tableName, userId, pushedSince)
    }
    let highestPulled: string | null = null
    for (const tableName of SYNC_TABLE_NAMES) {
      const seen = await pullTable(supabase, tableName, userId, pulledSince)
      if (seen !== null && (highestPulled === null || isAfter(seen, highestPulled))) {
        highestPulled = seen
      }
    }
    setLastSyncedAt(syncStartedAt)
    if (highestPulled !== null) setLastPulledAt(highestPulled)
    setStatus({ kind: 'idle', lastSyncedAt: syncStartedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    setStatus({ kind: 'error', message, lastSyncedAt: getLastSyncedAt() })
    throw err
  }
}
