import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { createExercise, createMuscleGroup } from './trainingRepository'
import {
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
  duplicateWeek,
  findDayByDate,
  getOrCreateDayForDate,
  listDays,
  listMesocycles,
  listPlannedDaysWithExercises,
  listPlannedExercises,
  listPlannedSets,
  listWeeks,
  listWeeksWithContext,
} from './planningRepository'
import {
  addSessionExercise,
  createExecutedSet,
  listExecutedSets,
  listSessionExercises,
  startSession,
} from './executionRepository'
import { createCardioSession, listCardioSessions } from './cardioRepository'

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
      restSecondsTarget: 180,
    })

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
      restSecondsTarget: 180,
    })

    await deleteDay(day.id)

    expect(await db.training_days.get(day.id)).toMatchObject({
      deletedAt: expect.any(String),
    })
    expect(await listPlannedExercises(day.id)).toEqual([])
    expect(await listPlannedSets(plannedExercise.id)).toEqual([])
    expect(
      (await db.training_planned_sets.get(plannedSet.id))?.deletedAt,
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
      notes: '',
    })
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

    expect(await db.training_days.get(day.id)).toMatchObject({
      deletedAt: expect.any(String),
    })
    expect(await listSessionExercises(session.id)).toEqual([])
    expect(await listExecutedSets(sessionExercise.id)).toEqual([])
    expect(
      (await db.training_sessions.get(session.id))?.deletedAt,
    ).not.toBeNull()
    expect(
      (await db.training_executed_sets.get(executedSet.id))?.deletedAt,
    ).not.toBeNull()
    expect(await listCardioSessions(day.id)).toEqual([])
    expect(
      (await db.training_cardio_sessions.get(cardioSession.id))?.deletedAt,
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
      restSecondsTarget: 180,
    })

    await deleteMacrocycle(macrocycle.id)

    expect(await db.training_macrocycles.get(macrocycle.id)).toMatchObject({
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
      (await db.training_days.get(dayToDelete.id))?.deletedAt,
    ).not.toBeNull()
    expect((await db.training_days.get(dayToKeep.id))?.deletedAt).toBeNull()
    expect(await listWeeks(mesocycle.id)).toEqual([weekToKeep])
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
      restSecondsTarget: 180,
    })

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
