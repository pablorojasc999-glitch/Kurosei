import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { BODY_REGION_LABELS, matchBodyRegion } from '../lib/bodyMap'
import {
  validateMuscleContributions,
  type ContributionInput,
} from '../domain/muscleContribution'
import type {
  Exercise,
  ExerciseCategory,
  ExerciseMuscleContribution,
  ExerciseType,
  MuscleGroup,
} from '../domain/types'

/**
 * Ya no pasa por Dexie: habla directo con Supabase. `training_muscle_groups`,
 * `training_exercises` y `training_exercise_muscle_contributions` son la
 * biblioteca compartida (ver #103): sus lecturas no filtran por dueño, la
 * política RLS ya decide quién ve qué.
 */
function client() {
  if (!supabase) throw new Error('La biblioteca de ejercicios necesita conexión para funcionar.')
  return supabase
}

export async function listMuscleGroups(): Promise<MuscleGroup[]> {
  const { data, error } = await client()
    .from('training_muscle_groups')
    .select('*')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as MuscleGroup[]).sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export async function createMuscleGroup(name: string): Promise<MuscleGroup> {
  const existing = await listMuscleGroups()
  if (existing.some((g) => normalizeName(g.name) === normalizeName(name))) {
    throw new Error(`Ya existe un grupo muscular llamado "${name}".`)
  }

  const timestamp = nowIso()
  const muscleGroup: MuscleGroup = {
    id: generateId(),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('training_muscle_groups').insert({ ...muscleGroup, userId })
  if (error) throw new Error(error.message)
  return muscleGroup
}

/**
 * Ensures every body-map region (Pecho, Espalda, Tríceps, ...) has a
 * matching muscle group row, reusing an existing one whose name aliases to
 * that region instead of creating a duplicate. Returns them in body-map
 * order, ready to drive the exercise form's contribution rows.
 */
export async function ensureCanonicalMuscleGroups(): Promise<MuscleGroup[]> {
  const existing = await listMuscleGroups()
  const byRegion = new Map(
    existing
      .map((g) => [matchBodyRegion(g.name), g] as const)
      .filter((entry): entry is [NonNullable<(typeof entry)[0]>, MuscleGroup] =>
        entry[0] !== null,
      ),
  )

  const result: MuscleGroup[] = []
  for (const [region, label] of Object.entries(BODY_REGION_LABELS)) {
    const found = byRegion.get(region as keyof typeof BODY_REGION_LABELS)
    result.push(found ?? (await createMuscleGroup(label)))
  }
  return result
}

export async function listExercises(): Promise<Exercise[]> {
  const { data, error } = await client().from('training_exercises').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Exercise[]).sort((a, b) => a.name.localeCompare(b.name))
}

/** Todas las contribuciones musculares no borradas — para cruces con otras tablas (ver ExercisePicker/SessionSummary/BlockGrid). */
export async function listAllMuscleContributions(): Promise<ExerciseMuscleContribution[]> {
  const { data, error } = await client()
    .from('training_exercise_muscle_contributions')
    .select('*')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as ExerciseMuscleContribution[]
}

export async function listContributionsForExercise(
  exerciseId: string,
): Promise<ContributionInput[]> {
  const { data, error } = await client()
    .from('training_exercise_muscle_contributions')
    .select('*')
    .eq('exerciseId', exerciseId)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as Array<{ muscleGroupId: string; factor: number }>).map((r) => ({
    muscleGroupId: r.muscleGroupId,
    factor: r.factor,
  }))
}

export interface CreateExerciseInput {
  name: string
  type: ExerciseType
  category: ExerciseCategory | null
  muscleContributions: ContributionInput[]
}

export async function createExercise(
  input: CreateExerciseInput,
): Promise<Exercise> {
  const validation = validateMuscleContributions(
    input.type,
    input.muscleContributions,
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const existing = await listExercises()
  if (existing.some((e) => normalizeName(e.name) === normalizeName(input.name))) {
    throw new Error(`Ya existe un ejercicio llamado "${input.name}".`)
  }

  const timestamp = nowIso()
  const exercise: Exercise = {
    id: generateId(),
    name: input.name,
    type: input.type,
    category: input.category,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }

  const userId = await requireUserId()
  const { error } = await client().from('training_exercises').insert({ ...exercise, userId })
  if (error) throw new Error(error.message)

  if (input.muscleContributions.length > 0) {
    const { error: contribError } = await client()
      .from('training_exercise_muscle_contributions')
      .insert(
        input.muscleContributions.map((c) => ({
          id: generateId(),
          exerciseId: exercise.id,
          muscleGroupId: c.muscleGroupId,
          factor: c.factor,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          userId,
        })),
      )
    if (contribError) throw new Error(contribError.message)
  }

  return exercise
}

export interface UpdateExerciseInput {
  name: string
  type: ExerciseType
  category: ExerciseCategory | null
  muscleContributions: ContributionInput[]
}

export async function updateExercise(
  exerciseId: string,
  input: UpdateExerciseInput,
): Promise<void> {
  const validation = validateMuscleContributions(
    input.type,
    input.muscleContributions,
  )
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const existing = await listExercises()
  if (
    existing.some(
      (e) => e.id !== exerciseId && normalizeName(e.name) === normalizeName(input.name),
    )
  ) {
    throw new Error(`Ya existe un ejercicio llamado "${input.name}".`)
  }

  const timestamp = nowIso()

  const { error } = await client()
    .from('training_exercises')
    .update({
      name: input.name,
      type: input.type,
      category: input.category,
      updatedAt: timestamp,
    })
    .eq('id', exerciseId)
  if (error) throw new Error(error.message)

  const { data: oldContributions, error: listError } = await client()
    .from('training_exercise_muscle_contributions')
    .select('id')
    .eq('exerciseId', exerciseId)
    .is('deletedAt', null)
  if (listError) throw new Error(listError.message)

  for (const { id } of oldContributions as Array<{ id: string }>) {
    const { error: deleteError } = await client()
      .from('training_exercise_muscle_contributions')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', id)
    if (deleteError) throw new Error(deleteError.message)
  }

  if (input.muscleContributions.length > 0) {
    const userId = await requireUserId()
    const { error: contribError } = await client()
      .from('training_exercise_muscle_contributions')
      .insert(
        input.muscleContributions.map((c) => ({
          id: generateId(),
          exerciseId,
          muscleGroupId: c.muscleGroupId,
          factor: c.factor,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          userId,
        })),
      )
    if (contribError) throw new Error(contribError.message)
  }
}

export async function softDeleteExercise(exerciseId: string): Promise<void> {
  const timestamp = nowIso()
  const { error } = await client()
    .from('training_exercises')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', exerciseId)
  if (error) throw new Error(error.message)
}
