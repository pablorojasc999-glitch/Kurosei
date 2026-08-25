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
  'finance_transactions',
] as const

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number]

const LAST_SYNCED_KEY = 'kurosei_last_synced_at'
const EPOCH = '1970-01-01T00:00:00.000Z'

export function getLastSyncedAt(): string | null {
  return localStorage.getItem(LAST_SYNCED_KEY)
}

function setLastSyncedAt(value: string): void {
  localStorage.setItem(LAST_SYNCED_KEY, value)
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
    .filter((row) => row.updatedAt > since)
    .toArray()
  if (changed.length === 0) return

  const rows = changed.map((row) => ({ ...row, userId }))
  const { error } = await client.from(tableName).upsert(rows)
  if (error) throw new Error(`${tableName}: ${error.message}`)
}

/**
 * Pulls every remote row changed since `since` and merges it into Dexie,
 * last-write-wins by updatedAt — a remote row only overwrites the local one
 * when it's strictly newer (or the local row doesn't exist yet).
 */
export async function pullTable(
  client: SupabaseClient,
  tableName: SyncTableName,
  userId: string,
  since: string,
): Promise<void> {
  const { data, error } = await client
    .from(tableName)
    .select('*')
    .eq('userId', userId)
    .gt('updatedAt', since)
  if (error) throw new Error(`${tableName}: ${error.message}`)
  if (!data || data.length === 0) return

  const table = localTable(tableName)
  for (const remoteRow of data as Array<SyncedEntity & { userId: string }>) {
    const { userId: _userId, ...localRow } = remoteRow
    const existing = await table.get(localRow.id)
    if (!existing || existing.updatedAt < localRow.updatedAt) {
      await table.put(localRow as SyncedEntity)
    }
  }
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
 * Runs one full sync cycle for `userId`: pushes local changes since the
 * last sync, then pulls remote changes since the same cutoff, merging
 * last-write-wins by updatedAt. The cutoff only advances once every table
 * has synced cleanly, so a failed sync safely retries from where it left
 * off next time.
 */
export async function syncNow(userId: string): Promise<void> {
  if (!supabase) {
    throw new Error('La sincronización no está configurada.')
  }
  const since = getLastSyncedAt() ?? EPOCH
  const syncStartedAt = new Date().toISOString()

  setStatus({ kind: 'syncing' })
  try {
    for (const tableName of SYNC_TABLE_NAMES) {
      await pushTable(supabase, tableName, userId, since)
    }
    for (const tableName of SYNC_TABLE_NAMES) {
      await pullTable(supabase, tableName, userId, since)
    }
    setLastSyncedAt(syncStartedAt)
    setStatus({ kind: 'idle', lastSyncedAt: syncStartedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    setStatus({ kind: 'error', message, lastSyncedAt: getLastSyncedAt() })
    throw err
  }
}
