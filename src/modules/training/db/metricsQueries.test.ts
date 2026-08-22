import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
} from './planningRepository'
import { createExercise, createMuscleGroup } from './trainingRepository'
import {
  addSessionExercise,
  createExecutedSet,
  startSession,
} from './executionRepository'
import { getRecentRpeDeviations, listAllExecutedSetsWithContext } from './metricsQueries'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.tables,
    async () => Promise.all(db.tables.map((table) => table.clear())),
  )
})

async function seedMesocycle() {
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
  return mesocycle
}

async function seedExercise() {
  const chest = await createMuscleGroup('Pecho')
  return createExercise({
    name: 'Press banca',
    type: 'strength',
    category: 'bench',
    muscleContributions: [{ muscleGroupId: chest.id, percentage: 100 }],
  })
}

/** Plans one set at `plannedRpe`, then (optionally) executes one at `actualRpe`. */
async function seedTrainingDay(
  mesocycleId: string,
  date: string,
  exerciseId: string,
  plannedRpe: number,
  actualRpe?: number,
) {
  const week = await createWeek(mesocycleId)
  const day = await createDay({ weekId: week.id, date, label: 'Tren superior' })
  const plannedExercise = await createPlannedExercise({
    dayId: day.id,
    exerciseId,
    notes: '',
  })
  await createPlannedSet({
    plannedExerciseId: plannedExercise.id,
    targetWeightKg: 100,
    targetReps: 5,
    targetRpe: plannedRpe,
    restSecondsTarget: 180,
  })

  if (actualRpe !== undefined) {
    const session = await startSession(day.id)
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId,
      notes: '',
    })
    await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: actualRpe,
      eva: null,
      notes: '',
    })
  }

  return day
}

describe('getRecentRpeDeviations', () => {
  it('returns the deviation for a day with a matching planned and executed set', async () => {
    const mesocycle = await seedMesocycle()
    const exercise = await seedExercise()
    await seedTrainingDay(mesocycle.id, '2026-01-05T00:00:00.000Z', exercise.id, 8, 9)

    const deviations = await getRecentRpeDeviations(exercise.id, 3)
    expect(deviations).toEqual([1])
  })

  it('skips days with a plan but no logged session', async () => {
    const mesocycle = await seedMesocycle()
    const exercise = await seedExercise()
    await seedTrainingDay(mesocycle.id, '2026-01-05T00:00:00.000Z', exercise.id, 8) // planned only

    const deviations = await getRecentRpeDeviations(exercise.id, 3)
    expect(deviations).toEqual([])
  })

  it('orders by most recent day first and respects the limit', async () => {
    const mesocycle = await seedMesocycle()
    const exercise = await seedExercise()
    await seedTrainingDay(mesocycle.id, '2026-01-05T00:00:00.000Z', exercise.id, 8, 8) // +0
    await seedTrainingDay(mesocycle.id, '2026-01-12T00:00:00.000Z', exercise.id, 8, 9) // +1
    await seedTrainingDay(mesocycle.id, '2026-01-19T00:00:00.000Z', exercise.id, 8, 10) // +2

    const deviations = await getRecentRpeDeviations(exercise.id, 2)
    expect(deviations).toEqual([2, 1])
  })
})

describe('listAllExecutedSetsWithContext', () => {
  it('joins executed sets up to their exerciseId and sessionId', async () => {
    const mesocycle = await seedMesocycle()
    const exercise = await seedExercise()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const session = await startSession(day.id)
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })
    await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '',
    })

    const sets = await listAllExecutedSetsWithContext()
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({
      exerciseId: exercise.id,
      sessionId: session.id,
      weightKg: 100,
      reps: 5,
    })
  })

  it('returns an empty list when nothing has been executed', async () => {
    expect(await listAllExecutedSetsWithContext()).toEqual([])
  })
})
