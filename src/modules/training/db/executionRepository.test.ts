import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { createExercise, createMuscleGroup } from './trainingRepository'
import { createDay, createMacrocycle, createMesocycle, createWeek } from './planningRepository'
import {
  addSessionExercise,
  createExecutedSet,
  endSession,
  getSessionForDay,
  reopenSession,
  startSession,
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
