import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  createCategory,
  createTimeBlock,
  deleteCategory,
  deleteTimeBlock,
  ensureDefaultCategories,
  listCategories,
  listTimeBlocksForDate,
  reorderCategory,
  updateCategory,
  updateTimeBlock,
} from './organizationRepository'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.tables,
    async () => Promise.all(db.tables.map((table) => table.clear())),
  )
})

describe('ensureDefaultCategories', () => {
  it('seeds the four default categories when none exist', async () => {
    await ensureDefaultCategories()
    const categories = await listCategories()
    expect(categories.map((c) => c.name)).toEqual([
      'Trabajo',
      'Gimnasio',
      'Comer',
      'Dormir',
    ])
  })

  it('does nothing if a category already exists', async () => {
    await createCategory({ name: 'Custom', color: '#fff', emoji: '✨' })
    await ensureDefaultCategories()
    const categories = await listCategories()
    expect(categories).toHaveLength(1)
    expect(categories[0].name).toBe('Custom')
  })

  it('does not double-seed when two callers race on mount', async () => {
    await Promise.all([ensureDefaultCategories(), ensureDefaultCategories()])
    const categories = await listCategories()
    expect(categories).toHaveLength(4)
  })
})

describe('category CRUD', () => {
  it('creates categories in incrementing order', async () => {
    const a = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    const b = await createCategory({ name: 'B', color: '#222', emoji: '🅱️' })
    expect(a.order).toBe(0)
    expect(b.order).toBe(1)
  })

  it('updates a category in place', async () => {
    const a = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    await updateCategory(a.id, { name: 'Renamed', color: '#222', emoji: '🆕' })
    const [updated] = await listCategories()
    expect(updated.name).toBe('Renamed')
    expect(updated.color).toBe('#222')
  })

  it('reorders by swapping with the neighbor', async () => {
    const a = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    const b = await createCategory({ name: 'B', color: '#222', emoji: '🅱️' })
    await reorderCategory(b.id, 'up')
    const categories = await listCategories()
    expect(categories.map((c) => c.id)).toEqual([b.id, a.id])
  })

  it('is a no-op reordering past either end', async () => {
    const a = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    await reorderCategory(a.id, 'up')
    const categories = await listCategories()
    expect(categories.map((c) => c.id)).toEqual([a.id])
  })

  it('deletes a category and cascades to its time blocks', async () => {
    const a = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    const block = await createTimeBlock({
      categoryId: a.id,
      date: '2026-08-23',
      startMinutes: 60,
      endMinutes: 120,
      title: 'Test',
      notes: '',
    })
    await deleteCategory(a.id)
    expect(await listCategories()).toHaveLength(0)
    expect(await listTimeBlocksForDate('2026-08-23')).toHaveLength(0)
    expect((await db.org_time_blocks.get(block.id))?.deletedAt).not.toBeNull()
  })
})

describe('time block CRUD', () => {
  it('creates and lists blocks for a date sorted by start time', async () => {
    const category = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    await createTimeBlock({
      categoryId: category.id,
      date: '2026-08-23',
      startMinutes: 540,
      endMinutes: 600,
      title: 'Segundo',
      notes: '',
    })
    await createTimeBlock({
      categoryId: category.id,
      date: '2026-08-23',
      startMinutes: 60,
      endMinutes: 120,
      title: 'Primero',
      notes: '',
    })
    const blocks = await listTimeBlocksForDate('2026-08-23')
    expect(blocks.map((b) => b.title)).toEqual(['Primero', 'Segundo'])
  })

  it('rejects an end time at or before the start time', async () => {
    const category = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    await expect(
      createTimeBlock({
        categoryId: category.id,
        date: '2026-08-23',
        startMinutes: 120,
        endMinutes: 120,
        title: 'Invalid',
        notes: '',
      }),
    ).rejects.toThrow()
  })

  it('updates and soft-deletes a block', async () => {
    const category = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    const block = await createTimeBlock({
      categoryId: category.id,
      date: '2026-08-23',
      startMinutes: 60,
      endMinutes: 120,
      title: 'Original',
      notes: '',
    })
    await updateTimeBlock(block.id, {
      categoryId: category.id,
      date: '2026-08-23',
      startMinutes: 60,
      endMinutes: 150,
      title: 'Editado',
      notes: '',
    })
    let [updated] = await listTimeBlocksForDate('2026-08-23')
    expect(updated.title).toBe('Editado')
    expect(updated.endMinutes).toBe(150)

    await deleteTimeBlock(block.id)
    expect(await listTimeBlocksForDate('2026-08-23')).toHaveLength(0)
  })

  it('only lists blocks for the requested date', async () => {
    const category = await createCategory({ name: 'A', color: '#111', emoji: '🅰️' })
    await createTimeBlock({
      categoryId: category.id,
      date: '2026-08-23',
      startMinutes: 60,
      endMinutes: 120,
      title: 'Hoy',
      notes: '',
    })
    await createTimeBlock({
      categoryId: category.id,
      date: '2026-08-24',
      startMinutes: 60,
      endMinutes: 120,
      title: 'Mañana',
      notes: '',
    })
    const blocks = await listTimeBlocksForDate('2026-08-23')
    expect(blocks.map((b) => b.title)).toEqual(['Hoy'])
  })
})
