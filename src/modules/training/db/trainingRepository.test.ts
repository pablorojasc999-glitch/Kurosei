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

const {
  createExercise,
  createMuscleGroup,
  ensureCanonicalMuscleGroups,
  listContributionsForExercise,
  updateExercise,
} = await import('./trainingRepository')

beforeEach(() => {
  fake.tables.training_muscle_groups = []
  fake.tables.training_exercises = []
  fake.tables.training_exercise_muscle_contributions = []
})

describe('createMuscleGroup', () => {
  it('rejects a duplicate name, case- and whitespace-insensitive', async () => {
    await createMuscleGroup('Pecho')
    await expect(createMuscleGroup('  pecho ')).rejects.toThrow(/ya existe/i)
  })
})

describe('ensureCanonicalMuscleGroups', () => {
  it('creates the 14 body-map regions when none exist yet', async () => {
    const groups = await ensureCanonicalMuscleGroups()
    expect(groups.map((g) => g.name)).toEqual([
      'Pecho',
      'Espalda',
      'Lumbar',
      'Tríceps',
      'Bíceps',
      'Hombro',
      'Abdomen',
      'Cadera',
      'Cuádriceps',
      'Aductores',
      'Glúteos',
      'Isquios',
      'Gemelo',
      'Antebrazos',
    ])
  })

  it('reuses an existing group that already aliases to a region instead of duplicating it', async () => {
    const chest = await createMuscleGroup('pecho')
    const groups = await ensureCanonicalMuscleGroups()
    expect(groups.find((g) => g.name === 'pecho')).toMatchObject({ id: chest.id })
    expect(groups).toHaveLength(14)
  })

  it('is idempotent across repeated calls', async () => {
    const first = await ensureCanonicalMuscleGroups()
    const second = await ensureCanonicalMuscleGroups()
    expect(second.map((g) => g.id)).toEqual(first.map((g) => g.id))
  })
})

describe('createExercise', () => {
  it('rejects a duplicate name, case- and whitespace-insensitive', async () => {
    const chest = await createMuscleGroup('Pecho')
    const input = {
      type: 'strength' as const,
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    }
    await createExercise({ ...input, name: 'Press banca' })
    await expect(
      createExercise({ ...input, name: '  press BANCA  ' }),
    ).rejects.toThrow(/ya existe/i)
  })

  it('allows distinct exercise names', async () => {
    const chest = await createMuscleGroup('Pecho')
    const input = {
      type: 'strength' as const,
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    }
    await createExercise({ ...input, name: 'Press banca' })
    await expect(
      createExercise({ ...input, name: 'Press militar' }),
    ).resolves.toMatchObject({ name: 'Press militar' })
  })
})

describe('updateExercise', () => {
  it('renames the exercise and replaces its muscle contributions', async () => {
    const chest = await createMuscleGroup('Pecho')
    const triceps = await createMuscleGroup('Tríceps')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: 'bench',
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })

    await updateExercise(exercise.id, {
      name: 'Press banca inclinado',
      type: 'strength',
      category: 'bench',
      muscleContributions: [
        { muscleGroupId: chest.id, factor: 0.75 },
        { muscleGroupId: triceps.id, factor: 0.5 },
      ],
    })

    const updated = fake.tables.training_exercises.find((e) => e.id === exercise.id)
    expect(updated?.name).toBe('Press banca inclinado')

    const contributions = await listContributionsForExercise(exercise.id)
    expect(contributions).toHaveLength(2)
    expect(contributions).toEqual(
      expect.arrayContaining([
        { muscleGroupId: chest.id, factor: 0.75 },
        { muscleGroupId: triceps.id, factor: 0.5 },
      ]),
    )
  })

  it('rejects renaming to a name already used by another exercise', async () => {
    const chest = await createMuscleGroup('Pecho')
    const input = {
      type: 'strength' as const,
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    }
    await createExercise({ ...input, name: 'Press banca' })
    const other = await createExercise({ ...input, name: 'Press militar' })

    await expect(
      updateExercise(other.id, { ...input, name: '  press BANCA  ' }),
    ).rejects.toThrow(/ya existe/i)
  })

  it('allows keeping the exercise\'s own name unchanged', async () => {
    const chest = await createMuscleGroup('Pecho')
    const exercise = await createExercise({
      name: 'Press banca',
      type: 'strength',
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, factor: 1 }],
    })

    await expect(
      updateExercise(exercise.id, {
        name: 'Press banca',
        type: 'strength',
        category: null,
        muscleContributions: [{ muscleGroupId: chest.id, factor: 2 }],
      }),
    ).resolves.toBeUndefined()
  })
})
