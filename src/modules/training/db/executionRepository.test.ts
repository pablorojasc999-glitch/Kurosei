import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabaseClient } from '../../../shared/supabase/testing'
import type { StrengthSession } from '../domain/types'

const fake = createFakeSupabaseClient()

vi.mock('../../../shared/supabase/client', () => ({
  supabase: fake.client,
  isSupabaseConfigured: true,
}))

vi.mock('../../sync/lib/auth', () => ({
  requireUserId: async () => 'user-1',
}))

const { createExercise, createMuscleGroup } = await import('./trainingRepository')
const { createDay, createMacrocycle, createMesocycle, createWeek } = await import(
  './planningRepository'
)
const {
  addSessionExercise,
  countExecutedSetsForSession,
  createExecutedSet,
  endSession,
  getSessionForDay,
  listExecutedSetsForSessionExercises,
  reopenSession,
  reorderSessionExercise,
  setSessionExerciseClosed,
  startSession,
  updateExecutedSet,
} = await import('./executionRepository')

beforeEach(() => {
  fake.tables.training_muscle_groups = []
  fake.tables.training_exercises = []
  fake.tables.training_exercise_muscle_contributions = []
  fake.tables.training_macrocycles = []
  fake.tables.training_mesocycles = []
  fake.tables.training_weeks = []
  fake.tables.training_days = []
  fake.tables.training_sessions = []
  fake.tables.training_session_exercises = []
  fake.tables.training_executed_sets = []
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

async function seedExercise() {
  const chest = await createMuscleGroup('Pecho')
  return createExercise({
    name: 'Press banca',
    type: 'strength',
    category: 'bench',
    muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
  })
}

describe('startSession / getSessionForDay', () => {
  it('creates a session on first start and reuses it on subsequent calls', async () => {
    const day = await seedDay()
    const first = await startSession(day.id)
    const second = await startSession(day.id)
    expect(second.id).toBe(first.id)

    const found = await getSessionForDay(day.id)
    expect(found?.id).toBe(first.id)
    expect(found?.endedAt).toBeNull()
  })

  it('resolves a legacy duplicate (two sessions for the same day) to the most recently updated one', async () => {
    const day = await seedDay()
    const older = await startSession(day.id)
    const olderRow = fake.tables.training_sessions.find((s) => s.id === older.id)
    if (olderRow) olderRow.updatedAt = '2020-01-01T00:00:00.000Z'
    const timestamp = '2030-01-01T00:00:00.000Z'
    const newer: StrengthSession = {
      id: 'newer-session',
      dayId: day.id,
      startedAt: timestamp,
      endedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    fake.tables.training_sessions.push({ ...newer, userId: 'user-1' })

    const found = await getSessionForDay(day.id)
    expect(found?.id).toBe(newer.id)
  })
})

describe('endSession / reopenSession', () => {
  it('sets and clears endedAt', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)

    await endSession(session.id)
    const ended = await getSessionForDay(day.id)
    expect(ended?.endedAt).not.toBeNull()

    await reopenSession(session.id)
    const reopened = await getSessionForDay(day.id)
    expect(reopened?.endedAt).toBeNull()
  })
})

describe('createExecutedSet', () => {
  it('auto-increments setNumber per session exercise', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exercise = await seedExercise()
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })

    const first = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: 2,
      notes: '', dropSet: false, restPause: false })
    const second = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 102.5,
      reps: 4,
      rpe: 9,
      eva: 3,
      notes: 'sensación pesada', dropSet: false, restPause: false })

    expect(first.setNumber).toBe(1)
    expect(second.setNumber).toBe(2)
  })

  it('computes restTakenSeconds from the previous set, null for the first', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exercise = await seedExercise()
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })

    const first = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })
    expect(first.restTakenSeconds).toBeNull()

    // simulate the first set having been logged 3 minutes ago
    const threeMinutesAgo = new Date(Date.now() - 180_000).toISOString()
    const firstRow = fake.tables.training_executed_sets.find((s) => s.id === first.id)
    if (firstRow) firstRow.performedAt = threeMinutesAgo

    const second = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })
    expect(second.restTakenSeconds).toBeGreaterThanOrEqual(179)
    expect(second.restTakenSeconds).toBeLessThanOrEqual(182)
  })
})

