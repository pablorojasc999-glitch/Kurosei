import { describe, expect, it } from 'vitest'
import { layoutTimeBlocks } from './timelineLayout'

interface Block {
  id: string
  startMinutes: number
  endMinutes: number
}

describe('layoutTimeBlocks', () => {
  it('gives a single isolated block full width (column 0 of 1)', () => {
    const blocks: Block[] = [{ id: 'a', startMinutes: 60, endMinutes: 120 }]
    const layout = layoutTimeBlocks(blocks)
    expect(layout).toEqual([{ block: blocks[0], column: 0, columnCount: 1 }])
  })

  it('keeps non-overlapping blocks each at full width', () => {
    const blocks: Block[] = [
      { id: 'a', startMinutes: 0, endMinutes: 60 },
      { id: 'b', startMinutes: 60, endMinutes: 120 },
    ]
    const layout = layoutTimeBlocks(blocks)
    expect(layout.map((l) => l.columnCount)).toEqual([1, 1])
    expect(layout.map((l) => l.column)).toEqual([0, 0])
  })

  it('splits two overlapping blocks into two side-by-side columns', () => {
    const blocks: Block[] = [
      { id: 'a', startMinutes: 0, endMinutes: 60 },
      { id: 'b', startMinutes: 30, endMinutes: 90 },
    ]
    const layout = layoutTimeBlocks(blocks)
    const byId = new Map(layout.map((l) => [l.block.id, l]))
    expect(byId.get('a')).toMatchObject({ column: 0, columnCount: 2 })
    expect(byId.get('b')).toMatchObject({ column: 1, columnCount: 2 })
  })

  it('sizes a three-way overlap to three columns', () => {
    const blocks: Block[] = [
      { id: 'a', startMinutes: 0, endMinutes: 90 },
      { id: 'b', startMinutes: 10, endMinutes: 80 },
      { id: 'c', startMinutes: 20, endMinutes: 70 },
    ]
    const layout = layoutTimeBlocks(blocks)
    expect(layout.every((l) => l.columnCount === 3)).toBe(true)
    expect(new Set(layout.map((l) => l.column))).toEqual(new Set([0, 1, 2]))
  })

  it('keeps separate clusters independently sized', () => {
    const blocks: Block[] = [
      { id: 'a', startMinutes: 0, endMinutes: 60 },
      { id: 'b', startMinutes: 10, endMinutes: 50 },
      { id: 'c', startMinutes: 200, endMinutes: 260 },
    ]
    const layout = layoutTimeBlocks(blocks)
    const byId = new Map(layout.map((l) => [l.block.id, l]))
    expect(byId.get('a')?.columnCount).toBe(2)
    expect(byId.get('b')?.columnCount).toBe(2)
    expect(byId.get('c')?.columnCount).toBe(1)
  })

  it('reuses a freed column instead of always growing', () => {
    const blocks: Block[] = [
      { id: 'a', startMinutes: 0, endMinutes: 30 },
      { id: 'b', startMinutes: 0, endMinutes: 60 },
      { id: 'c', startMinutes: 30, endMinutes: 90 },
    ]
    const layout = layoutTimeBlocks(blocks)
    const byId = new Map(layout.map((l) => [l.block.id, l]))
    expect(byId.get('a')?.column).toBe(0)
    expect(byId.get('b')?.column).toBe(1)
    expect(byId.get('c')?.column).toBe(0)
  })

  it('handles an empty list', () => {
    expect(layoutTimeBlocks([])).toEqual([])
  })
})
