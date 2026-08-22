import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import {
  validateMuscleContributions,
  type ContributionInput,
} from '../domain/muscleContribution'
import type {
  Exercise,
  ExerciseCategory,
  ExerciseType,
  MuscleGroup,
} from '../domain/types'

export async function listMuscleGroups(): Promise<MuscleGroup[]> {
  return db.training_muscle_groups
    .filter((g) => g.deletedAt === null)
    .sortBy('name')
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
  await db.training_muscle_groups.add(muscleGroup)
  return muscleGroup
}

export async function listExercises(): Promise<Exercise[]> {
  return db.training_exercises.filter((e) => e.deletedAt === null).sortBy('name')
}

export async function listContributionsForExercise(
  exerciseId: string,
): Promise<ContributionInput[]> {
  const rows = await db.training_exercise_muscle_contributions
    .where('exerciseId')
    .equals(exerciseId)
    .filter((c) => c.deletedAt === null)
    .toArray()
  return rows.map((r) => ({
    muscleGroupId: r.muscleGroupId,
    percentage: r.percentage,
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

  await db.transaction(
    'rw',
    db.training_exercises,
    db.training_exercise_muscle_contributions,
    async () => {
      await db.training_exercises.add(exercise)
      await db.training_exercise_muscle_contributions.bulkAdd(
        input.muscleContributions.map((c) => ({
          id: generateId(),
          exerciseId: exercise.id,
          muscleGroupId: c.muscleGroupId,
          percentage: c.percentage,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        })),
      )
    },
  )

  return exercise
}

export async function softDeleteExercise(exerciseId: string): Promise<void> {
  await db.training_exercises.update(exerciseId, { deletedAt: nowIso() })
}
