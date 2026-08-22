import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type {
  Day,
  Macrocycle,
  Mesocycle,
  PhaseType,
  PlannedExercise,
  PlannedSet,
  Week,
} from '../domain/types'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function listMacrocycles(): Promise<Macrocycle[]> {
  return db.training_macrocycles
    .filter((m) => m.deletedAt === null)
    .sortBy('startDate')
}

export interface CreateMacrocycleInput {
  name: string
  goal: string
  startDate: string
  endDate: string
}

export async function createMacrocycle(
  input: CreateMacrocycleInput,
): Promise<Macrocycle> {
  const timestamp = nowIso()
  const macrocycle: Macrocycle = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_macrocycles.add(macrocycle)
  return macrocycle
}

export async function listMesocycles(
  macrocycleId: string,
): Promise<Mesocycle[]> {
  return db.training_mesocycles
    .where('macrocycleId')
    .equals(macrocycleId)
    .filter((m) => m.deletedAt === null)
    .sortBy('order')
}

export interface CreateMesocycleInput {
  macrocycleId: string
  name: string
  phaseType: PhaseType
  startDate: string
  endDate: string
}

export async function createMesocycle(
  input: CreateMesocycleInput,
): Promise<Mesocycle> {
  const siblings = await listMesocycles(input.macrocycleId)
  const nextOrder = siblings.length
    ? Math.max(...siblings.map((m) => m.order)) + 1
    : 0
  const timestamp = nowIso()
  const mesocycle: Mesocycle = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_mesocycles.add(mesocycle)
  return mesocycle
}

export async function listWeeks(mesocycleId: string): Promise<Week[]> {
  return db.training_weeks
    .where('mesocycleId')
    .equals(mesocycleId)
    .filter((w) => w.deletedAt === null)
    .sortBy('order')
}

export async function createWeek(mesocycleId: string): Promise<Week> {
  const siblings = await listWeeks(mesocycleId)
  const nextOrder = siblings.length
    ? Math.max(...siblings.map((w) => w.order)) + 1
    : 0
  const timestamp = nowIso()
  const week: Week = {
    id: generateId(),
    mesocycleId,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_weeks.add(week)
  return week
}

export async function listDays(weekId: string): Promise<Day[]> {
  return db.training_days
    .where('weekId')
    .equals(weekId)
    .filter((d) => d.deletedAt === null)
    .sortBy('date')
}

export interface CreateDayInput {
  weekId: string | null
  date: string
  label: string
}

export async function createDay(input: CreateDayInput): Promise<Day> {
  const timestamp = nowIso()
  const day: Day = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_days.add(day)
  return day
}

export async function listPlannedExercises(
  dayId: string,
): Promise<PlannedExercise[]> {
  return db.training_planned_exercises
    .where('dayId')
    .equals(dayId)
    .filter((pe) => pe.deletedAt === null)
    .sortBy('order')
}

export interface CreatePlannedExerciseInput {
  dayId: string
  exerciseId: string
  notes: string
}

export async function createPlannedExercise(
  input: CreatePlannedExerciseInput,
): Promise<PlannedExercise> {
  const siblings = await listPlannedExercises(input.dayId)
  const nextOrder = siblings.length
    ? Math.max(...siblings.map((pe) => pe.order)) + 1
    : 0
  const timestamp = nowIso()
  const plannedExercise: PlannedExercise = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_planned_exercises.add(plannedExercise)
  return plannedExercise
}

export async function listPlannedSets(
  plannedExerciseId: string,
): Promise<PlannedSet[]> {
  return db.training_planned_sets
    .where('plannedExerciseId')
    .equals(plannedExerciseId)
    .filter((ps) => ps.deletedAt === null)
    .sortBy('setNumber')
}

export interface CreatePlannedSetInput {
  plannedExerciseId: string
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
}

export async function createPlannedSet(
  input: CreatePlannedSetInput,
): Promise<PlannedSet> {
  const siblings = await listPlannedSets(input.plannedExerciseId)
  const nextSetNumber = siblings.length
    ? Math.max(...siblings.map((ps) => ps.setNumber)) + 1
    : 1
  const timestamp = nowIso()
  const plannedSet: PlannedSet = {
    id: generateId(),
    ...input,
    setNumber: nextSetNumber,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_planned_sets.add(plannedSet)
  return plannedSet
}

export async function deletePlannedSet(id: string): Promise<void> {
  await db.training_planned_sets.update(id, { deletedAt: nowIso() })
}

export async function deletePlannedExercise(id: string): Promise<void> {
  const timestamp = nowIso()
  const sets = await listPlannedSets(id)
  await db.transaction(
    'rw',
    db.training_planned_exercises,
    db.training_planned_sets,
    async () => {
      await db.training_planned_exercises.update(id, { deletedAt: timestamp })
      await Promise.all(
        sets.map((s) =>
          db.training_planned_sets.update(s.id, { deletedAt: timestamp }),
        ),
      )
    },
  )
}

/**
 * Duplicates a week as a starting point for the next one: new week appended
 * to the same mesocycle, its days shifted +7 days, with all planned
 * exercises/sets copied 1:1 so they can be edited independently.
 */
export async function duplicateWeek(sourceWeekId: string): Promise<Week> {
  const sourceWeek = await db.training_weeks.get(sourceWeekId)
  if (!sourceWeek) {
    throw new Error('Semana de origen no encontrada.')
  }

  const sourceDays = await listDays(sourceWeekId)
  const timestamp = nowIso()
  const newWeek = await createWeek(sourceWeek.mesocycleId)

  await db.transaction(
    'rw',
    db.training_days,
    db.training_planned_exercises,
    db.training_planned_sets,
    async () => {
      for (const sourceDay of sourceDays) {
        const newDay: Day = {
          id: generateId(),
          weekId: newWeek.id,
          date: new Date(
            new Date(sourceDay.date).getTime() + SEVEN_DAYS_MS,
          ).toISOString(),
          label: sourceDay.label,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        }
        await db.training_days.add(newDay)

        const sourcePlannedExercises = await listPlannedExercises(
          sourceDay.id,
        )
        for (const sourcePe of sourcePlannedExercises) {
          const newPe: PlannedExercise = {
            id: generateId(),
            dayId: newDay.id,
            exerciseId: sourcePe.exerciseId,
            order: sourcePe.order,
            notes: sourcePe.notes,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          }
          await db.training_planned_exercises.add(newPe)

          const sourceSets = await listPlannedSets(sourcePe.id)
          await db.training_planned_sets.bulkAdd(
            sourceSets.map((s) => ({
              id: generateId(),
              plannedExerciseId: newPe.id,
              setNumber: s.setNumber,
              targetWeightKg: s.targetWeightKg,
              targetReps: s.targetReps,
              targetRpe: s.targetRpe,
              restSecondsTarget: s.restSecondsTarget,
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
            })),
          )
        }
      }
    },
  )

  return newWeek
}

/** Finds the Day (if any) whose date falls on the same calendar day as `date`. */
export async function findDayByDate(date: Date): Promise<Day | null> {
  const dateKey = date.toDateString()
  const day = await db.training_days
    .filter((d) => d.deletedAt === null && new Date(d.date).toDateString() === dateKey)
    .first()
  return day ?? null
}

/**
 * Returns the Day for `date`, creating an unplanned/ad-hoc one (weekId
 * null) on the fly if none exists yet — used when logging a session or
 * cardio for a day that was never planned.
 */
export async function getOrCreateDayForDate(date: Date): Promise<Day> {
  const existing = await findDayByDate(date)
  if (existing) return existing
  return createDay({ weekId: null, date: date.toISOString(), label: '' })
}

