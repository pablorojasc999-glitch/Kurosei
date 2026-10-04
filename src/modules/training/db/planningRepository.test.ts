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

const { createExercise, createMuscleGroup } = await import('./trainingRepository')
const {
  copyPlannedExercisesToDay,
  copyPreviousWeekPlan,
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
  addExerciseToSlot,
  dayHasLoggedData,
  getBlockGridData,
  pinExerciseAcrossBlock,
  setUniformPrescription,
  deleteDay,
  deleteMacrocycle,
  deleteMesocycle,
  deleteWeek,
  duplicateWeek,
  findDayByDate,
  getOrCreateDayForDate,
  listDays,
  listMesocycles,
  listMesocyclesWithContext,
  listPlannedDaysWithExercises,
  listPlannedExercises,
  listPlannedSets,
  listPlannedSetsForExercises,
  listWeeks,
  listWeeksWithContext,
  reorderPlannedExercise,
  reorderWeek,
  setDayPlanClosed,
  setPlannedExerciseClosed,
  updateDay,
  updateMacrocycle,
  updateMesocycle,
  updatePlannedExerciseNotes,
  updatePlannedSet,
} = await import('./planningRepository')
const {
  addSessionExercise,
  createExecutedSet,
  endSession,
  listExecutedSets,
  listSessionExercises,
  startSession,
} = await import('./executionRepository')
const { createCardioSession, listCardioSessions } = await import('./cardioRepository')

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
  fake.tables.training_cardio_sessions = []
})

function getRow<T>(table: string, id: string): T | undefined {
  return fake.tables[table].find((r) => r.id === id) as T | undefined
}

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

