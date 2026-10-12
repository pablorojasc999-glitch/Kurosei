import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabaseClient } from '../../../shared/supabase/testing'

const fake = createFakeSupabaseClient()

vi.mock('../../../shared/supabase/client', () => ({
  supabase: fake.client,
  isSupabaseConfigured: true,
}))

vi.mock('../../sync/lib/auth', () => ({
  requireUserId: async () => 'user-1',
}))

const { getDailyLog, getProfile, listDailyLogs, upsertDailyLog, upsertProfile } = await import(
  './bitacoraRepository'
)

beforeEach(() => {
  fake.tables.training_user_profile = []
  fake.tables.training_daily_logs = []
})

describe('upsertProfile / getProfile', () => {
  it('creates the profile row on first save', async () => {
    expect(await getProfile()).toBeNull()

    const created = await upsertProfile({
      heightCm: 175,
      birthDate: '1998-01-15',
      sex: 'male',
      bodyFatPercent: 15,
      muscleMassPercent: null,
    })

    const found = await getProfile()
    expect(found).toMatchObject({ id: created.id, heightCm: 175, sex: 'male' })
  })

  it('updates the same row in place on subsequent saves, without creating a second one', async () => {
    const first = await upsertProfile({
      heightCm: 175,
      birthDate: '1998-01-15',
      sex: 'male',
      bodyFatPercent: 15,
      muscleMassPercent: null,
    })

    const updated = await upsertProfile({
      heightCm: 176,
      birthDate: '1998-01-15',
      sex: 'male',
      bodyFatPercent: 14,
      muscleMassPercent: 40,
    })

    expect(updated.id).toBe(first.id)
    expect(fake.tables.training_user_profile.filter((p) => p.deletedAt === null)).toHaveLength(1)
    const found = await getProfile()
    expect(found).toMatchObject({ heightCm: 176, bodyFatPercent: 14, muscleMassPercent: 40 })
  })
})

const EMPTY_LOG_INPUT = {
  bodyWeightKg: null,
  calories: null,
  carbsG: null,
  proteinG: null,
  fatG: null,
  sleepHours: null,
  creatineTaken: false,
  omega3Taken: false,
  vitaminDTaken: false,
  waterLiters: null,
  stress: null,
  stimulants: null,
  fatigue: null,
  steps: null,
}

describe('upsertDailyLog / getDailyLog', () => {
  it('creates a new entry keyed by date on first save', async () => {
    expect(await getDailyLog('2026-08-22')).toBeNull()

    await upsertDailyLog('2026-08-22', { ...EMPTY_LOG_INPUT, bodyWeightKg: 80, steps: 8000 })

    const found = await getDailyLog('2026-08-22')
    expect(found).toMatchObject({ date: '2026-08-22', bodyWeightKg: 80, steps: 8000 })
  })

  it('updates the same date in place instead of creating a duplicate', async () => {
    const first = await upsertDailyLog('2026-08-22', { ...EMPTY_LOG_INPUT, bodyWeightKg: 80 })
    const updated = await upsertDailyLog('2026-08-22', {
      ...EMPTY_LOG_INPUT,
      bodyWeightKg: 79.5,
      creatineTaken: true,
    })

    expect(updated.id).toBe(first.id)
    expect(fake.tables.training_daily_logs.filter((l) => l.deletedAt === null)).toHaveLength(1)
    const found = await getDailyLog('2026-08-22')
    expect(found).toMatchObject({ bodyWeightKg: 79.5, creatineTaken: true })
  })

  it('keeps different dates as independent entries', async () => {
    await upsertDailyLog('2026-08-22', { ...EMPTY_LOG_INPUT, steps: 1000 })
    await upsertDailyLog('2026-08-23', { ...EMPTY_LOG_INPUT, steps: 2000 })

    expect((await getDailyLog('2026-08-22'))?.steps).toBe(1000)
    expect((await getDailyLog('2026-08-23'))?.steps).toBe(2000)
  })

  it('resolves a legacy duplicate (two rows for the same date) to the most recently updated one', async () => {
    // Simula filas duplicadas que quedaron de antes de que upsertDailyLog
    // las deduplicara, insertadas directo para que no se pueda confiar en el
    // orden de llegada.
    fake.tables.training_daily_logs.push(
      {
        id: 'old-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        fatigue: 4,
        stimulants: 2,
        createdAt: '2026-08-22T10:00:00.000Z',
        updatedAt: '2026-08-22T10:00:00.000Z',
        deletedAt: null,
        userId: 'user-1',
      },
      {
        id: 'new-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        fatigue: 1,
        stimulants: 0,
        createdAt: '2026-08-22T09:00:00.000Z',
        updatedAt: '2026-08-22T18:00:00.000Z',
        deletedAt: null,
        userId: 'user-1',
      },
    )

    const found = await getDailyLog('2026-08-22')
    expect(found).toMatchObject({ id: 'new-row', fatigue: 1, stimulants: 0 })
  })

  it('cleans up duplicate rows for a date the next time it is saved', async () => {
    fake.tables.training_daily_logs.push(
      {
        id: 'old-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        createdAt: '2026-08-22T10:00:00.000Z',
        updatedAt: '2026-08-22T10:00:00.000Z',
        deletedAt: null,
        userId: 'user-1',
      },
      {
        id: 'new-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        createdAt: '2026-08-22T09:00:00.000Z',
        updatedAt: '2026-08-22T18:00:00.000Z',
        deletedAt: null,
        userId: 'user-1',
      },
    )

    await upsertDailyLog('2026-08-22', { ...EMPTY_LOG_INPUT, steps: 500 })

    const active = fake.tables.training_daily_logs.filter((l) => l.deletedAt === null)
    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({ id: 'new-row', steps: 500 })
  })
})

describe('listDailyLogs', () => {
  it('returns every non-deleted entry, across dates', async () => {
    await upsertDailyLog('2026-08-22', { ...EMPTY_LOG_INPUT, steps: 1000 })
    await upsertDailyLog('2026-08-23', { ...EMPTY_LOG_INPUT, steps: 2000 })

    const all = await listDailyLogs()
    expect(all.map((l) => l.date).sort()).toEqual(['2026-08-22', '2026-08-23'])
  })
})