describe('updateExecutedSet', () => {
  it('overwrites a set\'s logged values in place, keeping its setNumber', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exercise = await seedExercise()
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })
    const set = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })

    await updateExecutedSet(set.id, {
      weightKg: 105,
      reps: 4,
      rpe: 9,
      eva: 3,
      notes: 'ajustado', dropSet: false, restPause: false })

    const updated = fake.tables.training_executed_sets.find((s) => s.id === set.id)
    expect(updated).toMatchObject({
      setNumber: 1,
      weightKg: 105,
      reps: 4,
      rpe: 9,
      eva: 3,
      notes: 'ajustado',
    })
  })
})

describe('setSessionExerciseClosed', () => {
  it('sets and clears closedAt', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exercise = await seedExercise()
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })
    expect(sessionExercise.closedAt).toBeNull()

    await setSessionExerciseClosed(sessionExercise.id, true)
    expect(
      fake.tables.training_session_exercises.find((se) => se.id === sessionExercise.id)?.closedAt,
    ).not.toBeNull()

    await setSessionExerciseClosed(sessionExercise.id, false)
    expect(
      fake.tables.training_session_exercises.find((se) => se.id === sessionExercise.id)?.closedAt,
    ).toBeNull()
  })
})

describe('reorderSessionExercise', () => {
  it('swaps order with the neighbor', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exerciseA = await seedExercise()
    const legs = await createMuscleGroup('Piernas')
    const exerciseB = await createExercise({
      name: 'Sentadilla',
      type: 'strength',
      category: 'squat',
      muscleContributions: [{ muscleGroupId: legs.id, factor: 1 }],
    })
    const seA = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exerciseA.id,
      notes: '',
    })
    const seB = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exerciseB.id,
      notes: '',
    })

    await reorderSessionExercise(seB.id, 'up')

    const reordered = fake.tables.training_session_exercises
      .filter((se) => se.sessionId === session.id && se.deletedAt === null)
      .sort((a, b) => (a.order as number) - (b.order as number))
    expect(reordered.map((se) => se.id)).toEqual([seB.id, seA.id])
  })

  it('is a no-op reordering past either end', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exercise = await seedExercise()
    const se = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })

    await reorderSessionExercise(se.id, 'up')
    const unchanged = fake.tables.training_session_exercises.find((row) => row.id === se.id)
    expect(unchanged?.order).toBe(se.order)
  })
})

describe('listExecutedSetsForSessionExercises', () => {
  it('returns only the sets of the requested session exercises', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exerciseA = await seedExercise()
    const legs = await createMuscleGroup('Piernas')
    const exerciseB = await createExercise({
      name: 'Sentadilla',
      type: 'strength',
      category: 'squat',
      muscleContributions: [{ muscleGroupId: legs.id, factor: 1 }],
    })
    const seA = await addSessionExercise({ sessionId: session.id, exerciseId: exerciseA.id, notes: '' })
    const seB = await addSessionExercise({ sessionId: session.id, exerciseId: exerciseB.id, notes: '' })
    const setA = await createExecutedSet({
      sessionExerciseId: seA.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })
    await createExecutedSet({
      sessionExerciseId: seB.id,
      weightKg: 80,
      reps: 8,
      rpe: 7,
      eva: null,
      notes: '', dropSet: false, restPause: false })

    const sets = await listExecutedSetsForSessionExercises([seA.id])
    expect(sets.map((s) => s.id)).toEqual([setA.id])
  })

  it('returns an empty list without hitting the client when no exercises are given', async () => {
    expect(await listExecutedSetsForSessionExercises([])).toEqual([])
  })
})

describe('countExecutedSetsForSession', () => {
  it('sums executed sets across every exercise in the session', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    const exerciseA = await seedExercise()
    const legs = await createMuscleGroup('Piernas')
    const exerciseB = await createExercise({
      name: 'Sentadilla',
      type: 'strength',
      category: 'squat',
      muscleContributions: [{ muscleGroupId: legs.id, factor: 1 }],
    })
    const seA = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exerciseA.id,
      notes: '',
    })
    const seB = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exerciseB.id,
      notes: '',
    })
    for (let i = 0; i < 3; i += 1) {
      await createExecutedSet({
        sessionExerciseId: seA.id,
        weightKg: 100,
        reps: 5,
        rpe: 8,
        eva: null,
        notes: '', dropSet: false, restPause: false })
    }
    await createExecutedSet({
      sessionExerciseId: seB.id,
      weightKg: 80,
      reps: 8,
      rpe: 7,
      eva: null,
      notes: '', dropSet: false, restPause: false })

    expect(await countExecutedSetsForSession(session.id)).toBe(4)
  })

  it('returns 0 for a session with no exercises', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    expect(await countExecutedSetsForSession(session.id)).toBe(0)
  })
})