describe('createPlannedSet', () => {
  it('uses a caller-supplied id instead of generating one, for optimistic UI', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const plannedExercise = await createPlannedExercise({ dayId: day.id, exerciseId: exercise.id, notes: '' })

    const set = await createPlannedSet({
      id: 'optimistic-id',
      plannedExerciseId: plannedExercise.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    expect(set.id).toBe('optimistic-id')
    expect(getRow('training_planned_sets', 'optimistic-id')).toBeDefined()
  })
})

describe('listPlannedSetsForExercises', () => {
  it('returns only the sets of the requested exercises, across any day', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const chest = await createMuscleGroup('Pecho')
    const bench = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const squatExercise = await createExercise({
      name: 'Sentadilla',
      type: 'strength',
      category: 'squat',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const benchPlan = await createPlannedExercise({ dayId: day.id, exerciseId: bench.id, notes: '' })
    const squatPlan = await createPlannedExercise({ dayId: day.id, exerciseId: squatExercise.id, notes: '' })
    const benchSet = await createPlannedSet({
      plannedExerciseId: benchPlan.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })
    await createPlannedSet({
      plannedExerciseId: squatPlan.id,
      targetWeightKg: 140,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    const sets = await listPlannedSetsForExercises([benchPlan.id])
    expect(sets.map((s) => s.id)).toEqual([benchSet.id])
  })

  it('returns an empty list without hitting the client when no exercises are given', async () => {
    expect(await listPlannedSetsForExercises([])).toEqual([])
  })
})

describe('createWeek / createMesocycle order auto-increment', () => {
  it('assigns incrementing order starting at 0', async () => {
    const mesocycle = await seedMesocycle()
    const week1 = await createWeek(mesocycle.id)
    const week2 = await createWeek(mesocycle.id)
    expect(week1.order).toBe(0)
    expect(week2.order).toBe(1)
  })
})

describe('duplicateWeek', () => {
  it('creates a new week with days shifted +7 days and copies planned exercises/sets', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const plannedExercise = await createPlannedExercise({
      dayId: day.id,
      exerciseId: exercise.id,
      notes: 'Técnica',
    })
    await createPlannedSet({
      plannedExerciseId: plannedExercise.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    const newWeek = await duplicateWeek(week.id)

    const weeks = await listWeeks(mesocycle.id)
    expect(weeks).toHaveLength(2)
    expect(newWeek.order).toBe(1)

    const newDays = await listDays(newWeek.id)
    expect(newDays).toHaveLength(1)
    expect(newDays[0].label).toBe('Tren superior')
    expect(new Date(newDays[0].date).getTime()).toBe(
      new Date(day.date).getTime() + 7 * 24 * 60 * 60 * 1000,
    )

    const newPlannedExercises = await listPlannedExercises(newDays[0].id)
    expect(newPlannedExercises).toHaveLength(1)
    expect(newPlannedExercises[0].exerciseId).toBe(exercise.id)
    expect(newPlannedExercises[0].id).not.toBe(plannedExercise.id)

    const newSets = await listPlannedSets(newPlannedExercises[0].id)
    expect(newSets).toHaveLength(1)
    expect(newSets[0]).toMatchObject({
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180,
    })

    // original week is untouched
    const originalSets = await listPlannedSets(plannedExercise.id)
    expect(originalSets).toHaveLength(1)
  })
})

function daysFromNow(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d
}

describe('findDayByDate', () => {
  it('returns null when no day matches the date', async () => {
    expect(await findDayByDate(new Date())).toBeNull()
  })

  it('finds a day matching the calendar date regardless of time of day', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const today = daysFromNow(0)
    const created = await createDay({
      weekId: week.id,
      date: today.toISOString(),
      label: 'Tren superior',
    })

    const lookupTime = new Date(today)
    lookupTime.setHours(23, 59, 0, 0)
    const result = await findDayByDate(lookupTime)
    expect(result?.id).toBe(created.id)
  })

  it('does not match a different calendar day', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    await createDay({
      weekId: week.id,
      date: daysFromNow(-1).toISOString(),
      label: 'Ayer',
    })

    expect(await findDayByDate(daysFromNow(0))).toBeNull()
  })

  it('resolves a legacy duplicate (two rows for the same date) to the most recently updated one', async () => {
    const today = daysFromNow(0)
    const older = await createDay({ weekId: null, date: today.toISOString(), label: 'Vieja' })
    const newer = await createDay({ weekId: null, date: today.toISOString(), label: 'Nueva' })
    const olderRow = getRow<{ updatedAt: string }>('training_days', older.id)
    if (olderRow) olderRow.updatedAt = '2020-01-01T00:00:00.000Z'
    const newerRow = getRow<{ updatedAt: string }>('training_days', newer.id)
    if (newerRow) newerRow.updatedAt = '2030-01-01T00:00:00.000Z'

    const result = await findDayByDate(today)
    expect(result?.id).toBe(newer.id)
  })
})

describe('getOrCreateDayForDate', () => {
  it('returns the existing day for that date instead of creating a duplicate', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const today = daysFromNow(0)
    const created = await createDay({
      weekId: week.id,
      date: today.toISOString(),
      label: 'Tren superior',
    })

    const result = await getOrCreateDayForDate(today)
    expect(result.id).toBe(created.id)
  })

  it('creates an ad-hoc day (no week) when none exists for that date', async () => {
    const date = daysFromNow(0)
    const result = await getOrCreateDayForDate(date)
    expect(result.weekId).toBeNull()
    expect(new Date(result.date).toDateString()).toBe(date.toDateString())

    const second = await getOrCreateDayForDate(date)
    expect(second.id).toBe(result.id)
  })
})

describe('listPlannedDaysWithExercises', () => {
  it('only returns planned (weekId set) days that have at least one exercise', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })

    const dayWithExercise = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    await createPlannedExercise({
      dayId: dayWithExercise.id,
      exerciseId: exercise.id,
      notes: '',
    })

    // planned day with no exercises yet: excluded
    await createDay({
      weekId: week.id,
      date: '2026-01-06T00:00:00.000Z',
      label: 'Vacío',
    })
    // ad-hoc day (no weekId) with an exercise: excluded, it's not a plan
    const adHocDay = await getOrCreateDayForDate(new Date('2026-01-07T12:00:00.000Z'))
    await createPlannedExercise({
      dayId: adHocDay.id,
      exerciseId: exercise.id,
      notes: '',
    })

    const result = await listPlannedDaysWithExercises()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: dayWithExercise.id,
      label: 'Tren superior',
      exerciseCount: 1,
    })
  })
})

describe('listWeeksWithContext', () => {
  it('annotates each week with its macro/mesocycle names and sorted day dates', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    await createDay({ weekId: week.id, date: '2026-01-06T00:00:00.000Z', label: '' })
    await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })

    const result = await listWeeksWithContext()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: week.id,
      macrocycleName: 'Prep',
      mesocycleName: 'Bloque 1',
      order: 0,
      dayDates: ['2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z'],
    })
  })

  it('sorts weeks chronologically by their first day', async () => {
    const mesocycle = await seedMesocycle()
    const laterWeek = await createWeek(mesocycle.id)
    await createDay({ weekId: laterWeek.id, date: '2026-02-01T00:00:00.000Z', label: '' })
    const earlierWeek = await createWeek(mesocycle.id)
    await createDay({ weekId: earlierWeek.id, date: '2026-01-01T00:00:00.000Z', label: '' })

    const result = await listWeeksWithContext()
    expect(result.map((w) => w.id)).toEqual([earlierWeek.id, laterWeek.id])
  })
})

