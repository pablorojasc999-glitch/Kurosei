import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { DailyLog, Sex, UserProfile } from '../domain/types'

/**
 * The single profile row, if the user has ever saved one. If more than one
 * exists (e.g. two tabs racing to create it before the multi-tab guard
 * existed), the most recently updated one wins — `.first()` with no sort
 * would pick an arbitrary one by primary key instead.
 */
export async function getProfile(): Promise<UserProfile | null> {
  const profiles = await db.training_user_profile
    .filter((p) => p.deletedAt === null)
    .toArray()
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
    await db.training_user_profile.update(existing.id, {
      ...input,
      updatedAt: timestamp,
    })
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
  await db.training_user_profile.add(profile)
  return profile
}

/** Soft-deletes every profile row except `keepId` (see `upsertProfile`). */
async function deleteDuplicateProfiles(keepId: string, timestamp: string): Promise<void> {
  const others = await db.training_user_profile
    .filter((p) => p.deletedAt === null && p.id !== keepId)
    .toArray()
  await Promise.all(
    others.map((p) => db.training_user_profile.update(p.id, { deletedAt: timestamp })),
  )
}

/**
 * The bitácora entry for a calendar day (`date` as a `YYYY-MM-DD` key), if
 * one was ever saved. If more than one row exists for that date, the most
 * recently updated one wins — see `getProfile` for why an unsorted
 * `.first()` isn't safe here.
 */
export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const logs = await db.training_daily_logs
    .where('date')
    .equals(date)
    .filter((l) => l.deletedAt === null)
    .toArray()
  if (logs.length === 0) return null
  return logs.reduce((latest, l) => (l.updatedAt > latest.updatedAt ? l : latest))
}

/** Soft-deletes every bitácora row for `date` except `keepId` (see `upsertDailyLog`). */
async function deleteDuplicateDailyLogs(
  date: string,
  keepId: string,
  timestamp: string,
): Promise<void> {
  const others = await db.training_daily_logs
    .where('date')
    .equals(date)
    .filter((l) => l.deletedAt === null && l.id !== keepId)
    .toArray()
  await Promise.all(
    others.map((l) => db.training_daily_logs.update(l.id, { deletedAt: timestamp })),
  )
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
    await db.training_daily_logs.update(existing.id, {
      ...input,
      updatedAt: timestamp,
    })
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
  await db.training_daily_logs.add(log)
  return log
}
