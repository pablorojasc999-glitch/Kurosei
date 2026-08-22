import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import { createExercise, createMuscleGroup } from './trainingRepository'

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

describe('createExercise', () => {
  it('rejects a duplicate name, case- and whitespace-insensitive', async () => {
    const chest = await createMuscleGroup('Pecho')
    const input = {
      type: 'strength' as const,
      category: null,
      muscleContributions: [{ muscleGroupId: chest.id, percentage: 100 }],
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
      muscleContributions: [{ muscleGroupId: chest.id, percentage: 100 }],
    }
    await createExercise({ ...input, name: 'Press banca' })
    await expect(
      createExercise({ ...input, name: 'Press militar' }),
    ).resolves.toMatchObject({ name: 'Press militar' })
  })
})
