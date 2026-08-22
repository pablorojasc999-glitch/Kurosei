import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { DailyLog, Sex, UserProfile } from '../domain/types'

/** The single profile row, if the user has ever saved one. */
export async function getProfile(): Promise<UserProfile | null> {
  const profile = await db.training_user_profile
    .filter((p) => p.deletedAt === null)
    .first()
  return profile ?? null
}

export interface UpsertProfileInput {
  heightCm: number | null
  birthDate: string | null
  sex: Sex | null
  bodyFatPercent: number | null
  muscleMassPercent: number | null
}

/** Creates the profile row on first save, updates it in place afterwards. */
export async function upsertProfile(input: UpsertProfileInput): Promise<UserProfile> {
  const existing = await getProfile()
  const timestamp = nowIso()
  if (existing) {
    await db.training_user_profile.update(existing.id, {
      ...input,
      updatedAt: timestamp,
    })
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

/** The bitácora entry for a calendar day (`date` as a `YYYY-MM-DD` key), if one was ever saved. */
export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const log = await db.training_daily_logs
    .where('date')
    .equals(date)
    .filter((l) => l.deletedAt === null)
    .first()
  return log ?? null
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

/** Creates the day's bitácora entry on first save, updates it in place afterwards. */
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
