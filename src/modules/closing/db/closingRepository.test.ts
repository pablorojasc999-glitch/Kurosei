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

const { closeDay, firstClosureDate, listClosuresForDate, listClosuresInRange, reopenDay } =
  await import('./closingRepository')

beforeEach(() => {
  fake.tables.day_closures = []
})

describe('closeDay / reopenDay', () => {
  it('creates a closure on first close', async () => {
    const closure = await closeDay('2026-08-22', 'training', 'done')
    expect(closure).toMatchObject({ date: '2026-08-22', module: 'training', kind: 'done' })
    expect(await listClosuresForDate('2026-08-22')).toHaveLength(1)
  })

  it('updates the same closure in place instead of creating a second one for the same (date, module)', async () => {
    const first = await closeDay('2026-08-22', 'training', 'done')
    const updated = await closeDay('2026-08-22', 'training', 'none')

    expect(updated.id).toBe(first.id)
    expect(updated.kind).toBe('none')
    expect(await listClosuresForDate('2026-08-22')).toHaveLength(1)
  })

  it('reopening removes the closure for that (date, module), leaving the others untouched', async () => {
    await closeDay('2026-08-22', 'training', 'done')
    await closeDay('2026-08-22', 'nutrition', 'done')

    await reopenDay('2026-08-22', 'training')

    const remaining = await listClosuresForDate('2026-08-22')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].module).toBe('nutrition')
  })

  it('reopening a day with no closure is a no-op', async () => {
    await expect(reopenDay('2026-08-22', 'training')).resolves.toBeUndefined()
  })
})

describe('listClosuresInRange / firstClosureDate', () => {
  it('returns only the closures within the range, inclusive', async () => {
    await closeDay('2026-08-20', 'training', 'done')
    await closeDay('2026-08-22', 'training', 'done')
    await closeDay('2026-08-25', 'training', 'done')

    const result = await listClosuresInRange('2026-08-21', '2026-08-24')
    expect(result.map((c) => c.date)).toEqual(['2026-08-22'])
  })

  it('is null until something is closed, then the earliest closed date', async () => {
    expect(await firstClosureDate()).toBeNull()

    await closeDay('2026-08-22', 'training', 'done')
    await closeDay('2026-08-20', 'nutrition', 'done')

    expect(await firstClosureDate()).toBe('2026-08-20')
  })
})
