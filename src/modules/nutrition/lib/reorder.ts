export interface OrderedItem {
  id: string
  sectionId: string
  order: number
}

/**
 * Removes the item `id` from wherever it currently sits and reinserts it
 * into `targetSectionId` at `targetIndex` (clamped to that section's new
 * length), renumbering every affected section's `order` field from 0. Used
 * for both a plain within-section reorder (`targetSectionId` unchanged) and
 * a drag to a different meal section — same operation either way.
 *
 * Returns only the items whose `sectionId` or `order` actually changed, so
 * the caller only has to persist those.
 */
export function moveItem<T extends OrderedItem>(
  items: T[],
  id: string,
  targetSectionId: string,
  targetIndex: number,
): T[] {
  const moving = items.find((i) => i.id === id)
  if (!moving) return []

  const bySection = new Map<string, T[]>()
  for (const item of items) {
    if (item.id === id) continue
    const list = bySection.get(item.sectionId) ?? []
    list.push(item)
    bySection.set(item.sectionId, list)
  }
  for (const list of bySection.values()) list.sort((a, b) => a.order - b.order)

  const targetList = bySection.get(targetSectionId) ?? []
  const clampedIndex = Math.max(0, Math.min(targetIndex, targetList.length))
  targetList.splice(clampedIndex, 0, moving)
  bySection.set(targetSectionId, targetList)

  const changed: T[] = []
  for (const [sectionId, list] of bySection) {
    list.forEach((item, index) => {
      if (item.sectionId !== sectionId || item.order !== index) {
        changed.push({ ...item, sectionId, order: index })
      }
    })
  }
  return changed
}

/** Renumbers `order` for a plain list of ids, 0-based in the given order — for reordering within a single scope (e.g. meal sections themselves). */
export function reindex<T extends { id: string; order: number }>(
  items: T[],
  orderedIds: string[],
): T[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const changed: T[] = []
  orderedIds.forEach((id, index) => {
    const item = byId.get(id)
    if (item && item.order !== index) changed.push({ ...item, order: index })
  })
  return changed
}
