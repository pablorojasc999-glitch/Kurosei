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
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
  dayHasLoggedData,
  deleteDay,
  deleteMacrocycle,
  deleteMesocycle,
  deleteWeek,
  listAllWeeks,
  setWeekMesocycle,
  updateWeek,
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
  movePlannedExerciseToDay,
  reorderPlannedExercise,
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

/** El rango que usan casi todas las pruebas: una semana cualquiera enlazada al mesociclo. */
function weekRange(mesocycleId: string | null, startDate = '2026-01-05', endDate = '2026-01-11') {
  return { mesocycleId, startDate, endDate }
}

describe('createPlannedSet', () => {
  it('uses a caller-supplied id instead of generating one, for optimistic UI', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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

describe('createWeek order auto-increment', () => {
  it('assigns incrementing order starting at 0', async () => {
    const mesocycle = await seedMesocycle()
    const week1 = await createWeek(weekRange(mesocycle.id))
    const week2 = await createWeek(weekRange(mesocycle.id))
    expect(week1.order).toBe(0)
    expect(week2.order).toBe(1)
  })
})

describe('duplicateWeek', () => {
  it('creates a new week with days shifted +7 days and copies planned exercises/sets', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(mesocycle.id))
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
    // La copia queda siete días después, con el mismo rango corrido.
    expect(newWeek).toMatchObject({ mesocycleId: mesocycle.id, startDate: '2026-01-12', endDate: '2026-01-18' })

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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
    await createDay({ weekId: week.id, date: '2026-01-06T00:00:00.000Z', label: '' })
    await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })

    const result = await listWeeksWithContext()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: week.id,
      macrocycleName: 'Prep',
      mesocycleName: 'Bloque 1',
      startDate: '2026-01-05',
      endDate: '2026-01-11',
      dayDates: ['2026-01-05T00:00:00.000Z', '2026-01-06T00:00:00.000Z'],
    })
  })

  it('sorts weeks chronologically by their start date', async () => {
    const mesocycle = await seedMesocycle()
    const laterWeek = await createWeek(weekRange(mesocycle.id, '2026-02-01', '2026-02-07'))
    await createDay({ weekId: laterWeek.id, date: '2026-02-01T00:00:00.000Z', label: '' })
    const earlierWeek = await createWeek(weekRange(mesocycle.id, '2026-01-01', '2026-01-07'))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    const week = await createWeek(weekRange(mesocycle.id))
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
  it('deleteMacrocycle borra los mesociclos pero deja las semanas sueltas, con todo lo planificado', async () => {
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
    const week = await createWeek(weekRange(mesocycle.id))
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
    // Las semanas son independientes: perder la agrupación no es perder el plan.
    expect(getRow('training_weeks', week.id)).toMatchObject({ mesocycleId: null, deletedAt: null })
    expect((await listDays(week.id)).map((d) => d.id)).toEqual([day.id])
    expect(await listPlannedExercises(day.id)).toHaveLength(1)
    expect(await listPlannedSets(plannedExercise.id)).toHaveLength(1)
  })

  it('deleteWeek only removes its own days, not sibling weeks', async () => {
    const mesocycle = await seedMesocycle()
    const weekToDelete = await createWeek(weekRange(mesocycle.id))
    const weekToKeep = await createWeek(weekRange(mesocycle.id))
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

  it('deleteMesocycle suelta sus semanas y no toca a los mesociclos hermanos', async () => {
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

    const linked = await createWeek(weekRange(mesoToDelete.id))
    const untouched = await createWeek(weekRange(mesoToKeep.id, '2026-01-12', '2026-01-18'))

    await deleteMesocycle(mesoToDelete.id)

    expect(getRow('training_weeks', linked.id)).toMatchObject({ mesocycleId: null, deletedAt: null })
    expect(getRow('training_weeks', untouched.id)).toMatchObject({ mesocycleId: mesoToKeep.id })
    const remaining = await listMesocycles(macrocycle.id)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(mesoToKeep.id)
  })
})

describe('copyPlannedExercisesToDay', () => {
  it('copies exercises and sets as independent records', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(mesocycle.id))
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

  it('no duplica un ejercicio que el día de destino ya tiene planificado', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(mesocycle.id))
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const sourceDay = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: '' })
    await createPlannedExercise({ dayId: sourceDay.id, exerciseId: exercise.id, notes: '' })

    const targetDay = await createDay({ weekId: week.id, date: '2026-01-12T00:00:00.000Z', label: '' })
    const ownPe = await createPlannedExercise({ dayId: targetDay.id, exerciseId: exercise.id, notes: 'Mío' })

    await copyPlannedExercisesToDay(sourceDay.id, targetDay.id)

    const targetExercises = await listPlannedExercises(targetDay.id)
    expect(targetExercises).toHaveLength(1)
    expect(targetExercises[0].id).toBe(ownPe.id)

    // Llamarla de nuevo con el mismo origen tampoco crea un segundo duplicado.
    await copyPlannedExercisesToDay(sourceDay.id, targetDay.id)
    expect(await listPlannedExercises(targetDay.id)).toHaveLength(1)
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
    const week = await createWeek(weekRange(mesocycle.id))
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

describe('semanas independientes', () => {
  it('se listan por fecha de inicio, no por el orden en que se crearon', async () => {
    const mesocycle = await seedMesocycle()
    const later = await createWeek(weekRange(mesocycle.id, '2026-01-12', '2026-01-18'))
    const earlier = await createWeek(weekRange(mesocycle.id, '2026-01-05', '2026-01-11'))

    expect((await listWeeks(mesocycle.id)).map((w) => w.id)).toEqual([earlier.id, later.id])
    expect((await listAllWeeks()).map((w) => w.id)).toEqual([earlier.id, later.id])
  })

  it('una semana puede existir sin mesociclo y aparece sólo en la lista general', async () => {
    const mesocycle = await seedMesocycle()
    const free = await createWeek(weekRange(null))

    expect(await listWeeks(mesocycle.id)).toEqual([])
    expect((await listAllWeeks()).map((w) => w.id)).toEqual([free.id])
  })

  it('acepta un rango de domingo a domingo', async () => {
    const week = await createWeek(weekRange(null, '2026-10-18', '2026-10-25'))
    expect(getRow('training_weeks', week.id)).toMatchObject({
      startDate: '2026-10-18',
      endDate: '2026-10-25',
    })
  })

  it('enlazar o soltar una semana no toca sus días ni lo planificado', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(null))
    const day = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: 'A' })

    await setWeekMesocycle(week.id, mesocycle.id)
    expect((await listWeeks(mesocycle.id)).map((w) => w.id)).toEqual([week.id])
    await setWeekMesocycle(week.id, null)
    expect(await listWeeks(mesocycle.id)).toEqual([])
    expect((await listDays(week.id)).map((d) => d.id)).toEqual([day.id])
  })

  it('updateWeek cambia el rango y el mesociclo sin mover los días', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(null))
    const day = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: 'A' })

    await updateWeek(week.id, weekRange(mesocycle.id, '2026-01-04', '2026-01-11'))

    expect(getRow('training_weeks', week.id)).toMatchObject({
      mesocycleId: mesocycle.id,
      startDate: '2026-01-04',
      endDate: '2026-01-11',
    })
    expect(getRow('training_days', day.id)).toMatchObject({ date: '2026-01-05T00:00:00.000Z' })
  })
})

