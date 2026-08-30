import { describe, expect, it } from 'vitest'
import { moveItem, reindex, type OrderedItem } from './reorder'

function item(id: string, sectionId: string, order: number): OrderedItem {
  return { id, sectionId, order }
}

describe('moveItem', () => {
  it('reorders within the same section', () => {
    const items = [item('a', 's1', 0), item('b', 's1', 1), item('c', 's1', 2)]
    const changed = moveItem(items, 'c', 's1', 0)
    const byId = Object.fromEntries(changed.map((i) => [i.id, i]))
    expect(byId.c).toEqual({ id: 'c', sectionId: 's1', order: 0 })
    expect(byId.a).toEqual({ id: 'a', sectionId: 's1', order: 1 })
    expect(byId.b).toEqual({ id: 'b', sectionId: 's1', order: 2 })
  })

  it('moves an item to a different section, closing the gap it left behind', () => {
    const items = [
      item('a', 's1', 0),
      item('b', 's1', 1),
      item('c', 's2', 0),
    ]
    const changed = moveItem(items, 'a', 's2', 1)
    const byId = Object.fromEntries(changed.map((i) => [i.id, i]))
    // b closes the gap left in s1
    expect(byId.b).toEqual({ id: 'b', sectionId: 's1', order: 0 })
    // a lands at index 1 in s2, after c
    expect(byId.a).toEqual({ id: 'a', sectionId: 's2', order: 1 })
    expect(byId.c).toBeUndefined() // c didn't move, stays at order 0
  })

  it('clamps an out-of-range target index to the end of the section', () => {
    const items = [item('a', 's1', 0), item('b', 's2', 0)]
    const changed = moveItem(items, 'a', 's2', 99)
    const byId = Object.fromEntries(changed.map((i) => [i.id, i]))
    expect(byId.a).toEqual({ id: 'a', sectionId: 's2', order: 1 })
  })

  it('is a no-op (empty result) when nothing actually moved', () => {
    const items = [item('a', 's1', 0), item('b', 's1', 1)]
    expect(moveItem(items, 'a', 's1', 0)).toEqual([])
  })

  it('returns an empty list when the id does not exist', () => {
    const items = [item('a', 's1', 0)]
    expect(moveItem(items, 'missing', 's1', 0)).toEqual([])
  })
})

describe('reindex', () => {
  it('renumbers order to match the given id sequence', () => {
    const items = [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ]
    const changed = reindex(items, ['c', 'a', 'b'])
    expect(changed).toEqual([
      { id: 'c', order: 0 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ])
  })

  it('skips items whose order already matches', () => {
    const items = [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
    ]
    expect(reindex(items, ['a', 'b'])).toEqual([])
  })
})
