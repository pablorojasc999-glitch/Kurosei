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

const { createDay, createMacrocycle, createMesocycle, createWeek } = await import(
  './planningRepository'
)
const { createExercise } = await import('./trainingRepository')
const { createCardioSession, deleteCardioSession, listCardioSessions } = await import(
  './cardioRepository'
)

beforeEach(() => {
  fake.tables.training_macrocycles = []
  fake.tables.training_mesocycles = []
  fake.tables.training_weeks = []
  fake.tables.training_days = []
  fake.tables.training_exercises = []
  fake.tables.training_cardio_sessions = []
})

async function seedDay() {
  const macrocycle = await createMacrocycle({
    name: 'Prep',
    goal: 'Competencia',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
  })
  const mesocycle = await createMesocycle({
    macrocycleId: macrocycle.id,
    name: 'Bloque 1',
    phaseType: 'accumulation',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-02-01T00:00:00.000Z',
  })
  const week = await createWeek(mesocycle.id)
  return createDay({
    weekId: week.id,
    date: '2026-01-05T00:00:00.000Z',
    label: 'Tren superior',
  })
}

async function seedCardioExercise() {
  return createExercise({
    name: 'Trote',
    type: 'cardio',
    category: null,
    muscleContributions: [],
  })
}

describe('createCardioSession / listCardioSessions', () => {
  it('is independent from the gym session time window and takes any start time', async () => {
    const day = await seedDay()
    const exercise = await seedCardioExercise()

    // logged for early morning, well before any gym session would start
    const morning = await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: '2026-01-05T06:30:00.000Z',
      durationMinutes: 30,
      distanceKm: 5,
      caloriesBurned: 320,
      notes: 'trote suave',
    })
    // logged for late night, same day
    const night = await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: '2026-01-05T22:00:00.000Z',
      durationMinutes: 20,
      distanceKm: null,
      caloriesBurned: null,
      notes: '',
    })

    const sessions = await listCardioSessions(day.id)
    expect(sessions).toHaveLength(2)
    expect(sessions[0].id).toBe(morning.id)
    expect(sessions[1].id).toBe(night.id)
  })

  it('excludes soft-deleted sessions from listing', async () => {
    const day = await seedDay()
    const exercise = await seedCardioExercise()
    const session = await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: '2026-01-05T06:30:00.000Z',
      durationMinutes: 30,
      distanceKm: null,
      caloriesBurned: null,
      notes: '',
    })

    await deleteCardioSession(session.id)

    const sessions = await listCardioSessions(day.id)
    expect(sessions).toHaveLength(0)
  })
})
