import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { addDays, parseDateInput, toDateKey } from '../../training/lib/calendarGrid'
import type { TimeBlock, TimeBlockCategory } from '../domain/types'

/** Seeded once when the user has never touched Organización — freely editable/deletable afterwards. */
const DEFAULT_CATEGORIES: Array<Pick<TimeBlockCategory, 'name' | 'color' | 'emoji'>> = [
  { name: 'Trabajo', color: '#38bdf8', emoji: '💼' },
  { name: 'Gimnasio', color: '#8b5cf6', emoji: '🏋️' },
  { name: 'Comer', color: '#fb923c', emoji: '🍽️' },
  { name: 'Dormir', color: '#6366f1', emoji: '😴' },
]

export async function listCategories(): Promise<TimeBlockCategory[]> {
  return db.org_categories.filter((c) => c.deletedAt === null).sortBy('order')
}

/**
 * Inserts the default category set exactly once, the first time this device
 * has zero categories. Runs as one transaction so two components mounting
 * at the same time (Planificador + Categorías both call this on mount)
 * can't both pass the "zero categories" check and double-seed.
 */
export async function ensureDefaultCategories(): Promise<void> {
  await db.transaction('rw', db.org_categories, async () => {
    const count = await db.org_categories.filter((c) => c.deletedAt === null).count()
    if (count > 0) return
    const timestamp = nowIso()
    const categories: TimeBlockCategory[] = DEFAULT_CATEGORIES.map((input, order) => ({
      id: generateId(),
      ...input,
      order,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }))
    await db.org_categories.bulkAdd(categories)
  })
}

export interface CreateCategoryInput {
  name: string
  color: string
  emoji: string
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<TimeBlockCategory> {
  const siblings = await listCategories()
  const nextOrder = siblings.length
    ? Math.max(...siblings.map((c) => c.order)) + 1
    : 0
  const timestamp = nowIso()
  const category: TimeBlockCategory = {
    id: generateId(),
    ...input,
    order: nextOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.org_categories.add(category)
  return category
}

export async function updateCategory(
  id: string,
  input: CreateCategoryInput,
): Promise<void> {
  await db.org_categories.update(id, { ...input, updatedAt: nowIso() })
}

/**
 * Swaps a category's position with its previous ('up') or next ('down')
 * sibling. A no-op at either end of the list.
 */
export async function reorderCategory(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const category = await db.org_categories.get(id)
  if (!category) return
  const siblings = await listCategories()
  const index = siblings.findIndex((c) => c.id === id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[targetIndex]
  if (!target) return

  const timestamp = nowIso()
  await db.transaction('rw', db.org_categories, async () => {
    await db.org_categories.update(category.id, { order: target.order, updatedAt: timestamp })
    await db.org_categories.update(target.id, { order: category.order, updatedAt: timestamp })
  })
}

/** Deletes a category and soft-deletes every time block that used it. */
export async function deleteCategory(id: string): Promise<void> {
  const timestamp = nowIso()
  const blocks = await db.org_time_blocks
    .where('categoryId')
    .equals(id)
    .filter((b) => b.deletedAt === null)
    .toArray()
  await db.transaction('rw', db.org_categories, db.org_time_blocks, async () => {
    await db.org_categories.update(id, { deletedAt: timestamp, updatedAt: timestamp })
    for (const block of blocks) {
      await db.org_time_blocks.update(block.id, { deletedAt: timestamp, updatedAt: timestamp })
    }
  })
}

export async function listTimeBlocksForDate(date: string): Promise<TimeBlock[]> {
  return db.org_time_blocks
    .where('date')
    .equals(date)
    .filter((b) => b.deletedAt === null)
    .sortBy('startMinutes')
}

export interface TimeBlockSegment {
  block: TimeBlock
  segmentStart: number
  segmentEnd: number
  continuesFromPreviousDay: boolean
  continuesToNextDay: boolean
}

/**
 * Time blocks to render on `date`, split into same-day segments. A block
 * whose endMinutes exceeds 1440 (e.g. Dormir 22:00 -> 06:00 the next day)
 * shows a segment on its own date (22:00-24:00) and a second segment on the
 * next date (00:00-06:00) — both segments reference the same underlying
 * block, so editing or dragging either one acts on the whole overnight
 * block.
 */
export async function listTimeBlockSegmentsForDate(date: string): Promise<TimeBlockSegment[]> {
  const previousDate = toDateKey(addDays(parseDateInput(date), -1))
  const [todayBlocks, previousDayBlocks] = await Promise.all([
    listTimeBlocksForDate(date),
    listTimeBlocksForDate(previousDate),
  ])
  const segments: TimeBlockSegment[] = todayBlocks.map((block) => ({
    block,
    segmentStart: block.startMinutes,
    segmentEnd: Math.min(block.endMinutes, 1440),
    continuesFromPreviousDay: false,
    continuesToNextDay: block.endMinutes > 1440,
  }))
  for (const block of previousDayBlocks) {
    if (block.endMinutes <= 1440) continue
    segments.push({
      block,
      segmentStart: 0,
      segmentEnd: block.endMinutes - 1440,
      continuesFromPreviousDay: true,
      continuesToNextDay: false,
    })
  }
  return segments.sort((a, b) => a.segmentStart - b.segmentStart)
}

export interface CreateTimeBlockInput {
  categoryId: string
  date: string
  startMinutes: number
  endMinutes: number
  title: string
  notes: string
}

/**
 * `endMinutes` may exceed 1440 by up to a full day (an overnight block) but
 * never past that — a block can't span more than 24 hours.
 */
function validateRange(startMinutes: number, endMinutes: number): void {
  if (endMinutes <= startMinutes) {
    throw new Error('La hora de término debe ser posterior a la de inicio.')
  }
  if (endMinutes - startMinutes > 1440) {
    throw new Error('Un bloque no puede durar más de 24 horas.')
  }
}

export async function createTimeBlock(
  input: CreateTimeBlockInput,
): Promise<TimeBlock> {
  validateRange(input.startMinutes, input.endMinutes)
  const timestamp = nowIso()
  const block: TimeBlock = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.org_time_blocks.add(block)
  return block
}

export type UpdateTimeBlockInput = CreateTimeBlockInput

export async function updateTimeBlock(
  id: string,
  input: UpdateTimeBlockInput,
): Promise<void> {
  validateRange(input.startMinutes, input.endMinutes)
  await db.org_time_blocks.update(id, { ...input, updatedAt: nowIso() })
}

export async function deleteTimeBlock(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.org_time_blocks.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}
