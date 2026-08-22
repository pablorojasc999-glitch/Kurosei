import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { db } from '../../../shared/db/database'
import { pullTable, pushTable, syncNow } from './syncEngine'
import { createMuscleGroup } from '../../training/db/trainingRepository'

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

function createFakeSupabaseClient(
  seed: FakeRow[] = [],
  errorMessage: string | null = null,
) {
  const store: FakeRow[] = [...seed]

  const client = {
    from(_tableName: string) {
      return {
        upsert(rows: FakeRow[]) {
          if (errorMessage) {
            return Promise.resolve({ error: { message: errorMessage } })
          }
          for (const row of rows) {
            const idx = store.findIndex((r) => r.id === row.id)
            if (idx >= 0) store[idx] = row
            else store.push(row)
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
            gt(_col: string, since: string) {
              if (errorMessage) {
                return Promise.resolve({ data: null, error: { message: errorMessage } })
              }
              return Promise.resolve({
                data: store.filter(
                  (r) => r.userId === userId && r.updatedAt > since,
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
