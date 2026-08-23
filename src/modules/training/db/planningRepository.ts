import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { deleteCardioSession, listCardioSessions } from './cardioRepository'
import { deleteSession, getSessionForDay } from './executionRepository'
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

export async function updateMacrocycle(
  id: string,
  input: CreateMacrocycleInput,
): Promise<void> {
  await db.training_macrocycles.update(id, { ...input, updatedAt: nowIso() })
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

export async function updateMesocycle(
  id: string,
  input: Omit<CreateMesocycleInput, 'macrocycleId'>,
): Promise<void> {
  await db.training_mesocycles.update(id, { ...input, updatedAt: nowIso() })
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

/**
 * Swaps a week's position with its previous ('up') or next ('down') sibling
 * within the same mesocycle. A no-op at either end of the list.
 */
export async function reorderWeek(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const week = await db.training_weeks.get(id)
  if (!week) return
  const siblings = await listWeeks(week.mesocycleId)
  const index = siblings.findIndex((w) => w.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  await db.transaction('rw', db.training_weeks, async () => {
    await db.training_weeks.update(week.id, { order: target.order, updatedAt: timestamp })
    await db.training_weeks.update(target.id, { order: week.order, updatedAt: timestamp })
  })
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
    planClosedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_days.add(day)
  return day
}

export interface UpdateDayInput {
  date: string
  label: string
}

export async function updateDay(id: string, input: UpdateDayInput): Promise<void> {
  await db.training_days.update(id, { ...input, updatedAt: nowIso() })
}

/** Closes or reopens a Day's plan, locking/unlocking every planned exercise and set inside it. */
export async function setDayPlanClosed(id: string, closed: boolean): Promise<void> {
  await db.training_days.update(id, {
    planClosedAt: closed ? nowIso() : null,
    updatedAt: nowIso(),
  })
}

/** True if a strength session or cardio session was already logged for this day. */
export async function dayHasLoggedData(dayId: string): Promise<boolean> {
  const [session, cardioSessions] = await Promise.all([
    getSessionForDay(dayId),
    listCardioSessions(dayId),
  ])
  return session !== undefined || cardioSessions.length > 0
}

/**
 * Deletes a planned Day and everything tied to it: its planned
 * exercises/sets, any logged strength session (with its exercises/sets),
 * and any cardio sessions. A full, irreversible wipe of that day.
 */
export async function deleteDay(id: string): Promise<void> {
  const [plannedExercises, session, cardioSessions] = await Promise.all([
    listPlannedExercises(id),
    getSessionForDay(id),
    listCardioSessions(id),
  ])

  if (session) {
    await deleteSession(session.id)
  }
  for (const cardioSession of cardioSessions) {
    await deleteCardioSession(cardioSession.id)
  }

  const timestamp = nowIso()
  await db.transaction(
    'rw',
    db.training_days,
    db.training_planned_exercises,
    db.training_planned_sets,
    async () => {
      await db.training_days.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
      })
      for (const pe of plannedExercises) {
        await db.training_planned_exercises.update(pe.id, {
          deletedAt: timestamp,
          updatedAt: timestamp,
        })
        const sets = await listPlannedSets(pe.id)
        await Promise.all(
          sets.map((s) =>
            db.training_planned_sets.update(s.id, {
              deletedAt: timestamp,
              updatedAt: timestamp,
            }),
          ),
        )
      }
    },
  )
}

/** Deletes a Week and every day inside it (see deleteDay). */
export async function deleteWeek(id: string): Promise<void> {
  const days = await listDays(id)
  for (const day of days) {
    await deleteDay(day.id)
  }
  const timestamp = nowIso()
  await db.training_weeks.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/** Deletes a Mesocycle and every week inside it (see deleteWeek). */
export async function deleteMesocycle(id: string): Promise<void> {
  const weeks = await listWeeks(id)
  for (const week of weeks) {
    await deleteWeek(week.id)
  }
  const timestamp = nowIso()
  await db.training_mesocycles.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}

/** Deletes a Macrocycle and every mesocycle inside it (see deleteMesocycle). */
export async function deleteMacrocycle(id: string): Promise<void> {
  const mesocycles = await listMesocycles(id)
  for (const mesocycle of mesocycles) {
    await deleteMesocycle(mesocycle.id)
  }
  const timestamp = nowIso()
  await db.training_macrocycles.update(id, { deletedAt: timestamp, updatedAt: timestamp })
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
    closedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_planned_exercises.add(plannedExercise)
  return plannedExercise
}

/**
 * Swaps a planned exercise's position with its previous ('up') or next
 * ('down') sibling within the same day. A no-op at either end of the list.
 */
export async function reorderPlannedExercise(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const plannedExercise = await db.training_planned_exercises.get(id)
  if (!plannedExercise) return
  const siblings = await listPlannedExercises(plannedExercise.dayId)
  const index = siblings.findIndex((pe) => pe.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  await db.transaction('rw', db.training_planned_exercises, async () => {
    await db.training_planned_exercises.update(plannedExercise.id, {
      order: target.order,
      updatedAt: timestamp,
    })
    await db.training_planned_exercises.update(target.id, {
      order: plannedExercise.order,
      updatedAt: timestamp,
    })
  })
}

/** Closes or reopens a single planned exercise, independent of its Day's plan lock. */
export async function setPlannedExerciseClosed(
  id: string,
  closed: boolean,
): Promise<void> {
  await db.training_planned_exercises.update(id, {
    closedAt: closed ? nowIso() : null,
    updatedAt: nowIso(),
  })
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

export interface UpdatePlannedSetInput {
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
}

export async function updatePlannedSet(
  id: string,
  input: UpdatePlannedSetInput,
): Promise<void> {
  await db.training_planned_sets.update(id, {
    ...input,
    updatedAt: nowIso(),
  })
}

export async function deletePlannedSet(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.training_planned_sets.update(id, {
    deletedAt: timestamp,
    updatedAt: timestamp,
  })
}

export async function deletePlannedExercise(id: string): Promise<void> {
  const timestamp = nowIso()
  const sets = await listPlannedSets(id)
  await db.transaction(
    'rw',
    db.training_planned_exercises,
    db.training_planned_sets,
    async () => {
      await db.training_planned_exercises.update(id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
      })
      await Promise.all(
        sets.map((s) =>
          db.training_planned_sets.update(s.id, {
            deletedAt: timestamp,
            updatedAt: timestamp,
          }),
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
/**
 * Copies every planned exercise (and its planned sets) from `sourceDayId`
 * into `targetDayId`, as independent new records — editing one day
 * afterwards never touches the other.
 */
export async function copyPlannedExercisesToDay(
  sourceDayId: string,
  targetDayId: string,
): Promise<void> {
  const timestamp = nowIso()
  const sourcePlannedExercises = await listPlannedExercises(sourceDayId)
  await db.transaction(
    'rw',
    db.training_planned_exercises,
    db.training_planned_sets,
    async () => {
      for (const sourcePe of sourcePlannedExercises) {
        const newPe: PlannedExercise = {
          id: generateId(),
          dayId: targetDayId,
          exerciseId: sourcePe.exerciseId,
          order: sourcePe.order,
          notes: sourcePe.notes,
          closedAt: null,
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
    },
  )
}

export async function duplicateWeek(sourceWeekId: string): Promise<Week> {
  const sourceWeek = await db.training_weeks.get(sourceWeekId)
  if (!sourceWeek) {
    throw new Error('Semana de origen no encontrada.')
  }

  const sourceDays = await listDays(sourceWeekId)
  const timestamp = nowIso()
  const newWeek = await createWeek(sourceWeek.mesocycleId)

  const newDays: Day[] = sourceDays.map((sourceDay) => ({
    id: generateId(),
    weekId: newWeek.id,
    date: new Date(
      new Date(sourceDay.date).getTime() + SEVEN_DAYS_MS,
    ).toISOString(),
    label: sourceDay.label,
    planClosedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }))
  await db.training_days.bulkAdd(newDays)

  for (let i = 0; i < sourceDays.length; i++) {
    await copyPlannedExercisesToDay(sourceDays[i].id, newDays[i].id)
  }

  return newWeek
}

export interface PlannedDaySummary {
  id: string
  date: string
  label: string
  exerciseCount: number
}

/**
 * All planned Days (weekId set, i.e. built from Periodización) that have at
 * least one planned exercise — used to let a Registro session load any
 * previously planned day's routine, not just the one matching today's date.
 */
export async function listPlannedDaysWithExercises(): Promise<PlannedDaySummary[]> {
  const [days, plannedExercises] = await Promise.all([
    db.training_days
      .filter((d) => d.deletedAt === null && d.weekId !== null)
      .toArray(),
    db.training_planned_exercises.filter((pe) => pe.deletedAt === null).toArray(),
  ])
  const countByDay = new Map<string, number>()
  for (const pe of plannedExercises) {
    countByDay.set(pe.dayId, (countByDay.get(pe.dayId) ?? 0) + 1)
  }
  return days
    .map((d) => ({
      id: d.id,
      date: d.date,
      label: d.label,
      exerciseCount: countByDay.get(d.id) ?? 0,
    }))
    .filter((d) => d.exerciseCount > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface WeekWithContext {
  id: string
  macrocycleName: string
  mesocycleName: string
  order: number
  dayDates: string[]
}

/**
 * Every Week annotated with its macro/mesocycle names and the dates of its
 * Days, sorted chronologically by first day — drives the week picker for
 * Progreso's per-week volume view.
 */
export async function listWeeksWithContext(): Promise<WeekWithContext[]> {
  const [weeks, mesocycles, macrocycles, days] = await Promise.all([
    db.training_weeks.filter((w) => w.deletedAt === null).toArray(),
    db.training_mesocycles.filter((m) => m.deletedAt === null).toArray(),
    db.training_macrocycles.filter((m) => m.deletedAt === null).toArray(),
    db.training_days.filter((d) => d.deletedAt === null).toArray(),
  ])
  const mesoById = new Map(mesocycles.map((m) => [m.id, m]))
  const macroById = new Map(macrocycles.map((m) => [m.id, m]))
  const dayDatesByWeek = new Map<string, string[]>()
  for (const d of days) {
    if (!d.weekId) continue
    const list = dayDatesByWeek.get(d.weekId) ?? []
    list.push(d.date)
    dayDatesByWeek.set(d.weekId, list)
  }

  return weeks
    .map((w) => {
      const meso = mesoById.get(w.mesocycleId)
      const macro = meso ? macroById.get(meso.macrocycleId) : undefined
      return {
        id: w.id,
        macrocycleName: macro?.name ?? '?',
        mesocycleName: meso?.name ?? '?',
        order: w.order,
        dayDates: (dayDatesByWeek.get(w.id) ?? []).sort(),
      }
    })
    .sort((a, b) => (a.dayDates[0] ?? '').localeCompare(b.dayDates[0] ?? ''))
}

export interface MesocycleWithContext {
  id: string
  macrocycleName: string
  name: string
  phaseType: PhaseType
  startDate: string
  endDate: string
}

/**
 * Every Mesocycle annotated with its macrocycle name, sorted chronologically
 * by start date — drives the mesocycle picker for Progreso's scope selector.
 */
export async function listMesocyclesWithContext(): Promise<MesocycleWithContext[]> {
  const [mesocycles, macrocycles] = await Promise.all([
    db.training_mesocycles.filter((m) => m.deletedAt === null).toArray(),
    db.training_macrocycles.filter((m) => m.deletedAt === null).toArray(),
  ])
  const macroById = new Map(macrocycles.map((m) => [m.id, m]))

  return mesocycles
    .map((m) => ({
      id: m.id,
      macrocycleName: macroById.get(m.macrocycleId)?.name ?? '?',
      name: m.name,
      phaseType: m.phaseType,
      startDate: m.startDate,
      endDate: m.endDate,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** Finds the Day (if any) whose date falls on the same calendar day as `date`. */
/**
 * The Day matching `date`, if one exists. If more than one row somehow
 * matches (a leftover duplicate from a race before `getOrCreateDayForDate`
 * became transactional), the most recently updated one wins — an unsorted
 * `.first()` would pick an arbitrary one by primary key instead.
 */
export async function findDayByDate(date: Date): Promise<Day | null> {
  const dateKey = date.toDateString()
  const days = await db.training_days
    .filter((d) => d.deletedAt === null && new Date(d.date).toDateString() === dateKey)
    .toArray()
  if (days.length === 0) return null
  return days.reduce((latest, d) => (d.updatedAt > latest.updatedAt ? d : latest))
}

/**
 * Returns the Day for `date`, creating an unplanned/ad-hoc one (weekId
 * null) on the fly if none exists yet — used when logging a session or
 * cardio for a day that was never planned. Runs as one transaction so two
 * near-simultaneous calls (e.g. a fast double-tap) can't both pass the
 * "doesn't exist yet" check and create two Day rows for the same date.
 */
export async function getOrCreateDayForDate(date: Date): Promise<Day> {
  return db.transaction('rw', db.training_days, async () => {
    const existing = await findDayByDate(date)
    if (existing) return existing
    return createDay({ weekId: null, date: date.toISOString(), label: '' })
  })
}

