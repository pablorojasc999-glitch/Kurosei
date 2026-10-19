import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { deleteCardioSession, listCardioSessions } from './cardioRepository'
import { deleteSession, getSessionForDay } from './executionRepository'
import { countsAsEffective } from '../lib/effectiveSets'
import { compareWeeks } from '../lib/weeks'
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

/** Todos los mesociclos, de cualquier macrociclo — para cruces como la exportación. */
export async function listAllMesocycles(): Promise<Mesocycle[]> {
  const { data, error } = await client().from('training_mesocycles').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as Mesocycle[]
}

/** Todos los ejercicios planificados no borrados — para cruces como la exportación. */
export async function listAllPlannedExercises(): Promise<PlannedExercise[]> {
  const { data, error } = await client()
    .from('training_planned_exercises')
    .select('*')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as PlannedExercise[]
}

/** Todas las series planificadas no borradas — para cruces como la exportación. */
export async function listAllPlannedSets(): Promise<PlannedSet[]> {
  const { data, error } = await client().from('training_planned_sets').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as PlannedSet[]
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

/** Las semanas enlazadas a un mesociclo, por fecha de inicio. */
export async function listWeeks(mesocycleId: string): Promise<Week[]> {
  const { data, error } = await client()
    .from('training_weeks')
    .select('*')
    .eq('mesocycleId', mesocycleId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Week[]).sort(compareWeeks)
}

/** Todas las semanas, enlazadas o no, por fecha de inicio. */
export async function listAllWeeks(): Promise<Week[]> {
  const { data, error } = await client().from('training_weeks').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Week[]).sort(compareWeeks)
}

export interface WeekInput {
  mesocycleId: string | null
  /** `YYYY-MM-DD`. */
  startDate: string
  /** `YYYY-MM-DD`, inclusive. */
  endDate: string
}

export async function createWeek(input: WeekInput): Promise<Week> {
  const siblings = await listAllWeeks()
  const nextOrder = siblings.length ? Math.max(...siblings.map((w) => w.order)) + 1 : 0
  const timestamp = nowIso()
  const week: Week = {
    id: generateId(),
    ...input,
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

/**
 * Cambia el rango o el mesociclo de una semana. No toca sus días: mover una
 * semana de fechas no mueve lo planificado dentro, y enlazarla a otro mesociclo
 * tampoco.
 */
export async function updateWeek(id: string, input: WeekInput): Promise<void> {
  const { error } = await client()
    .from('training_weeks')
    .update({ ...input, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Enlaza una semana a un mesociclo, o la suelta con `null`. */
export async function setWeekMesocycle(id: string, mesocycleId: string | null): Promise<void> {
  const { error } = await client()
    .from('training_weeks')
    .update({ mesocycleId, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
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

/**
 * Borra un mesociclo y suelta sus semanas, que siguen existiendo con todo lo
 * planificado: son independientes, y el mesociclo sólo era una agrupación.
 */
export async function deleteMesocycle(id: string): Promise<void> {
  const weeks = await listWeeks(id)
  for (const week of weeks) {
    await setWeekMesocycle(week.id, null)
  }
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_mesocycles')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Borra un macrociclo y sus mesociclos (las semanas quedan sueltas, ver deleteMesocycle). */
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

/**
 * Edita sólo la nota de un ejercicio planificado, sin tocar sus series.
 *
 * La nota se copia a la sesión al cargar el plan (ver `addSessionExercise` en
 * `SessionView.tsx`), así que queda visible al registrar el entrenamiento —
 * ahí de sólo lectura, porque editarla desde la sesión cambiaría el plan en
 * vez de anotar algo sobre lo ejecutado.
 */
export async function updatePlannedExerciseNotes(id: string, notes: string): Promise<void> {
  const { error } = await client()
    .from('training_planned_exercises')
    .update({ notes, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
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

/** Una serie del plan, tal como se copia a otro ejercicio. */
export interface PlannedSetInput {
  targetWeightKg: number | null
  targetReps: number
  targetRpe: number | null
  restSecondsTarget: number | null
  /**
   * Opcionales a propósito: omitirlas deja la marca que ya tuviera la serie
   * en vez de borrarla sin que nadie la haya desmarcado.
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
 * Se conserva el `order` de origen en vez de recalcularlo: renumerar dejaría el día
 * copiado con los ejercicios en otro orden que el original.
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
 *
 * Se salta el que `targetDayId` ya tenga planificado para ese ejercicio: así
 * se puede llamar sobre un día que ya tiene su propio plan (Registro la usa
 * para traer el de otro día ya planificado a una sesión) sin duplicarlo, y
 * llamarla dos veces con el mismo origen no copia dos veces lo mismo.
 */
export async function copyPlannedExercisesToDay(
  sourceDayId: string,
  targetDayId: string,
): Promise<void> {
  const sourcePlannedExercises = await listPlannedExercises(sourceDayId)
  const alreadyPlanned = new Set(
    (await listPlannedExercises(targetDayId)).map((pe) => pe.exerciseId),
  )
  for (const sourcePe of sourcePlannedExercises) {
    if (alreadyPlanned.has(sourcePe.exerciseId)) continue
    await copyPlannedExerciseTo(sourcePe, targetDayId)
  }
}

/**
 * Duplica una semana como punto de partida para la siguiente: la copia queda
 * siete días después, en el mismo mesociclo, con sus días desplazados y todo lo
 * planificado copiado 1:1 para poder editarlo por separado.
 */
export async function duplicateWeek(sourceWeekId: string): Promise<Week> {
  const sourceWeek = await getWeekById(sourceWeekId)
  if (!sourceWeek) {
    throw new Error('Semana de origen no encontrada.')
  }

  const shift = (iso: string) => new Date(new Date(iso).getTime() + SEVEN_DAYS_MS).toISOString()
  const shiftKey = (key: string) => shift(`${key.slice(0, 10)}T12:00:00.000Z`).slice(0, 10)

  const sourceDays = await listDays(sourceWeekId)
  const newWeek = await createWeek({
    mesocycleId: sourceWeek.mesocycleId,
    startDate: shiftKey(sourceWeek.startDate),
    endDate: shiftKey(sourceWeek.endDate),
  })

  const newDays: Day[] = []
  for (const sourceDay of sourceDays) {
    const newDay = await createDay({
      weekId: newWeek.id,
      date: shift(sourceDay.date),
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
  /** `null` cuando la semana no está enlazada a ningún mesociclo. */
  macrocycleName: string | null
  mesocycleName: string | null
  startDate: string
  endDate: string
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
      const meso = w.mesocycleId ? mesoById.get(w.mesocycleId) : undefined
      const macro = meso ? macroById.get(meso.macrocycleId) : undefined
      return {
        id: w.id,
        macrocycleName: macro?.name ?? null,
        mesocycleName: meso?.name ?? null,
        startDate: w.startDate,
        endDate: w.endDate,
        dayDates: (dayDatesByWeek.get(w.id) ?? []).sort(),
      }
    })
    .sort((a, b) => a.startDate.slice(0, 10).localeCompare(b.startDate.slice(0, 10)))
}

export interface MesocycleWithContext {
  id: string
  macrocycleId: string
  macrocycleName: string
  name: string
  order: number
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
      macrocycleId: m.macrocycleId,
      macrocycleName: macroById.get(m.macrocycleId)?.name ?? '?',
      name: m.name,
      order: m.order,
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