describe('listMesocyclesWithContext', () => {
  it('annotates each mesocycle with its macrocycle name, sorted by start date', async () => {
    const macrocycle = await createMacrocycle({
      name: 'Prep',
      goal: 'Competencia',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
    })
    const later = await createMesocycle({
      macrocycleId: macrocycle.id,
      name: 'Bloque 2',
      phaseType: 'intensification',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
    })
    const earlier = await createMesocycle({
      macrocycleId: macrocycle.id,
      name: 'Bloque 1',
      phaseType: 'accumulation',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-02-01T00:00:00.000Z',
    })

    const result = await listMesocyclesWithContext()
    expect(result.map((m) => m.id)).toEqual([earlier.id, later.id])
    expect(result[0]).toMatchObject({
      id: earlier.id,
      macrocycleName: 'Prep',
      name: 'Bloque 1',
      phaseType: 'accumulation',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-02-01T00:00:00.000Z',
    })
  })
})

describe('setDayPlanClosed', () => {
  it('sets and clears planClosedAt', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })
    expect(day.planClosedAt).toBeNull()

    await setDayPlanClosed(day.id, true)
    expect(getRow<{ planClosedAt: string | null }>('training_days', day.id)?.planClosedAt).not.toBeNull()

    await setDayPlanClosed(day.id, false)
    expect(getRow<{ planClosedAt: string | null }>('training_days', day.id)?.planClosedAt).toBeNull()
  })
})

describe('setPlannedExerciseClosed', () => {
  it('sets and clears closedAt', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const plannedExercise = await createPlannedExercise({
      dayId: day.id,
      exerciseId: exercise.id,
      notes: '',
    })
    expect(plannedExercise.closedAt).toBeNull()

    await setPlannedExerciseClosed(plannedExercise.id, true)
    expect(
      getRow<{ closedAt: string | null }>('training_planned_exercises', plannedExercise.id)?.closedAt,
    ).not.toBeNull()

    await setPlannedExerciseClosed(plannedExercise.id, false)
    expect(
      getRow<{ closedAt: string | null }>('training_planned_exercises', plannedExercise.id)?.closedAt,
    ).toBeNull()
  })
})

describe('updatePlannedExerciseNotes', () => {
  it('overwrites the note without touching its sets', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const plannedExercise = await createPlannedExercise({
      dayId: day.id,
      exerciseId: exercise.id,
      notes: '',
    })
    await createPlannedSet({
      plannedExerciseId: plannedExercise.id,
      targetWeightKg: 80,
      targetReps: 5,
      targetRpe: null,
      restSecondsTarget: null,
      dropSet: false,
      restPause: false,
    })

    await updatePlannedExerciseNotes(plannedExercise.id, 'Codos pegados al cuerpo')

    expect(
      getRow<{ notes: string }>('training_planned_exercises', plannedExercise.id)?.notes,
    ).toBe('Codos pegados al cuerpo')
    expect(await listPlannedSets(plannedExercise.id)).toHaveLength(1)
  })
})

