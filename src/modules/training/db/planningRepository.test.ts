import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { createExercise, createMuscleGroup } from './trainingRepository'
import {
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
  duplicateWeek,
  findDayByDate,
  getOrCreateDayForDate,
  listDays,
  listPlannedDaysWithExercises,
  listPlannedExercises,
  listPlannedSets,
  listWeeks,
} from './planningRepository'

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
      muscleContributions: [{ muscleGroupId: chest.id, percentage: 100 }],
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
      muscleContributions: [{ muscleGroupId: chest.id, percentage: 100 }],
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
