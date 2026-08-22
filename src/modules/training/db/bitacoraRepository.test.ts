import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { getDailyLog, getProfile, upsertDailyLog, upsertProfile } from './bitacoraRepository'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.tables,
    async () => Promise.all(db.tables.map((table) => table.clear())),
  )
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
    expect(await db.training_user_profile.count()).toBe(1)
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
    expect(await db.training_daily_logs.count()).toBe(1)
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
    // Simulate leftover duplicate rows from before upsertDailyLog deduplicated,
    // inserted directly so `.first()`-style ordering can't be relied on.
    await db.training_daily_logs.bulkAdd([
      {
        id: 'old-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        fatigue: 4,
        stimulants: 2,
        createdAt: '2026-08-22T10:00:00.000Z',
        updatedAt: '2026-08-22T10:00:00.000Z',
        deletedAt: null,
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
      },
    ])

    const found = await getDailyLog('2026-08-22')
    expect(found).toMatchObject({ id: 'new-row', fatigue: 1, stimulants: 0 })
  })

  it('cleans up duplicate rows for a date the next time it is saved', async () => {
    await db.training_daily_logs.bulkAdd([
      {
        id: 'old-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        createdAt: '2026-08-22T10:00:00.000Z',
        updatedAt: '2026-08-22T10:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 'new-row',
        date: '2026-08-22',
        ...EMPTY_LOG_INPUT,
        createdAt: '2026-08-22T09:00:00.000Z',
        updatedAt: '2026-08-22T18:00:00.000Z',
        deletedAt: null,
      },
    ])

    await upsertDailyLog('2026-08-22', { ...EMPTY_LOG_INPUT, steps: 500 })

    const active = await db.training_daily_logs
      .filter((l) => l.deletedAt === null)
      .toArray()
    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({ id: 'new-row', steps: 500 })
  })
})