describe('updatePlannedSet', () => {
  it('overwrites a planned set\'s targets in place, keeping its setNumber', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const plannedExercise = await createPlannedExercise({
      dayId: day.id,
      exerciseId: exercise.id,
      notes: '',
    })
    const plannedSet = await createPlannedSet({
      plannedExerciseId: plannedExercise.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 120, dropSet: false, restPause: false })

    await updatePlannedSet(plannedSet.id, {
      targetWeightKg: 110,
      targetReps: 3,
      targetRpe: 9,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    const updated = getRow('training_planned_sets', plannedSet.id)
    expect(updated).toMatchObject({
      setNumber: 1,
      targetWeightKg: 110,
      targetReps: 3,
      targetRpe: 9,
      restSecondsTarget: 180,
    })
  })
})

describe('deleteDay', () => {
  it('soft-deletes the day and cascades to its planned exercises/sets', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const plannedExercise = await createPlannedExercise({
      dayId: day.id,
      exerciseId: exercise.id,
      notes: '',
    })
    const plannedSet = await createPlannedSet({
      plannedExerciseId: plannedExercise.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    await deleteDay(day.id)

    expect(getRow('training_days', day.id)).toMatchObject({
      deletedAt: expect.any(String),
    })
    expect(await listPlannedExercises(day.id)).toEqual([])
    expect(await listPlannedSets(plannedExercise.id)).toEqual([])
    expect(
      getRow<{ deletedAt: string | null }>('training_planned_sets', plannedSet.id)?.deletedAt,
    ).not.toBeNull()
  })

  it('cascades to a logged session (and its executed sets) and cardio sessions', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const cardioExercise = await createExercise({
      name: 'Cinta',
      type: 'cardio',
      category: null,
      muscleContributions: [],
    })
    const session = await startSession(day.id)
    const sessionExercise = await addSessionExercise({
      sessionId: session.id,
      exerciseId: exercise.id,
      notes: '',
    })
    const executedSet = await createExecutedSet({
      sessionExerciseId: sessionExercise.id,
      weightKg: 100,
      reps: 5,
      rpe: 8,
      eva: null,
      notes: '', dropSet: false, restPause: false })
    const cardioSession = await createCardioSession({
      dayId: day.id,
      exerciseId: cardioExercise.id,
      startedAt: '2026-01-05T10:00:00.000Z',
      durationMinutes: 20,
      distanceKm: null,
      caloriesBurned: null,
      notes: '',
    })

    expect(await dayHasLoggedData(day.id)).toBe(true)
    await deleteDay(day.id)

    expect(getRow('training_days', day.id)).toMatchObject({
      deletedAt: expect.any(String),
    })
    expect(await listSessionExercises(session.id)).toEqual([])
    expect(await listExecutedSets(sessionExercise.id)).toEqual([])
    expect(
      getRow<{ deletedAt: string | null }>('training_sessions', session.id)?.deletedAt,
    ).not.toBeNull()
    expect(
      getRow<{ deletedAt: string | null }>('training_executed_sets', executedSet.id)?.deletedAt,
    ).not.toBeNull()
    expect(await listCardioSessions(day.id)).toEqual([])
    expect(
      getRow<{ deletedAt: string | null }>('training_cardio_sessions', cardioSession.id)?.deletedAt,
    ).not.toBeNull()
  })
})

describe('deleteWeek / deleteMesocycle / deleteMacrocycle', () => {
  it('cascades all the way down to planned exercises/sets of every day', async () => {
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
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const plannedExercise = await createPlannedExercise({
      dayId: day.id,
      exerciseId: exercise.id,
      notes: '',
    })
    await createPlannedSet({
      plannedExerciseId: plannedExercise.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    await deleteMacrocycle(macrocycle.id)

    expect(getRow('training_macrocycles', macrocycle.id)).toMatchObject({
      deletedAt: expect.any(String),
    })
    expect(await listMesocycles(macrocycle.id)).toEqual([])
    expect(await listWeeks(mesocycle.id)).toEqual([])
    expect(await listDays(week.id)).toEqual([])
    expect(await listPlannedExercises(day.id)).toEqual([])
    expect(await listPlannedSets(plannedExercise.id)).toEqual([])
  })

  it('deleteWeek only removes its own days, not sibling weeks', async () => {
    const mesocycle = await seedMesocycle()
    const weekToDelete = await createWeek(mesocycle.id)
    const weekToKeep = await createWeek(mesocycle.id)
    const dayToDelete = await createDay({
      weekId: weekToDelete.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'A',
    })
    const dayToKeep = await createDay({
      weekId: weekToKeep.id,
      date: '2026-01-12T00:00:00.000Z',
      label: 'B',
    })

    await deleteWeek(weekToDelete.id)

    expect(
      getRow<{ deletedAt: string | null }>('training_days', dayToDelete.id)?.deletedAt,
    ).not.toBeNull()
    expect(
      getRow<{ deletedAt: string | null }>('training_days', dayToKeep.id)?.deletedAt,
    ).toBeNull()
    expect((await listWeeks(mesocycle.id)).map((w) => w.id)).toEqual([weekToKeep.id])
  })

  it('deleteMesocycle only removes its own weeks, not sibling mesocycles', async () => {
    const macrocycle = await createMacrocycle({
      name: 'Prep',
      goal: 'Competencia',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
    })
    const mesoToDelete = await createMesocycle({
      macrocycleId: macrocycle.id,
      name: 'Bloque 1',
      phaseType: 'accumulation',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-02-01T00:00:00.000Z',
    })
    const mesoToKeep = await createMesocycle({
      macrocycleId: macrocycle.id,
      name: 'Bloque 2',
      phaseType: 'intensification',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-03-01T00:00:00.000Z',
    })

    await deleteMesocycle(mesoToDelete.id)

    const remaining = await listMesocycles(macrocycle.id)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(mesoToKeep.id)
  })
})

describe('copyPlannedExercisesToDay', () => {
  it('copies exercises and sets as independent records', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const sourceDay = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Origen',
    })
    const sourcePe = await createPlannedExercise({
      dayId: sourceDay.id,
      exerciseId: exercise.id,
      notes: 'Técnica',
    })
    await createPlannedSet({
      plannedExerciseId: sourcePe.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180, dropSet: false, restPause: false })

    const targetDay = await createDay({
      weekId: week.id,
      date: '2026-01-12T00:00:00.000Z',
      label: 'Destino',
    })

    await copyPlannedExercisesToDay(sourceDay.id, targetDay.id)

    const copiedExercises = await listPlannedExercises(targetDay.id)
    expect(copiedExercises).toHaveLength(1)
    expect(copiedExercises[0].exerciseId).toBe(exercise.id)
    expect(copiedExercises[0].id).not.toBe(sourcePe.id)

    const copiedSets = await listPlannedSets(copiedExercises[0].id)
    expect(copiedSets).toHaveLength(1)
    expect(copiedSets[0]).toMatchObject({
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180,
    })

    // deleting the copy leaves the source untouched
    await deleteDay(targetDay.id)
    expect(await listPlannedExercises(sourceDay.id)).toHaveLength(1)
  })
})

