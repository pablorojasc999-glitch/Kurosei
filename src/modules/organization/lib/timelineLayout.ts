export interface TimeBlockLike {
  startMinutes: number
  endMinutes: number
}

export interface LayoutBlock<T extends TimeBlockLike> {
  block: T
  column: number
  columnCount: number
}

/**
 * Assigns each block a column (and its cluster's total column count) so
 * time-overlapping blocks render side-by-side instead of stacking on top of
 * each other. Blocks that never overlap anything else always get column 0
 * of a 1-column cluster (full width). A classic calendar-layout sweep:
 * blocks are processed in start order, each cluster (a maximal run of
 * mutually-touching blocks) shares one column count sized to its peak
 * concurrency.
 */
export function layoutTimeBlocks<T extends TimeBlockLike>(blocks: T[]): LayoutBlock<T>[] {
  const sorted = [...blocks].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  )
  const result: LayoutBlock<T>[] = []

  let active: Array<{ block: T; column: number }> = []
  let cluster: Array<{ block: T; column: number }> = []

  function flushCluster() {
    if (cluster.length === 0) return
    const columnCount = Math.max(...cluster.map((c) => c.column)) + 1
    for (const c of cluster) {
      result.push({ block: c.block, column: c.column, columnCount })
    }
    cluster = []
  }

  for (const block of sorted) {
    active = active.filter((a) => a.block.endMinutes > block.startMinutes)
    if (active.length === 0) {
      flushCluster()
    }
    const usedColumns = new Set(active.map((a) => a.column))
    let column = 0
    while (usedColumns.has(column)) column++
    const entry = { block, column }
    active.push(entry)
    cluster.push(entry)
  }
  flushCluster()

  return result
}
