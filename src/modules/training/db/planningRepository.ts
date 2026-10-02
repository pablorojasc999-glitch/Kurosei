import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { deleteCardioSession, listCardioSessions } from './cardioRepository'
import { deleteSession, getSessionForDay } from './executionRepository'
import { moveInOrder } from '../lib/blockGridOrder'
import { countsAsEffective } from '../lib/effectiveSets'
import type {
  Day,
  ExecutedSet,
  Macrocycle,
  Mesocycle,
  PhaseType,
  PlannedExercise,
  PlannedSet,
  SessionExercise,
  StrengthSession,
  Week,
} from '../domain/types'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** Ya no pasa por Dexie: habla directo con Supabase. */
function client() {
  if (!supabase) throw new Error('La periodización necesita conexión para funcionar.')
  return supabase
}

export async function listMacrocycles(): Promise<Macrocycle[]> {
  const { data, error } = await client().from('training_macrocycles').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Macrocycle[]).sort((a, b) => a.startDate.localeCompare(b.startDate))
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
  const userId = await requireUserId()
  const { error } = await client().from('training_macrocycles').insert({ ...macrocycle, userId })
  if (error) throw new Error(error.message)
  return macrocycle
}

export async function updateMacrocycle(
  id: string,
  input: CreateMacrocycleInput,
): Promise<void> {
  const { error } = await client()
    .from('training_macrocycles')
    .update({ ...input, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getMesocycleById(id: string): Promise<Mesocycle | null> {
  const { data, error } = await client()
    .from('training_mesocycles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Mesocycle | null
}

export async function listMesocycles(
  macrocycleId: string,
): Promise<Mesocycle[]> {
  const { data, error } = await client()
    .from('training_mesocycles')
    .select('*')
    .eq('macrocycleId', macrocycleId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Mesocycle[]).sort((a, b) => a.order - b.order)
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
  const userId = await requireUserId()
  const { error } = await client().from('training_mesocycles').insert({ ...mesocycle, userId })
  if (error) throw new Error(error.message)
  return mesocycle
}

export async function updateMesocycle(
  id: string,
  input: Omit<CreateMesocycleInput, 'macrocycleId'>,
): Promise<void> {
  const { error } = await client()
    .from('training_mesocycles')
    .update({ ...input, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listWeeks(mesocycleId: string): Promise<Week[]> {
  const { data, error } = await client()
    .from('training_weeks')
    .select('*')
    .eq('mesocycleId', mesocycleId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Week[]).sort((a, b) => a.order - b.order)
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
  const userId = await requireUserId()
  const { error } = await client().from('training_weeks').insert({ ...week, userId })
  if (error) throw new Error(error.message)
  return week
}

export async function getWeekById(id: string): Promise<Week | null> {
  const { data, error } = await client()
    .from('training_weeks')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Week | null
}

/**
 * Swaps a week's position with its previous ('up') or next ('down') sibling
 * within the same mesocycle. A no-op at either end of the list.
 */
export async function reorderWeek(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const week = await getWeekById(id)
  if (!week) return
  const siblings = await listWeeks(week.mesocycleId)
  const index = siblings.findIndex((w) => w.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  const { error: error1 } = await client()
    .from('training_weeks')
    .update({ order: target.order, updatedAt: timestamp })
    .eq('id', week.id)
  if (error1) throw new Error(error1.message)
  const { error: error2 } = await client()
    .from('training_weeks')
    .update({ order: week.order, updatedAt: timestamp })
    .eq('id', target.id)
  if (error2) throw new Error(error2.message)
}

export async function listDays(weekId: string): Promise<Day[]> {
  const { data, error } = await client()
    .from('training_days')
    .select('*')
    .eq('weekId', weekId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Day[]).sort((a, b) => a.date.localeCompare(b.date))
}

/** Todos los días no borrados — para cruces con otras tablas (ver metricsQueries.ts). */
export async function listAllDays(): Promise<Day[]> {
  const { data, error } = await client().from('training_days').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as Day[]
}

export async function getDayById(id: string): Promise<Day | null> {
  const { data, error } = await client()
    .from('training_days')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Day | null
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
  const userId = await requireUserId()
  const { error } = await client().from('training_days').insert({ ...day, userId })
  if (error) throw new Error(error.message)
  return day
}

export interface UpdateDayInput {
  date: string
  label: string
}

export async function updateDay(id: string, input: UpdateDayInput): Promise<void> {
  const { error } = await client()
    .from('training_days')
    .update({ ...input, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Closes or reopens a Day's plan, locking/unlocking every planned exercise and set inside it. */
export async function setDayPlanClosed(id: string, closed: boolean): Promise<void> {
  const { error } = await client()
    .from('training_days')
    .update({ planClosedAt: closed ? nowIso() : null, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
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
  const { error } = await client()
    .from('training_days')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)

  for (const pe of plannedExercises) {
    const { error: peError } = await client()
      .from('training_planned_exercises')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', pe.id)
    if (peError) throw new Error(peError.message)
    const sets = await listPlannedSets(pe.id)
    for (const s of sets) {
      const { error: setError } = await client()
        .from('training_planned_sets')
        .update({ deletedAt: timestamp, updatedAt: timestamp })
        .eq('id', s.id)
      if (setError) throw new Error(setError.message)
    }
  }
}

/** Deletes a Week and every day inside it (see deleteDay). */
export async function deleteWeek(id: string): Promise<void> {
  const days = await listDays(id)
  for (const day of days) {
    await deleteDay(day.id)
  }
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_weeks')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Deletes a Mesocycle and every week inside it (see deleteWeek). */
export async function deleteMesocycle(id: string): Promise<void> {
  const weeks = await listWeeks(id)
  for (const week of weeks) {
    await deleteWeek(week.id)
  }
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_mesocycles')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Deletes a Macrocycle and every mesocycle inside it (see deleteMesocycle). */
export async function deleteMacrocycle(id: string): Promise<void> {
  const mesocycles = await listMesocycles(id)
  for (const mesocycle of mesocycles) {
    await deleteMesocycle(mesocycle.id)
  }
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_macrocycles')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listPlannedExercises(
  dayId: string,
): Promise<PlannedExercise[]> {
  const { data, error } = await client()
    .from('training_planned_exercises')
    .select('*')
    .eq('dayId', dayId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as PlannedExercise[]).sort((a, b) => a.order - b.order)
}

/** Todos los ejercicios planificados de un ejercicio, en cualquier día — para getRecentRpeDeviations (ver metricsQueries.ts). */
export async function listPlannedExercisesForExercise(
  exerciseId: string,
): Promise<PlannedExercise[]> {
  const { data, error } = await client()
    .from('training_planned_exercises')
    .select('*')
    .eq('exerciseId', exerciseId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as PlannedExercise[]
}

async function getPlannedExerciseById(id: string): Promise<PlannedExercise | null> {
  const { data, error } = await client()
    .from('training_planned_exercises')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as PlannedExercise | null
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
  const userId = await requireUserId()
  const { error } = await client()
    .from('training_planned_exercises')
    .insert({ ...plannedExercise, userId })
  if (error) throw new Error(error.message)
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
  const plannedExercise = await getPlannedExerciseById(id)
  if (!plannedExercise) return
  const siblings = await listPlannedExercises(plannedExercise.dayId)
  const index = siblings.findIndex((pe) => pe.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  const { error: error1 } = await client()
    .from('training_planned_exercises')
    .update({ order: target.order, updatedAt: timestamp })
    .eq('id', plannedExercise.id)
  if (error1) throw new Error(error1.message)
  const { error: error2 } = await client()
    .from('training_planned_exercises')
    .update({ order: plannedExercise.order, updatedAt: timestamp })
    .eq('id', target.id)
  if (error2) throw new Error(error2.message)
}

/** Closes or reopens a single planned exercise, independent of its Day's plan lock. */
export async function setPlannedExerciseClosed(
  id: string,
  closed: boolean,
): Promise<void> {
  const { error } = await client()
    .from('training_planned_exercises')
    .update({ closedAt: closed ? nowIso() : null, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listPlannedSets(
  plannedExerciseId: string,
): Promise<PlannedSet[]> {
  const { data, error } = await client()
    .from('training_planned_sets')
    .select('*')
    .eq('plannedExerciseId', plannedExerciseId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as PlannedSet[]).sort((a, b) => a.setNumber - b.setNumber)
}

/**
 * Las series planificadas de varios ejercicios a la vez — evita traer la
 * tabla entera cuando ya se sabe a qué ejercicios limitarse (ver
 * SessionView.tsx y PeriodizationPage.tsx).
 */
export async function listPlannedSetsForExercises(
  plannedExerciseIds: string[],
): Promise<PlannedSet[]> {
  if (plannedExerciseIds.length === 0) return []
  const { data, error } = await client()
    .from('training_planned_sets')
    .select('*')
    .in('plannedExerciseId', plannedExerciseIds)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as PlannedSet[]
}

export interface CreatePlannedSetInput {
  /**
   * Opcional a propósito: una pantalla que ya mostró la serie de forma
   * optimista (ver `useRemoteQuery.setOptimistic`) pasa el mismo id que le
   * puso a esa fila, para que la confirmación del servidor no la reemplace
   * por otra con id distinto.
   */
  id?: string
  plannedExerciseId: string
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
  dropSet: boolean
  restPause: boolean
}

export async function createPlannedSet(
  input: CreatePlannedSetInput,
): Promise<PlannedSet> {
  const { id, ...rest } = input
  const siblings = await listPlannedSets(rest.plannedExerciseId)
  const nextSetNumber = siblings.length
    ? Math.max(...siblings.map((ps) => ps.setNumber)) + 1
    : 1
  const timestamp = nowIso()
  const plannedSet: PlannedSet = {
    id: id ?? generateId(),
    ...rest,
    setNumber: nextSetNumber,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('training_planned_sets').insert({ ...plannedSet, userId })
  if (error) throw new Error(error.message)
  return plannedSet
}

export interface UpdatePlannedSetInput {
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  /**
   * Opcional a propósito: el plan del día ya no pide descanso, así que omitirlo
   * deja el que la serie tuviera en vez de borrárselo por editarle el peso.
   */
  restSecondsTarget?: number | null
  dropSet: boolean
  restPause: boolean
}

export async function updatePlannedSet(
  id: string,
  input: UpdatePlannedSetInput,
): Promise<void> {
  // Mismo criterio que `setPlannedSets`: la clave que no viene no se toca.
  // Pasarla como `undefined` en el update la dejaría en undefined, que no es
  // lo mismo que no haberla pasado.
  const { restSecondsTarget, ...rest } = input
  const { error } = await client()
    .from('training_planned_sets')
    .update({
      ...rest,
      ...(restSecondsTarget === undefined ? {} : { restSecondsTarget }),
      updatedAt: nowIso(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePlannedSet(id: string): Promise<void> {
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_planned_sets')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePlannedExercise(id: string): Promise<void> {
  const timestamp = nowIso()
  const sets = await listPlannedSets(id)
  const { error } = await client()
    .from('training_planned_exercises')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
  for (const s of sets) {
    const { error: setError } = await client()
      .from('training_planned_sets')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', s.id)
    if (setError) throw new Error(setError.message)
  }
}

/**
 * Las series de un ejercicio planificado, listas para copiarlas a otro.
 *
 * La marca de serie efectiva se resuelve en vez de copiarse cruda: una serie
 * sin marca propia hereda la del ejercicio de origen, y al pegarla en un
 * ejercicio nuevo —que no tiene esa herencia— la marca se perdería. Sin esto,
 * copiar un día convertía cada aproximación en trabajo efectivo.
 */
function setsToCopy(sets: PlannedSet[], source: PlannedExercise): PlannedSetInput[] {
  return [...sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => ({
      targetWeightKg: s.targetWeightKg,
      targetReps: s.targetReps,
      targetRpe: s.targetRpe,
      restSecondsTarget: s.restSecondsTarget,
      dropSet: s.dropSet === true,
      restPause: s.restPause === true,
      countsAsEffective: countsAsEffective(s, source),
    }))
}

/**
 * Copia un ejercicio planificado a otro día, con sus notas y sus series, como
 * filas nuevas e independientes.
 *
 * Se conserva el `order` de origen en vez de recalcularlo: la planilla ordena
 * las filas por él, así que renumerar dejaría el día copiado con los
 * ejercicios en otro orden que el original.
 */
async function copyPlannedExerciseTo(
  source: PlannedExercise,
  targetDayId: string,
): Promise<PlannedExercise> {
  const timestamp = nowIso()
  const copy: PlannedExercise = {
    id: generateId(),
    dayId: targetDayId,
    exerciseId: source.exerciseId,
    order: source.order,
    notes: source.notes,
    closedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('training_planned_exercises').insert({ ...copy, userId })
  if (error) throw new Error(error.message)
  const sourceSets = await listPlannedSets(source.id)
  if (sourceSets.length > 0) {
    await setPlannedSets(copy.id, setsToCopy(sourceSets, source))
  }
  return copy
}

/**
 * Copies every planned exercise (and its planned sets) from `sourceDayId`
 * into `targetDayId`, as independent new records — editing one day
 * afterwards never touches the other.
 */
export async function copyPlannedExercisesToDay(
  sourceDayId: string,
  targetDayId: string,
): Promise<void> {
  const sourcePlannedExercises = await listPlannedExercises(sourceDayId)
  for (const sourcePe of sourcePlannedExercises) {
    await copyPlannedExerciseTo(sourcePe, targetDayId)
  }
}

/**
 * Duplicates a week as a starting point for the next one: new week appended
 * to the same mesocycle, its days shifted +7 days, with all planned
 * exercises/sets copied 1:1 so they can be edited independently.
 */
export async function duplicateWeek(sourceWeekId: string): Promise<Week> {
  const sourceWeek = await getWeekById(sourceWeekId)
  if (!sourceWeek) {
    throw new Error('Semana de origen no encontrada.')
  }

  const sourceDays = await listDays(sourceWeekId)
  const newWeek = await createWeek(sourceWeek.mesocycleId)

  const newDays: Day[] = []
  for (const sourceDay of sourceDays) {
    const newDay = await createDay({
      weekId: newWeek.id,
      date: new Date(new Date(sourceDay.date).getTime() + SEVEN_DAYS_MS).toISOString(),
      label: sourceDay.label,
    })
    newDays.push(newDay)
  }

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
    listAllDays(),
    (async () => {
      const { data, error } = await client()
        .from('training_planned_exercises')
        .select('*')
        .is('deletedAt', null)
      if (error) throw new Error(error.message)
      return data as PlannedExercise[]
    })(),
  ])
  const plannedDays = days.filter((d) => d.weekId !== null)
  const countByDay = new Map<string, number>()
  for (const pe of plannedExercises) {
    countByDay.set(pe.dayId, (countByDay.get(pe.dayId) ?? 0) + 1)
  }
  return plannedDays
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
  const [weeksRes, mesocyclesRes, macrocyclesRes, days] = await Promise.all([
    client().from('training_weeks').select('*').is('deletedAt', null),
    client().from('training_mesocycles').select('*').is('deletedAt', null),
    client().from('training_macrocycles').select('*').is('deletedAt', null),
    listAllDays(),
  ])
  if (weeksRes.error) throw new Error(weeksRes.error.message)
  if (mesocyclesRes.error) throw new Error(mesocyclesRes.error.message)
  if (macrocyclesRes.error) throw new Error(macrocyclesRes.error.message)
  const weeks = weeksRes.data as Week[]
  const mesocycles = mesocyclesRes.data as Mesocycle[]
  const macrocycles = macrocyclesRes.data as Macrocycle[]

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
  const [mesocyclesRes, macrocyclesRes] = await Promise.all([
    client().from('training_mesocycles').select('*').is('deletedAt', null),
    client().from('training_macrocycles').select('*').is('deletedAt', null),
  ])
  if (mesocyclesRes.error) throw new Error(mesocyclesRes.error.message)
  if (macrocyclesRes.error) throw new Error(macrocyclesRes.error.message)
  const mesocycles = mesocyclesRes.data as Mesocycle[]
  const macrocycles = macrocyclesRes.data as Macrocycle[]
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

/**
 * The Day matching `date`, if one exists. If more than one row somehow
 * matches (a leftover duplicate from a race before `getOrCreateDayForDate`
 * guarded against it), the most recently updated one wins — an unsorted
 * read would pick an arbitrary one instead.
 */
export async function findDayByDate(date: Date): Promise<Day | null> {
  const dateKey = date.toDateString()
  const days = (await listAllDays()).filter(
    (d) => new Date(d.date).toDateString() === dateKey,
  )
  if (days.length === 0) return null
  return days.reduce((latest, d) => (d.updatedAt > latest.updatedAt ? d : latest))
}

/**
 * Returns the Day for `date`, creating an unplanned/ad-hoc one (weekId
 * null) on the fly if none exists yet — used when logging a session or
 * cardio for a day that was never planned.
 *
 * No hay transacción entre cliente y Supabase que evite que dos toques casi
 * simultáneos pasen juntos el "no existe todavía" y creen dos días — el
 * mismo riesgo que ya se acepta en el resto de los repositorios migrados.
 */
export async function getOrCreateDayForDate(date: Date): Promise<Day> {
  const existing = await findDayByDate(date)
  if (existing) return existing
  return createDay({ weekId: null, date: date.toISOString(), label: '' })
}

// ---------------------------------------------------------------------
// Planilla del bloque
// ---------------------------------------------------------------------

/** Todo lo que la planilla del bloque necesita, en una sola pasada. */
export interface BlockGridData {
  weeks: Week[]
  days: Day[]
  plannedExercises: PlannedExercise[]
  plannedSets: PlannedSet[]
  /** Lo realizado, para poder contrastarlo contra el plan en la misma celda. */
  sessions: StrengthSession[]
  sessionExercises: SessionExercise[]
  executedSets: ExecutedSet[]
}

export async function getBlockGridData(mesocycleId: string): Promise<BlockGridData> {
  const weeks = await listWeeks(mesocycleId)
  const weekIds = weeks.map((w) => w.id)
  if (weekIds.length === 0) {
    return { weeks, days: [], plannedExercises: [], plannedSets: [], sessions: [], sessionExercises: [], executedSets: [] }
  }

  const { data: daysData, error: daysError } = await client()
    .from('training_days')
    .select('*')
    .in('weekId', weekIds)
    .is('deletedAt', null)
  if (daysError) throw new Error(daysError.message)
  const days = daysData as Day[]

  const dayIds = days.map((d) => d.id)
  let plannedExercises: PlannedExercise[] = []
  let sessions: StrengthSession[] = []
  if (dayIds.length > 0) {
    const [peRes, sessionsRes] = await Promise.all([
      client().from('training_planned_exercises').select('*').in('dayId', dayIds).is('deletedAt', null),
      client().from('training_sessions').select('*').in('dayId', dayIds).is('deletedAt', null),
    ])
    if (peRes.error) throw new Error(peRes.error.message)
    if (sessionsRes.error) throw new Error(sessionsRes.error.message)
    plannedExercises = peRes.data as PlannedExercise[]
    sessions = sessionsRes.data as StrengthSession[]
  }

  const peIds = plannedExercises.map((pe) => pe.id)
  const plannedSets =
    peIds.length === 0
      ? []
      : ((await (async () => {
          const { data, error } = await client()
            .from('training_planned_sets')
            .select('*')
            .in('plannedExerciseId', peIds)
            .is('deletedAt', null)
          if (error) throw new Error(error.message)
          return data as PlannedSet[]
        })()) ?? [])

  const sessionIds = sessions.map((s) => s.id)
  const sessionExercises =
    sessionIds.length === 0
      ? []
      : ((await (async () => {
          const { data, error } = await client()
            .from('training_session_exercises')
            .select('*')
            .in('sessionId', sessionIds)
            .is('deletedAt', null)
          if (error) throw new Error(error.message)
          return data as SessionExercise[]
        })()) ?? [])

  const seIds = sessionExercises.map((se) => se.id)
  const executedSets =
    seIds.length === 0
      ? []
      : ((await (async () => {
          const { data, error } = await client()
            .from('training_executed_sets')
            .select('*')
            .in('sessionExerciseId', seIds)
            .is('deletedAt', null)
          if (error) throw new Error(error.message)
          return data as ExecutedSet[]
        })()) ?? [])

  return {
    weeks,
    days,
    plannedExercises,
    plannedSets,
    sessions,
    sessionExercises,
    executedSets,
  }
}

/** La prescripción uniforme que se edita desde una celda de la planilla. */
export interface UniformPrescription {
  sets: number
  reps: number
  weightKg: number | null
  rpe: number | null
  restSecondsTarget: number | null
}

/** Una serie del plan, tal como se edita en la planilla. */
export interface PlannedSetInput {
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
  /**
   * Opcionales a propósito: la prescripción uniforme no ofrece estas marcas,
   * así que omitirlas deja la que ya tuviera la serie en vez de borrarla sin
   * que nadie la haya desmarcado.
   */
  dropSet?: boolean
  restPause?: boolean
  countsAsEffective?: boolean
}

/**
 * Deja las series de un ejercicio planificado exactamente como se piden,
 * renumeradas desde 1.
 *
 * Se reutilizan las filas que ya existen en vez de borrarlas y recrearlas: así
 * la sincronización ve una edición y no un borrado más un alta.
 */
export async function setPlannedSets(
  plannedExerciseId: string,
  rows: PlannedSetInput[],
): Promise<void> {
  if (rows.length === 0) throw new Error('Tiene que haber al menos una serie.')
  if (rows.some((r) => !Number.isInteger(r.targetReps) || r.targetReps < 1)) {
    throw new Error('Cada serie necesita al menos una repetición.')
  }

  const timestamp = nowIso()
  const existing = await listPlannedSets(plannedExerciseId)
  const userId = await requireUserId()

  for (let i = 0; i < rows.length; i++) {
    const { dropSet, restPause, countsAsEffective, ...rest } = rows[i]
    const fields = {
      ...rest,
      setNumber: i + 1,
      updatedAt: timestamp,
      ...(dropSet === undefined ? {} : { dropSet }),
      ...(restPause === undefined ? {} : { restPause }),
      ...(countsAsEffective === undefined ? {} : { countsAsEffective }),
    }
    const current = existing[i]
    if (current) {
      const { error } = await client().from('training_planned_sets').update(fields).eq('id', current.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await client()
        .from('training_planned_sets')
        .insert({
          id: generateId(),
          plannedExerciseId,
          dropSet: dropSet === true,
          restPause: restPause === true,
          ...fields,
          createdAt: timestamp,
          deletedAt: null,
          userId,
        })
      if (error) throw new Error(error.message)
    }
  }
  // Las que sobran se borran: bajar de 5 a 3 series tiene que dejar 3.
  for (const extra of existing.slice(rows.length)) {
    const { error } = await client()
      .from('training_planned_sets')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', extra.id)
    if (error) throw new Error(error.message)
  }
}

/**
 * El atajo de la planilla: N series iguales, que es como se prescribe el 90%
 * del powerlifting.
 */
export async function setUniformPrescription(
  plannedExerciseId: string,
  input: UniformPrescription,
): Promise<void> {
  if (input.sets < 1) throw new Error('Tiene que haber al menos una serie.')
  if (input.reps < 1) throw new Error('Tiene que haber al menos una repetición.')
  await setPlannedSets(
    plannedExerciseId,
    Array.from({ length: input.sets }, () => ({
      targetWeightKg: input.weightKg,
      targetReps: input.reps,
      targetRpe: input.rpe,
      restSecondsTarget: input.restSecondsTarget,
    })),
  )
}

export interface PinExerciseResult {
  /** En cuántas semanas quedó el ejercicio con esa prescripción. */
  applied: number
  /** Semanas del bloque que no tienen ese día, así que no se pudo aplicar. */
  skipped: number
}

/**
 * Fija un ejercicio en la misma posición de día de todas las semanas del
 * bloque, con la prescripción de la celda de origen. Es lo que hace útil que
 * el "día 1" sea siempre el mismo trabajo: se define una vez y se replica.
 *
 * Una semana que no llega a tener ese día se salta en vez de inventarle una
 * fecha, y se informa cuántas fueron.
 */
export async function pinExerciseAcrossBlock(
  mesocycleId: string,
  slotIndex: number,
  exerciseId: string,
  sourcePlannedExerciseId: string,
): Promise<PinExerciseResult> {
  const source = await getPlannedExerciseById(sourcePlannedExerciseId)
  if (!source) throw new Error('No se encontró el ejercicio de origen.')
  const sourceSets = await listPlannedSets(sourcePlannedExerciseId)

  const { weeks, days } = await getBlockGridData(mesocycleId)
  let applied = 0
  let skipped = 0

  for (const week of weeks) {
    const weekDays = days
      .filter((d) => d.weekId === week.id)
      .sort((a, b) => a.date.localeCompare(b.date))
    const target = weekDays[slotIndex]
    if (!target) {
      skipped += 1
      continue
    }

    const existing = (await listPlannedExercises(target.id)).find(
      (pe) => pe.exerciseId === exerciseId,
    )
    const plannedExercise =
      existing ??
      (await createPlannedExercise({
        dayId: target.id,
        exerciseId,
        notes: source.notes,
      }))

    if (plannedExercise.id !== sourcePlannedExerciseId) {
      await replaceSetsFrom(plannedExercise.id, sourceSets, source)
    }
    applied += 1
  }

  return { applied, skipped }
}

/** Deja las series de `plannedExerciseId` idénticas a las del ejercicio de origen. */
async function replaceSetsFrom(
  plannedExerciseId: string,
  sourceSets: PlannedSet[],
  source: PlannedExercise,
): Promise<void> {
  if (sourceSets.length === 0) return
  await setPlannedSets(plannedExerciseId, setsToCopy(sourceSets, source))
}

/**
 * Añade un ejercicio a la posición de día de una semana concreta — el `+` de
 * una celda vacía de la planilla.
 */
export async function addExerciseToSlot(
  weekId: string,
  slotIndex: number,
  exerciseId: string,
): Promise<PlannedExercise | null> {
  const weekDays = await listDays(weekId)
  const target = [...weekDays].sort((a, b) => a.date.localeCompare(b.date))[slotIndex]
  if (!target) return null
  const existing = (await listPlannedExercises(target.id)).find(
    (pe) => pe.exerciseId === exerciseId,
  )
  if (existing) return existing
  return createPlannedExercise({ dayId: target.id, exerciseId, notes: '' })
}

/**
 * Los días de un bloque por posición: `[semana][posición]`, ordenados por
 * fecha dentro de cada semana.
 *
 * Es el mismo emparejamiento que hace la planilla —el "día 1" es posicional, no
 * el lunes—, y lo necesitan todas las operaciones que trabajan sobre una fila
 * entera en vez de sobre un día suelto.
 */
async function slotDaysOfBlock(mesocycleId: string): Promise<Day[][]> {
  const weeks = await listWeeks(mesocycleId)
  const perWeek: Day[][] = []
  for (const week of weeks) {
    const days = await listDays(week.id)
    perWeek.push([...days].sort((a, b) => a.date.localeCompare(b.date)))
  }
  return perWeek
}

/**
 * Mueve una fila de la planilla dentro de su día, en todas las semanas del
 * bloque a la vez.
 *
 * Una fila no es un ejercicio planificado sino el mismo ejercicio repetido en
 * cada semana, así que moverlo en una sola dejaría la planilla descuadrada: la
 * fila saldría en un lugar distinto según la columna.
 */
export async function reorderSlotExercise(
  mesocycleId: string,
  slotIndex: number,
  exerciseId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const slotDays = await slotDaysOfBlock(mesocycleId)
  const days = slotDays.map((week) => week[slotIndex]).filter((d): d is Day => d !== undefined)
  if (days.length === 0) return

  // El orden de las filas lo fija el `order` más bajo que tenga el ejercicio en
  // cualquiera de las semanas, que es como lo lee la planilla.
  const peByDay = new Map<string, PlannedExercise[]>()
  const lowestOrder = new Map<string, number>()
  for (const day of days) {
    const list = await listPlannedExercises(day.id)
    peByDay.set(day.id, list)
    for (const pe of list) {
      const current = lowestOrder.get(pe.exerciseId)
      if (current === undefined || pe.order < current) lowestOrder.set(pe.exerciseId, pe.order)
    }
  }
  const ordered = [...lowestOrder.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id)
  const next = moveInOrder(ordered, exerciseId, direction)
  if (next === ordered) return

  const rank = new Map(next.map((id, index) => [id, index]))
  const timestamp = nowIso()
  for (const list of peByDay.values()) {
    for (const pe of list) {
      const order = rank.get(pe.exerciseId)
      if (order === undefined || order === pe.order) continue
      const { error } = await client()
        .from('training_planned_exercises')
        .update({ order, updatedAt: timestamp })
        .eq('id', pe.id)
      if (error) throw new Error(error.message)
    }
  }
}

export interface MoveExerciseResult {
  /** En cuántas semanas se movió de verdad. */
  moved: number
  /** Semanas que no tienen el día de destino, o que ya tenían ese ejercicio allí. */
  skipped: number
}

/**
 * Mueve una fila entera de una posición de día a otra, en todas las semanas.
 *
 * Las series se van con el ejercicio sin tocarlas: cuelgan del ejercicio
 * planificado, y lo que cambia es a qué día apunta.
 */
export async function moveSlotExerciseToSlot(
  mesocycleId: string,
  fromSlotIndex: number,
  toSlotIndex: number,
  exerciseId: string,
): Promise<MoveExerciseResult> {
  if (fromSlotIndex === toSlotIndex) return { moved: 0, skipped: 0 }
  const slotDays = await slotDaysOfBlock(mesocycleId)
  const timestamp = nowIso()
  let moved = 0
  let skipped = 0

  for (const week of slotDays) {
    const from = week[fromSlotIndex]
    const to = week[toSlotIndex]
    if (!from || !to) {
      if (from) skipped += 1
      continue
    }
    const source = (await listPlannedExercises(from.id)).find(
      (pe) => pe.exerciseId === exerciseId,
    )
    if (!source) continue
    const targets = await listPlannedExercises(to.id)
    // Ya está en el día de destino: moverlo dejaría dos filas del mismo
    // ejercicio en el mismo día, que la planilla no sabe distinguir.
    if (targets.some((pe) => pe.exerciseId === exerciseId)) {
      skipped += 1
      continue
    }
    const nextOrder = targets.length
      ? Math.max(...targets.map((pe) => pe.order)) + 1
      : 0
    const { error } = await client()
      .from('training_planned_exercises')
      .update({ dayId: to.id, order: nextOrder, updatedAt: timestamp })
      .eq('id', source.id)
    if (error) throw new Error(error.message)
    moved += 1
  }

  return { moved, skipped }
}

/**
 * Marca de un tirón todas las series de una fila de la planilla: el mismo
 * ejercicio en todas las semanas del bloque.
 *
 * Es un atajo, no otro nivel de marca: escribe en cada serie, que es donde
 * vive el dato. Sirve para un día técnico entero, donde ir serie por serie
 * serían doce toques para decir una sola cosa.
 */
export async function setSlotExerciseCounts(
  mesocycleId: string,
  slotIndex: number,
  exerciseId: string,
  counts: boolean,
): Promise<void> {
  const slotDays = await slotDaysOfBlock(mesocycleId)
  const timestamp = nowIso()
  for (const week of slotDays) {
    const day = week[slotIndex]
    if (!day) continue
    for (const pe of await listPlannedExercises(day.id)) {
      if (pe.exerciseId !== exerciseId) continue
      for (const set of await listPlannedSets(pe.id)) {
        const { error } = await client()
          .from('training_planned_sets')
          .update({ countsAsEffective: counts, updatedAt: timestamp })
          .eq('id', set.id)
        if (error) throw new Error(error.message)
      }
    }
  }
}

export interface RemoveExerciseResult {
  /** En cuántas semanas se quitó. */
  removed: number
  /** Semanas que se dejaron como estaban por tener la sesión ya finalizada. */
  skipped: number
}

/**
 * Quita una fila entera de la planilla: el ejercicio en todas las semanas de
 * esa posición de día.
 *
 * Un día con la sesión finalizada se salta. Borrarle el plan a algo que ya se
 * entrenó no arregla nada y sí pierde con qué se comparó lo que se hizo, que
 * es justo lo que la planilla enseña en esa celda.
 */
export async function removeSlotExercise(
  mesocycleId: string,
  slotIndex: number,
  exerciseId: string,
): Promise<RemoveExerciseResult> {
  const slotDays = await slotDaysOfBlock(mesocycleId)
  let removed = 0
  let skipped = 0

  for (const week of slotDays) {
    const day = week[slotIndex]
    if (!day) continue
    const target = (await listPlannedExercises(day.id)).find(
      (pe) => pe.exerciseId === exerciseId,
    )
    if (!target) continue
    const session = await getSessionForDay(day.id)
    if (session && session.endedAt !== null) {
      skipped += 1
      continue
    }
    await deletePlannedExercise(target.id)
    removed += 1
  }

  return { removed, skipped }
}

export interface CopyPreviousWeekResult {
  /** Ejercicios que se trajeron, con sus series. */
  copied: number
  /** Los que la semana ya tenía planificados y quedaron como estaban. */
  kept: number
  /** Días que no se tocaron: la semana no los tiene, o ya se entrenaron. */
  skippedDays: number
}

/**
 * Trae a una semana lo planificado en la anterior del mismo bloque: cada
 * ejercicio que le falte, con sus series tal como estaban.
 *
 * Es como se planifica de verdad un mesociclo —la semana 3 es la 2 con un poco
 * más de peso—, así que partir de cero cada semana es reescribir a mano algo
 * que ya estaba decidido, y es donde se cuelan los errores.
 *
 * Nunca pisa lo que la semana de destino ya tenga: un ejercicio que ya está
 * planificado se deja como está y se informa. Traer no es reemplazar, y
 * después de ajustar el peso de una celda la copia no puede deshacerlo.
 *
 * Con `slotIndex` viene sólo ese día; sin él, la semana entera.
 */
export async function copyPreviousWeekPlan(
  mesocycleId: string,
  weekIndex: number,
  slotIndex?: number,
): Promise<CopyPreviousWeekResult> {
  const empty = { copied: 0, kept: 0, skippedDays: 0 }
  // La primera semana no tiene anterior de la que traer.
  if (weekIndex <= 0) return empty

  const slotDays = await slotDaysOfBlock(mesocycleId)
  const sourceWeek = slotDays[weekIndex - 1]
  const targetWeek = slotDays[weekIndex]
  if (!sourceWeek || !targetWeek) return empty

  const slots =
    slotIndex === undefined
      ? Array.from({ length: Math.max(sourceWeek.length, targetWeek.length) }, (_, i) => i)
      : [slotIndex]

  let copied = 0
  let kept = 0
  let skippedDays = 0

  for (const index of slots) {
    const from = sourceWeek[index]
    const to = targetWeek[index]
    // Sin día de origen no hay nada que traer, y eso no es un día saltado.
    if (!from) continue
    if (!to) {
      skippedDays += 1
      continue
    }
    // Un día ya entrenado se salta: cambiarle el plan no cambia lo que se hizo
    // y sí rompe la comparación que la planilla enseña en esa celda.
    const session = await getSessionForDay(to.id)
    if (session && session.endedAt !== null) {
      skippedDays += 1
      continue
    }

    const existing = await listPlannedExercises(to.id)
    for (const source of await listPlannedExercises(from.id)) {
      if (existing.some((pe) => pe.exerciseId === source.exerciseId)) {
        kept += 1
        continue
      }
      await copyPlannedExerciseTo(source, to.id)
      copied += 1
    }
  }

  return { copied, kept, skippedDays }
}