describe('updateMacrocycle / updateMesocycle / updateDay', () => {
  it('overwrites a macrocycle in place', async () => {
    const macrocycle = await createMacrocycle({
      name: 'Prep',
      goal: 'Competencia',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-06-01T00:00:00.000Z',
    })

    await updateMacrocycle(macrocycle.id, {
      name: 'Prep (renombrado)',
      goal: 'Nueva meta',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
    })

    const updated = getRow('training_macrocycles', macrocycle.id)
    expect(updated).toMatchObject({
      name: 'Prep (renombrado)',
      goal: 'Nueva meta',
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-07-01T00:00:00.000Z',
    })
  })

  it('overwrites a mesocycle in place, keeping its order', async () => {
    const mesocycle = await seedMesocycle()

    await updateMesocycle(mesocycle.id, {
      name: 'Bloque 1 (renombrado)',
      phaseType: 'peaking',
      startDate: '2026-01-05T00:00:00.000Z',
      endDate: '2026-02-05T00:00:00.000Z',
    })

    const updated = getRow('training_mesocycles', mesocycle.id)
    expect(updated).toMatchObject({
      name: 'Bloque 1 (renombrado)',
      phaseType: 'peaking',
      order: mesocycle.order,
    })
  })

  it('overwrites a day in place', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })

    await updateDay(day.id, { date: '2026-01-06T00:00:00.000Z', label: 'Tren inferior' })

    const updated = getRow('training_days', day.id)
    expect(updated).toMatchObject({
      date: '2026-01-06T00:00:00.000Z',
      label: 'Tren inferior',
    })
  })
})

describe('reorderWeek', () => {
  it('swaps a week with the previous or next sibling', async () => {
    const mesocycle = await seedMesocycle()
    const week1 = await createWeek(mesocycle.id)
    const week2 = await createWeek(mesocycle.id)
    const week3 = await createWeek(mesocycle.id)

    await reorderWeek(week2.id, 'up')
    let ordered = await listWeeks(mesocycle.id)
    expect(ordered.map((w) => w.id)).toEqual([week2.id, week1.id, week3.id])

    await reorderWeek(week2.id, 'down')
    ordered = await listWeeks(mesocycle.id)
    expect(ordered.map((w) => w.id)).toEqual([week1.id, week2.id, week3.id])
  })

  it('is a no-op at either end of the list', async () => {
    const mesocycle = await seedMesocycle()
    const week1 = await createWeek(mesocycle.id)
    const week2 = await createWeek(mesocycle.id)

    await reorderWeek(week1.id, 'up')
    expect((await listWeeks(mesocycle.id)).map((w) => w.id)).toEqual([week1.id, week2.id])

    await reorderWeek(week2.id, 'down')
    expect((await listWeeks(mesocycle.id)).map((w) => w.id)).toEqual([week1.id, week2.id])
  })
})

describe('reorderPlannedExercise', () => {
  it('swaps a planned exercise with the previous or next sibling', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(mesocycle.id)
    const day = await createDay({
      weekId: week.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Tren superior',
    })
    const chest = await createMuscleGroup('Pecho')
    const exercise1 = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const exercise2 = await createExercise({
      name: 'Aperturas',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 0.5 }],
    })
    const pe1 = await createPlannedExercise({ dayId: day.id, exerciseId: exercise1.id, notes: '' })
    const pe2 = await createPlannedExercise({ dayId: day.id, exerciseId: exercise2.id, notes: '' })

    await reorderPlannedExercise(pe2.id, 'up')
    const ordered = await listPlannedExercises(day.id)
    expect(ordered.map((pe) => pe.id)).toEqual([pe2.id, pe1.id])
  })
})

