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

const {
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
} = await import('./planningRepository')
const { createExercise, createMuscleGroup } = await import('./trainingRepository')
const { addSessionExercise, createExecutedSet, startSession } = await import('./executionRepository')
const { getRecentRpeDeviations, listAllExecutedSetsWithContext } = await import('./metricsQueries')

beforeEach(() => {
  fake.tables.training_muscle_groups = []
  fake.tables.training_exercises = []
  fake.tables.training_exercise_muscle_contributions = []
  fake.tables.training_macrocycles = []
  fake.tables.training_mesocycles = []
  fake.tables.training_weeks = []
  fake.tables.training_days = []
  fake.tables.training_planned_exercises = []
  fake.tables.training_planned_sets = []
  fake.tables.training_sessions = []
  fake.tables.training_session_exercises = []
  fake.tables.training_executed_sets = []
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
    muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
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
    restSecondsTarget: 180, dropSet: false, restPause: false })

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
      notes: '', dropSet: false, restPause: false })
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
  it('joins executed sets up to their exerciseId, sessionId, and weekId', async () => {
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
      notes: '', dropSet: false, restPause: false })

    const sets = await listAllExecutedSetsWithContext()
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({
      exerciseId: exercise.id,
      sessionId: session.id,
      weekId: week.id,
      weightKg: 100,
      reps: 5,
    })
  })

  it('reports a null weekId for a session on an unplanned day', async () => {
    const exercise = await seedExercise()
    const day = await createDay({
      weekId: null,
      date: '2026-01-05T00:00:00.000Z',
      label: '',
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
      notes: '', dropSet: false, restPause: false })

    const sets = await listAllExecutedSetsWithContext()
    expect(sets[0].weekId).toBeNull()
  })

  it('returns an empty list when nothing has been executed', async () => {
    expect(await listAllExecutedSetsWithContext()).toEqual([])
  })
})
