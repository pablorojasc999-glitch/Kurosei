import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { createDay, createMacrocycle, createMesocycle, createWeek } from './planningRepository'
import { createExercise } from './trainingRepository'
import {
  createCardioSession,
  deleteCardioSession,
  listCardioSessions,
} from './cardioRepository'

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

async function seedCardioExercise() {
  return createExercise({
    name: 'Trote',
    type: 'cardio',
    category: null,
    muscleContributions: [],
  })
}

describe('createCardioSession / listCardioSessions', () => {
  it('is independent from the gym session time window and takes any start time', async () => {
    const day = await seedDay()
    const exercise = await seedCardioExercise()

    // logged for early morning, well before any gym session would start
    const morning = await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: '2026-01-05T06:30:00.000Z',
      durationMinutes: 30,
      distanceKm: 5,
      rpe: 6,
      eva: null,
      notes: 'trote suave',
    })
    // logged for late night, same day
    const night = await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: '2026-01-05T22:00:00.000Z',
      durationMinutes: 20,
      distanceKm: null,
      rpe: null,
      eva: null,
      notes: '',
    })

    const sessions = await listCardioSessions(day.id)
    expect(sessions).toHaveLength(2)
    expect(sessions[0].id).toBe(morning.id)
    expect(sessions[1].id).toBe(night.id)
  })

  it('excludes soft-deleted sessions from listing', async () => {
    const day = await seedDay()
    const exercise = await seedCardioExercise()
    const session = await createCardioSession({
      dayId: day.id,
      exerciseId: exercise.id,
      startedAt: '2026-01-05T06:30:00.000Z',
      durationMinutes: 30,
      distanceKm: null,
      rpe: null,
      eva: null,
      notes: '',
    })

    await deleteCardioSession(session.id)

    const sessions = await listCardioSessions(day.id)
    expect(sessions).toHaveLength(0)
  })
})