describe('planilla del bloque', () => {
  async function seedBlock() {
    const meso = await seedMesocycle()
    const piernas = await createMuscleGroup('Cuádriceps')
    const squat = await createExercise({
      name: 'Box squat',
      type: 'strength',
      category: 'squat',
      muscleContributions: [{ muscleGroupId: piernas.id, factor: 1 }],
    })
    const remo = await createExercise({
      name: 'Remo',
      type: 'strength',
      category: null,
      muscleContributions: [{ muscleGroupId: piernas.id, factor: 1 }],
    })

    // Tres semanas de dos días cada una, corridas siete días entre sí.
    const marzo = (day: number) => `2026-03-${String(day).padStart(2, '0')}T00:00:00.000Z`
    const weeks = []
    for (let w = 0; w < 3; w++) {
      const week = await createWeek(meso.id)
      const d1 = await createDay({ weekId: week.id, date: marzo(2 + w * 7), label: '' })
      const d2 = await createDay({ weekId: week.id, date: marzo(4 + w * 7), label: '' })
      weeks.push({ week, d1, d2 })
    }
    return { meso, squat, remo, weeks }
  }

  it('getBlockGridData trae sólo lo del bloque pedido', async () => {
    const { meso, squat, weeks } = await seedBlock()
    const pe = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    await createPlannedSet({
      plannedExerciseId: pe.id,
      targetWeightKg: 130,
      targetReps: 3,
      targetRpe: null,
      restSecondsTarget: null, dropSet: false, restPause: false })

    // Otro bloque, que no debe colarse.
    const otro = await seedMesocycle()
    const otraSemana = await createWeek(otro.id)
    await createDay({ weekId: otraSemana.id, date: '2026-05-01T00:00:00.000Z', label: '' })

    const data = await getBlockGridData(meso.id)
    expect(data.weeks).toHaveLength(3)
    expect(data.days).toHaveLength(6)
    expect(data.plannedExercises).toHaveLength(1)
    expect(data.plannedSets).toHaveLength(1)
  })

  it('setUniformPrescription deja N series iguales', async () => {
    const { squat, weeks } = await seedBlock()
    const pe = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    await setUniformPrescription(pe.id, {
      sets: 4,
      reps: 3,
      weightKg: 140,
      rpe: 8,
      restSecondsTarget: 180,
    })
    const sets = await listPlannedSets(pe.id)
    expect(sets).toHaveLength(4)
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4])
    expect(sets.every((s) => s.targetReps === 3 && s.targetWeightKg === 140)).toBe(true)
  })

  it('bajar de 5 a 3 series deja 3, no 5', async () => {
    const { squat, weeks } = await seedBlock()
    const pe = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    const prescripcion = {
      reps: 3,
      weightKg: 140,
      rpe: null,
      restSecondsTarget: null,
    }
    await setUniformPrescription(pe.id, { sets: 5, ...prescripcion })
    expect(await listPlannedSets(pe.id)).toHaveLength(5)

    await setUniformPrescription(pe.id, { sets: 3, ...prescripcion })
    const sets = await listPlannedSets(pe.id)
    expect(sets).toHaveLength(3)
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3])
  })

  it('rechaza cero series o cero repeticiones', async () => {
    const { squat, weeks } = await seedBlock()
    const pe = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    await expect(
      setUniformPrescription(pe.id, {
        sets: 0,
        reps: 3,
        weightKg: null,
        rpe: null,
        restSecondsTarget: null,
      }),
    ).rejects.toThrow('al menos una serie')
    await expect(
      setUniformPrescription(pe.id, {
        sets: 3,
        reps: 0,
        weightKg: null,
        rpe: null,
        restSecondsTarget: null,
      }),
    ).rejects.toThrow('al menos una repetición')
  })

  it('fijar en el bloque replica el ejercicio en ese día de todas las semanas', async () => {
    const { meso, squat, weeks } = await seedBlock()
    const pe = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: 'Con pausa',
    })
    await setUniformPrescription(pe.id, {
      sets: 3,
      reps: 3,
      weightKg: 130,
      rpe: null,
      restSecondsTarget: null,
    })

    const result = await pinExerciseAcrossBlock(meso.id, 0, squat.id, pe.id)
    expect(result).toEqual({ applied: 3, skipped: 0 })

    for (const { d1, d2 } of weeks) {
      const enDia1 = await listPlannedExercises(d1.id)
      expect(enDia1.map((p) => p.exerciseId)).toEqual([squat.id])
      expect(enDia1[0].notes).toBe('Con pausa')
      const sets = await listPlannedSets(enDia1[0].id)
      expect(sets).toHaveLength(3)
      expect(sets.every((s) => s.targetWeightKg === 130 && s.targetReps === 3)).toBe(true)
      // El día 2 no se toca: se fija una posición, no la semana entera.
      expect(await listPlannedExercises(d2.id)).toEqual([])
    }
  })

  it('fijar no duplica lo que ya estaba: lo sobrescribe', async () => {
    const { meso, squat, weeks } = await seedBlock()
    const origen = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    await setUniformPrescription(origen.id, {
      sets: 3,
      reps: 3,
      weightKg: 130,
      rpe: null,
      restSecondsTarget: null,
    })
    const yaEstaba = await createPlannedExercise({
      dayId: weeks[1].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    await setUniformPrescription(yaEstaba.id, {
      sets: 8,
      reps: 10,
      weightKg: 60,
      rpe: null,
      restSecondsTarget: null,
    })

    await pinExerciseAcrossBlock(meso.id, 0, squat.id, origen.id)

    const enSemana2 = await listPlannedExercises(weeks[1].d1.id)
    expect(enSemana2).toHaveLength(1)
    expect(enSemana2[0].id).toBe(yaEstaba.id)
    const sets = await listPlannedSets(yaEstaba.id)
    expect(sets).toHaveLength(3)
    expect(sets.every((s) => s.targetReps === 3 && s.targetWeightKg === 130)).toBe(true)
  })

  it('fijar no toca la celda de origen', async () => {
    const { meso, squat, weeks } = await seedBlock()
    const origen = await createPlannedExercise({
      dayId: weeks[0].d1.id,
      exerciseId: squat.id,
      notes: '',
    })
    await setUniformPrescription(origen.id, {
      sets: 3,
      reps: 3,
      weightKg: 130,
      rpe: null,
      restSecondsTarget: null,
    })
    await pinExerciseAcrossBlock(meso.id, 0, squat.id, origen.id)
    expect(await listPlannedSets(origen.id)).toHaveLength(3)
  })

  it('una semana sin ese día se salta y se informa', async () => {
    const { meso, squat, weeks } = await seedBlock()
    await deleteDay(weeks[2].d2.id)
    const pe = await createPlannedExercise({
      dayId: weeks[0].d2.id,
      exerciseId: squat.id,
      notes: '',
    })
    const result = await pinExerciseAcrossBlock(meso.id, 1, squat.id, pe.id)
    expect(result).toEqual({ applied: 2, skipped: 1 })
  })

  it('addExerciseToSlot cuelga el ejercicio del día de esa posición', async () => {
    const { remo, weeks } = await seedBlock()
    const created = await addExerciseToSlot(weeks[1].week.id, 1, remo.id)
    expect(created?.dayId).toBe(weeks[1].d2.id)
    expect(await listPlannedExercises(weeks[1].d2.id)).toHaveLength(1)
  })

  it('addExerciseToSlot no duplica si el ejercicio ya está', async () => {
    const { remo, weeks } = await seedBlock()
    const primero = await addExerciseToSlot(weeks[0].week.id, 0, remo.id)
    const segundo = await addExerciseToSlot(weeks[0].week.id, 0, remo.id)
    expect(segundo?.id).toBe(primero?.id)
    expect(await listPlannedExercises(weeks[0].d1.id)).toHaveLength(1)
  })

  it('addExerciseToSlot devuelve null si la semana no tiene ese día', async () => {
    const { remo, weeks } = await seedBlock()
    expect(await addExerciseToSlot(weeks[0].week.id, 5, remo.id)).toBeNull()
  })
})

