import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '../../../shared/db/database'
import { pullTable, pushTable, syncNow } from './syncEngine'
import {
  createExercise,
  createMuscleGroup,
  softDeleteExercise,
} from '../../training/db/trainingRepository'

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () =>
    Promise.all(db.tables.map((table) => table.clear())),
  )
  localStorage.clear()
})

interface FakeRow {
  id: string
  userId: string
  updatedAt: string
  [key: string]: unknown
}

/**
 * Imita a Supabase en lo que importa acá: el servidor pone `syncedAt` al
 * recibir cada fila, con su propio reloj, y el filtro de bajada va por la
 * columna que se le pida.
 */
function createFakeSupabaseClient(
  seed: FakeRow[] = [],
  errorMessage: string | null = null,
  clockBase = '2026-01-01T00:00:00.000Z',
) {
  // Un reloj de servidor que sólo avanza, para no depender del reloj real.
  let serverClock = Date.parse(clockBase)
  const stamp = () => {
    serverClock += 1000
    return new Date(serverClock).toISOString()
  }
  // Lo sembrado ya está en el servidor, así que ya tiene su marca de llegada.
  const store: FakeRow[] = seed.map((row) => ({ ...row, syncedAt: stamp() }))

  const client = {
    from(_tableName: string) {
      return {
        upsert(rows: FakeRow[]) {
          if (errorMessage) {
            return Promise.resolve({ error: { message: errorMessage } })
          }
          for (const row of rows) {
            const stored = { ...row, syncedAt: stamp() }
            const idx = store.findIndex((r) => r.id === row.id)
            if (idx >= 0) store[idx] = stored
            else store.push(stored)
          }
          return Promise.resolve({ error: null })
        },
        select(_cols: string) {
          let userId: string | undefined
          const builder = {
            eq(_col: string, value: string) {
              userId = value
              return builder
            },
            gt(col: string, since: string) {
              if (errorMessage) {
                return Promise.resolve({ data: null, error: { message: errorMessage } })
              }
              return Promise.resolve({
                data: store.filter(
                  (r) => r.userId === userId && String(r[col] ?? '') > since,
                ),
                error: null,
              })
            },
          }
          return builder
        },
      }
    },
  }

  return { client: client as unknown as SupabaseClient, store }
}

const USER_ID = 'user-1'
const EPOCH = '1970-01-01T00:00:00.000Z'

describe('pushTable', () => {
  it('upserts local rows changed since the cutoff, attaching userId', async () => {
    const group = await createMuscleGroup('Pecho')
    const { client, store } = createFakeSupabaseClient()

    await pushTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    expect(store).toHaveLength(1)
    expect(store[0]).toMatchObject({
      id: group.id,
      userId: USER_ID,
      name: 'Pecho',
    })
  })

  it('does not push rows older than the cutoff', async () => {
    const group = await createMuscleGroup('Pecho')
    const { client, store } = createFakeSupabaseClient()

    // cutoff after the row's updatedAt -> nothing to push
    const future = new Date(
      new Date(group.updatedAt).getTime() + 1000,
    ).toISOString()
    await pushTable(client, 'training_muscle_groups', USER_ID, future)

    expect(store).toHaveLength(0)
  })

  it('throws a readable Error carrying the table name and Supabase message on failure', async () => {
    await createMuscleGroup('Pecho')
    const { client } = createFakeSupabaseClient([], 'column "factor" does not exist')

    await expect(
      pushTable(client, 'training_muscle_groups', USER_ID, EPOCH),
    ).rejects.toThrow('training_muscle_groups: column "factor" does not exist')
  })

  it('pushes a soft-delete as an update (a delete must bump updatedAt or it never syncs)', async () => {
    const exercise = await createExercise({
      name: 'Bicicleta',
      type: 'cardio',
      category: null,
      muscleContributions: [],
    })
    const { client, store } = createFakeSupabaseClient()

    // Sync once right after creation, as a real client would before deleting.
    await pushTable(client, 'training_exercises', USER_ID, EPOCH)
    const afterCreate = store[0].updatedAt

    await softDeleteExercise(exercise.id)
    await pushTable(client, 'training_exercises', USER_ID, afterCreate)

    expect(store).toHaveLength(1)
    expect(store[0].deletedAt).not.toBeNull()
  })
})

