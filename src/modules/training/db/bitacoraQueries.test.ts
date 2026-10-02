import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabaseClient } from '../../../shared/supabase/testing'
import { inclusiveRange } from '../lib/progressScope'

const fake = createFakeSupabaseClient()

vi.mock('../../../shared/supabase/client', () => ({
  supabase: fake.client,
  isSupabaseConfigured: true,
}))

vi.mock('../../sync/lib/auth', () => ({
  requireUserId: async () => 'user-1',
}))

const { listDailyMetricsInRange } = await import('./bitacoraQueries')
const { upsertDailyLog } = await import('./bitacoraRepository')
const { createCardioSession } = await import('./cardioRepository')
const { addSessionExercise, createExecutedSet, endSession, startSession } = await import(
  './executionRepository'
)
const { getOrCreateDayForDate } = await import('./planningRepository')
const { createExercise, createMuscleGroup } = await import('./trainingRepository')

beforeEach(() => {
  fake.tables.training_daily_logs = []
  fake.tables.training_days = []
  fake.tables.training_sessions = []
  fake.tables.training_session_exercises = []
  fake.tables.training_executed_sets = []
  fake.tables.training_cardio_sessions = []
  fake.tables.training_exercises = []
  fake.tables.training_muscle_groups = []
  fake.tables.training_exercise_muscle_contributions = []
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

describe('listDailyMetricsInRange', () => {
  it('returns one row per calendar day in range, with the bitácora entry merged in', async () => {
    await upsertDailyLog('2026-01-02', {
      ...EMPTY_LOG_INPUT,
      bodyWeightKg: 80,
      sleepHours: 7,
      creatineTaken: true,
    })

    const range = inclusiveRange('2026-01-01T00:00:00.000Z', '2026-01-03T00:00:00.000Z')
    const result = await listDailyMetricsInRange(range)

    expect(result.map((r) => r.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(result[0]).toMatchObject({ hasLog: false, bodyWeightKg: null, hadStrengthSession: false })
    expect(result[1]).toMatchObject({
      hasLog: true,
      bodyWeightKg: 80,
      sleepHours: 7,
      creatineTaken: true,
      omega3Taken: false,
    })
    expect(result[2]).toMatchObject({ hasLog: false, bodyWeightKg: null })
  })

  it('sums that day\'s cardio calories and flags/measures its strength session', async () => {
    const day = await getOrCreateDayForDate(new Date(2026, 0, 2))
    const exercise = await createExercise({ name: 'Trote', type: 'cardio', category: null, muscleContributions: [] })
    await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: new Date(2026, 0, 2, 8).toISOString(),
      durationMinutes: 30,
      distanceKm: 5,
      caloriesBurned: 300,
      notes: '',
    })
    await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: new Date(2026, 0, 2, 18).toISOString(),
      durationMinutes: 10,
      distanceKm: 1,
      caloriesBurned: 80,
      notes: '',
    })

    const session = await startSession(day.id)
    const legs = await createMuscleGroup('Piernas')
    const strengthExercise = await createExercise({
      name: 'Sentadilla',
      type: 'strength',
      category: 'squat',
      muscleContributions: [{ muscleGroupId: legs.id, factor: 1 }],
    })
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: strengthExercise.id,
      notes: '',
    })
    await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })
    await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })
    await endSession(session.id)

    const range = inclusiveRange('2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')
    const result = await listDailyMetricsInRange(range)

    expect(result).toHaveLength(1)
    expect(result[0].cardioCaloriesBurned).toBe(380)
    expect(result[0].cardioDistanceKm).toBe(6)
    expect(result[0].hadStrengthSession).toBe(true)
    expect(result[0].strengthSetCount).toBe(2)
  })

  it('excludes sessions/cardio/logs outside the requested range', async () => {
    const dayOutOfRange = await getOrCreateDayForDate(new Date(2026, 0, 10))
    const exercise = await createExercise({ name: 'Trote', type: 'cardio', category: null, muscleContributions: [] })
    await createCardioSession({
      dayId: dayOutOfRange.id,
      exerciseId: exercise.id,
      startedAt: new Date(2026, 0, 10, 8).toISOString(),
      durationMinutes: 30,
      distanceKm: 5,
      caloriesBurned: 300,
      notes: '',
    })
    await upsertDailyLog('2026-01-10', { ...EMPTY_LOG_INPUT, bodyWeightKg: 90 })

    const range = inclusiveRange('2026-01-01T00:00:00.000Z', '2026-01-03T00:00:00.000Z')
    const result = await listDailyMetricsInRange(range)

    expect(result.every((r) => r.cardioCaloriesBurned === 0)).toBe(true)
    expect(result.every((r) => r.bodyWeightKg === null)).toBe(true)
  })
})