describe('copyPreviousWeekPlan', () => {
  /** Un bloque de dos semanas con dos días cada una, emparejados por posición. */
  async function seedTwoWeeks() {
    const mesocycle = await seedMesocycle()
    const chest = await createMuscleGroup('Pecho')
    const bench = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const row = await createExercise({
      name: 'Remo',
      type: 'strength',
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, factor: 0.5 }],
    })
    const week1 = await createWeek(mesocycle.id)
    const week2 = await createWeek(mesocycle.id)
    const w1d1 = await createDay({
      weekId: week1.id,
      date: '2026-01-05T00:00:00.000Z',
      label: 'Día 1',
    })
    const w1d2 = await createDay({
      weekId: week1.id,
      date: '2026-01-07T00:00:00.000Z',
      label: 'Día 2',
    })
    const w2d1 = await createDay({
      weekId: week2.id,
      date: '2026-01-12T00:00:00.000Z',
      label: 'Día 1',
    })
    const w2d2 = await createDay({
      weekId: week2.id,
      date: '2026-01-14T00:00:00.000Z',
      label: 'Día 2',
    })
    return { mesocycle, bench, row, week1, week2, w1d1, w1d2, w2d1, w2d2 }
  }

  it('trae los ejercicios y las series de la semana anterior', async () => {
    const { mesocycle, bench, row, w1d1, w1d2, w2d1, w2d2 } = await seedTwoWeeks()
    const pe = await createPlannedExercise({
      dayId: w1d1.id,
      exerciseId: bench.id,
      notes: 'Técnica',
    })
    await createPlannedSet({
      plannedExerciseId: pe.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180,
      dropSet: false,
      restPause: false,
    })
    await createPlannedExercise({ dayId: w1d2.id, exerciseId: row.id, notes: '' })

    const result = await copyPreviousWeekPlan(mesocycle.id, 1)

    expect(result).toEqual({ copied: 2, kept: 0, skippedDays: 0 })
    const copied = await listPlannedExercises(w2d1.id)
    expect(copied).toHaveLength(1)
    expect(copied[0].exerciseId).toBe(bench.id)
    expect(copied[0].notes).toBe('Técnica')
    expect(copied[0].id).not.toBe(pe.id)
    const sets = await listPlannedSets(copied[0].id)
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: 180,
    })
    // El segundo día viaja en la misma pasada: es la semana entera.
    expect(await listPlannedExercises(w2d2.id)).toHaveLength(1)
  })

  it('no pisa un ejercicio que la semana ya tenía planificado', async () => {
    const { mesocycle, bench, w1d1, w2d1 } = await seedTwoWeeks()
    const source = await createPlannedExercise({
      dayId: w1d1.id,
      exerciseId: bench.id,
      notes: '',
    })
    await createPlannedSet({
      plannedExerciseId: source.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: null,
      restSecondsTarget: null,
      dropSet: false,
      restPause: false,
    })
    const already = await createPlannedExercise({
      dayId: w2d1.id,
      exerciseId: bench.id,
      notes: '',
    })
    await createPlannedSet({
      plannedExerciseId: already.id,
      targetWeightKg: 105,
      targetReps: 3,
      targetRpe: null,
      restSecondsTarget: null,
      dropSet: false,
      restPause: false,
    })

    const result = await copyPreviousWeekPlan(mesocycle.id, 1)

    expect(result).toEqual({ copied: 0, kept: 1, skippedDays: 0 })
    const exercises = await listPlannedExercises(w2d1.id)
    expect(exercises).toHaveLength(1)
    const sets = await listPlannedSets(exercises[0].id)
    expect(sets).toHaveLength(1)
    expect(sets[0].targetWeightKg).toBe(105)
  })

  it('con slotIndex trae sólo ese día', async () => {
    const { mesocycle, bench, row, w1d1, w1d2, w2d1, w2d2 } = await seedTwoWeeks()
    await createPlannedExercise({ dayId: w1d1.id, exerciseId: bench.id, notes: '' })
    await createPlannedExercise({ dayId: w1d2.id, exerciseId: row.id, notes: '' })

    const result = await copyPreviousWeekPlan(mesocycle.id, 1, 1)

    expect(result).toEqual({ copied: 1, kept: 0, skippedDays: 0 })
    expect(await listPlannedExercises(w2d1.id)).toHaveLength(0)
    expect(await listPlannedExercises(w2d2.id)).toHaveLength(1)
  })

  it('salta un día que ya se entrenó', async () => {
    const { mesocycle, bench, w1d1, w2d1 } = await seedTwoWeeks()
    await createPlannedExercise({ dayId: w1d1.id, exerciseId: bench.id, notes: '' })
    const session = await startSession(w2d1.id)
    await endSession(session.id)

    const result = await copyPreviousWeekPlan(mesocycle.id, 1, 0)

    expect(result).toEqual({ copied: 0, kept: 0, skippedDays: 1 })
    expect(await listPlannedExercises(w2d1.id)).toHaveLength(0)
  })

  it('cuenta como saltado el día que la semana de destino no tiene', async () => {
    const { mesocycle, bench, w1d1, w1d2, w2d2 } = await seedTwoWeeks()
    await createPlannedExercise({ dayId: w1d1.id, exerciseId: bench.id, notes: '' })
    await createPlannedExercise({ dayId: w1d2.id, exerciseId: bench.id, notes: '' })
    await deleteDay(w2d2.id)

    const result = await copyPreviousWeekPlan(mesocycle.id, 1)

    expect(result).toEqual({ copied: 1, kept: 0, skippedDays: 1 })
  })

  it('la primera semana no tiene anterior, así que no hace nada', async () => {
    const { mesocycle, bench, w1d1 } = await seedTwoWeeks()
    await createPlannedExercise({ dayId: w1d1.id, exerciseId: bench.id, notes: '' })

    expect(await copyPreviousWeekPlan(mesocycle.id, 0)).toEqual({
      copied: 0,
      kept: 0,
      skippedDays: 0,
    })
    expect(await listPlannedExercises(w1d1.id)).toHaveLength(1)
  })

  it('se lleva la marca de serie no efectiva', async () => {
    const { mesocycle, bench, w1d1, w2d1 } = await seedTwoWeeks()
    const source = await createPlannedExercise({
      dayId: w1d1.id,
      exerciseId: bench.id,
      notes: '',
    })
    const aproximacion = await createPlannedSet({
      plannedExerciseId: source.id,
      targetWeightKg: 60,
      targetReps: 5,
      targetRpe: null,
      restSecondsTarget: null,
      dropSet: false,
      restPause: false,
    })
    // Se escribe directo porque la marca por serie no pasa por
    // `updatePlannedSet`: la pone la planilla con `setPlannedSets`.
    const aproximacionRow = getRow<{ countsAsEffective: boolean }>(
      'training_planned_sets',
      aproximacion.id,
    )
    if (aproximacionRow) aproximacionRow.countsAsEffective = false
    await createPlannedSet({
      plannedExerciseId: source.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: null,
      restSecondsTarget: null,
      dropSet: false,
      restPause: false,
    })

    await copyPreviousWeekPlan(mesocycle.id, 1, 0)

    const copied = await listPlannedExercises(w2d1.id)
    const sets = await listPlannedSets(copied[0].id)
    expect(sets.map((s) => s.countsAsEffective)).toEqual([false, true])
  })
})
