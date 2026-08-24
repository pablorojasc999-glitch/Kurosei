import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { createExercise, createMuscleGroup } from './trainingRepository'
import { createDay, createMacrocycle, createMesocycle, createWeek } from './planningRepository'
import type { StrengthSession } from '../domain/types'
import {
  addSessionExercise,
  countExecutedSetsForSession,
  createExecutedSet,
  endSession,
  getSessionForDay,
  reopenSession,
  reorderSessionExercise,
  setSessionExerciseClosed,
  startSession,
  updateExecutedSet,
} from './executionRepository'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.tables,
    async () => Promise.all(db.tables.map((table) => table.clear())),
  )
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
    await db.training_sessions.update(older.id, { updatedAt: '2020-01-01T00:00:00.000Z' })
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
    await db.training_sessions.add(newer)

    const found = await getSessionForDay(day.id)
    expect(found?.id).toBe(newer.id)
  })

  it('creates only one session when started concurrently for the same day', async () => {
    const day = await seedDay()
    const [first, second, third] = await Promise.all([
      startSession(day.id),
      startSession(day.id),
      startSession(day.id),
    ])
    expect(second.id).toBe(first.id)
    expect(third.id).toBe(first.id)

    const matches = await db.training_sessions
      .where('dayId')
      .equals(day.id)
      .filter((s) => s.deletedAt === null)
      .toArray()
    expect(matches).toHaveLength(1)
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
      notes: '',
    })
    const second = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 102.5,
      reps: 4,
      rpe: 9,
      eva: 3,
      notes: 'sensación pesada',
    })

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
      notes: '',
    })
    expect(first.restTakenSeconds).toBeNull()

    // simulate the first set having been logged 3 minutes ago
    const threeMinutesAgo = new Date(Date.now() - 180_000).toISOString()
    await db.training_executed_sets.update(first.id, {
      performedAt: threeMinutesAgo,
    })

    const second = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '',
    })
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
      notes: '',
    })

    await updateExecutedSet(set.id, {
      weightKg: 105,
      reps: 4,
      rpe: 9,
      eva: 3,
      notes: 'ajustado',
    })

    const updated = await db.training_executed_sets.get(set.id)
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
      (await db.training_session_exercises.get(sessionExercise.id))?.closedAt,
    ).not.toBeNull()

    await setSessionExerciseClosed(sessionExercise.id, false)
    expect(
      (await db.training_session_exercises.get(sessionExercise.id))?.closedAt,
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

    const reordered = await db.training_session_exercises
      .where('sessionId')
      .equals(session.id)
      .filter((se) => se.deletedAt === null)
      .sortBy('order')
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
    const unchanged = await db.training_session_exercises.get(se.id)
    expect(unchanged?.order).toBe(se.order)
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
        notes: '',
      })
    }
    await createExecutedSet({
      sessionExerciseId: seB.id,
      weightKg: 80,
      reps: 8,
      rpe: 7,
      eva: null,
      notes: '',
    })

    expect(await countExecutedSetsForSession(session.id)).toBe(4)
  })

  it('returns 0 for a session with no exercises', async () => {
    const day = await seedDay()
    const session = await startSession(day.id)
    expect(await countExecutedSetsForSession(session.id)).toBe(0)
  })
})
