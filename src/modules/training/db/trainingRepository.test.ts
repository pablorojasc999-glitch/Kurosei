import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  createExercise,
  createMuscleGroup,
  ensureCanonicalMuscleGroups,
} from './trainingRepository'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.tables,
    async () => Promise.all(db.tables.map((table) => table.clear())),
  )
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