describe('reorderPlannedExercise', () => {
  it('swaps a planned exercise with the previous or next sibling', async () => {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(mesocycle.id))
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

describe('movePlannedExerciseToDay', () => {
  async function seedTwoDays() {
    const mesocycle = await seedMesocycle()
    const week = await createWeek(weekRange(mesocycle.id))
    const source = await createDay({ weekId: week.id, date: '2026-01-05T00:00:00.000Z', label: 'A' })
    const target = await createDay({ weekId: week.id, date: '2026-01-07T00:00:00.000Z', label: 'B' })
    const chest = await createMuscleGroup('Pecho')
    const bench = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })
    const fly = await createExercise({
      name: 'Aperturas',
      type: 'strength',
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, factor: 0.5 }],
    })
    return { source, target, bench, fly }
  }

  it('pasa el ejercicio con sus series al final del día de destino', async () => {
    const { source, target, bench, fly } = await seedTwoDays()
    const moving = await createPlannedExercise({ dayId: source.id, exerciseId: bench.id, notes: 'pausa' })
    const set = await createPlannedSet({
      plannedExerciseId: moving.id,
      targetWeightKg: 100,
      targetReps: 5,
      targetRpe: 8,
      restSecondsTarget: null,
      dropSet: false,
      restPause: false,
    })
    const resident = await createPlannedExercise({ dayId: target.id, exerciseId: fly.id, notes: '' })

    await movePlannedExerciseToDay(moving.id, target.id)

    expect((await listPlannedExercises(source.id)).map((pe) => pe.id)).toEqual([])
    expect((await listPlannedExercises(target.id)).map((pe) => pe.id)).toEqual([resident.id, moving.id])
    // Es el mismo registro, no una copia: conserva su nota y sus series.
    expect(getRow('training_planned_exercises', moving.id)).toMatchObject({ notes: 'pausa', dayId: target.id })
    expect((await listPlannedSets(moving.id)).map((s) => s.id)).toEqual([set.id])
  })

  it('al mover al día vacío queda primero', async () => {
    const { source, target, bench } = await seedTwoDays()
    const moving = await createPlannedExercise({ dayId: source.id, exerciseId: bench.id, notes: '' })
    await movePlannedExerciseToDay(moving.id, target.id)
    expect(getRow('training_planned_exercises', moving.id)).toMatchObject({ order: 0 })
  })

  it('mover al mismo día no cambia nada', async () => {
    const { source, bench } = await seedTwoDays()
    const moving = await createPlannedExercise({ dayId: source.id, exerciseId: bench.id, notes: '' })
    await movePlannedExerciseToDay(moving.id, source.id)
    expect((await listPlannedExercises(source.id)).map((pe) => pe.id)).toEqual([moving.id])
  })

  it('rechaza un día de destino con el plan cerrado', async () => {
    const { source, target, bench } = await seedTwoDays()
    const moving = await createPlannedExercise({ dayId: source.id, exerciseId: bench.id, notes: '' })
    await setDayPlanClosed(target.id, true)
    await expect(movePlannedExerciseToDay(moving.id, target.id)).rejects.toThrow(/cerrado/)
    expect((await listPlannedExercises(source.id)).map((pe) => pe.id)).toEqual([moving.id])
  })
})