describe('pullTable', () => {
  it('writes a remote row into Dexie when there is no local copy', async () => {
    const remoteRow = {
      id: 'remote-id-1',
      userId: USER_ID,
      name: 'Espalda',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    }
    const { client } = createFakeSupabaseClient([remoteRow])

    await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    const local = await db.training_muscle_groups.get('remote-id-1')
    expect(local).toMatchObject({ name: 'Espalda' })
    // the sync-only userId field never lands in the local record
    expect(local).not.toHaveProperty('userId')
  })

  it('overwrites the local row when the remote one is newer', async () => {
    const group = await createMuscleGroup('Pecho')
    const newerRemote = {
      ...group,
      userId: USER_ID,
      name: 'Pecho (renombrado)',
      updatedAt: new Date(
        new Date(group.updatedAt).getTime() + 1000,
      ).toISOString(),
    }
    const { client } = createFakeSupabaseClient([newerRemote])

    await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    const local = await db.training_muscle_groups.get(group.id)
    expect(local?.name).toBe('Pecho (renombrado)')
  })

  it('keeps the local row when it is newer than the remote one (last-write-wins)', async () => {
    const group = await createMuscleGroup('Pecho')
    const olderRemote = {
      ...group,
      userId: USER_ID,
      name: 'Nombre viejo del servidor',
      updatedAt: new Date(
        new Date(group.updatedAt).getTime() - 1000,
      ).toISOString(),
    }
    const { client } = createFakeSupabaseClient([olderRemote])

    await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    const local = await db.training_muscle_groups.get(group.id)
    expect(local?.name).toBe('Pecho')
  })

  it('baja una fila anotada antes del corte pero subida después', async () => {
    // El caso que rompía: el teléfono anota a las 13:42 y sube a las 14:10; el
    // computador sincronizó a las 14:00, así que su corte ya iba por las 14:00.
    // Filtrando por `updatedAt` (13:42) esa fila no bajaba nunca más.
    const remoteRow = {
      id: 'del-telefono',
      userId: USER_ID,
      name: 'Anotado en el teléfono',
      createdAt: '2026-09-25T13:42:00.000Z',
      updatedAt: '2026-09-25T13:42:00.000Z',
      deletedAt: null,
    }
    // El servidor la recibe a las 14:10, casi media hora después de anotarla.
    const { client } = createFakeSupabaseClient([remoteRow], null, '2026-09-25T14:10:00.000Z')

    // El corte del computador va por las 14:00: después de que se anotó la
    // fila, antes de que llegara al servidor. Filtrando por `updatedAt` no
    // pasa; filtrando por `syncedAt`, sí.
    const corte = '2026-09-25T14:00:00.000Z'
    await pullTable(client, 'training_muscle_groups', USER_ID, corte)

    const local = await db.training_muscle_groups.get('del-telefono')
    expect(local).toMatchObject({ name: 'Anotado en el teléfono' })
  })

  it('devuelve el syncedAt más alto que vio, no la fecha en que se escribió', async () => {
    const filas = ['a', 'b'].map((id, i) => ({
      id,
      userId: USER_ID,
      name: id,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: `2020-01-0${i + 1}T00:00:00.000Z`,
      deletedAt: null,
    }))
    const { client, store } = createFakeSupabaseClient(filas)

    const hasta = await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    expect(hasta).toBe(store[store.length - 1].syncedAt)
  })

  it('sin nada nuevo devuelve null, para no mover el corte', async () => {
    const { client } = createFakeSupabaseClient([])
    expect(await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)).toBeNull()
  })

  it('no guarda el syncedAt del servidor en la fila local', async () => {
    const remoteRow = {
      id: 'remota',
      userId: USER_ID,
      name: 'Espalda',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    }
    const { client } = createFakeSupabaseClient([remoteRow])

    await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    const local = await db.training_muscle_groups.get('remota')
    // Si se guardara, se devolvería al subir una marca que sólo pone el servidor.
    expect(local).not.toHaveProperty('syncedAt')
  })

  it('compara por instante y no por texto al decidir cuál gana', async () => {
    // Postgres devuelve `.26+00:00` donde toISOString() da `.260Z`: el mismo
    // instante escrito distinto, que comparado como texto se invierte.
    const group = await createMuscleGroup('Pecho')
    const mismoInstante = new Date(group.updatedAt).toISOString().replace(/\.(\d)00Z$/, '.$1+00:00')
    const remoto = {
      ...group,
      userId: USER_ID,
      name: 'No debería pisar',
      updatedAt: mismoInstante,
    }
    const { client } = createFakeSupabaseClient([remoto])

    await pullTable(client, 'training_muscle_groups', USER_ID, EPOCH)

    const local = await db.training_muscle_groups.get(group.id)
    expect(local?.name).toBe('Pecho')
  })

  it('throws a readable Error carrying the table name and Supabase message on failure', async () => {
    const { client } = createFakeSupabaseClient([], 'permission denied for table')

    await expect(
      pullTable(client, 'training_muscle_groups', USER_ID, EPOCH),
    ).rejects.toThrow('training_muscle_groups: permission denied for table')
  })
})

describe('syncNow', () => {
  it('throws when Supabase is not configured', async () => {
    await expect(syncNow(USER_ID)).rejects.toThrow(
      'La sincronización no está configurada.',
    )
  })
})
