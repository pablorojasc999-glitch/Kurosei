import { useRef, useState } from 'react'
import type { OrderedItem } from './reorder'

const LONG_PRESS_MS = 350
const MOVE_CANCEL_THRESHOLD_PX = 10

interface DragMeta {
  entryId: string
  pointerId: number
  startX: number
  startY: number
  timer: number
  started: boolean
}

/**
 * Long-press pointer drag to reorder a list of section-scoped items, or move
 * one to a different section — shared by Registro (date entries) and
 * Plantillas (template entries), which differ only in what `onMove` persists.
 */
export function useEntryDragReorder<T extends OrderedItem>(
  items: T[] | undefined,
  sections: Array<{ id: string }> | undefined,
  onMove: (entryId: string, targetSectionId: string, targetIndex: number) => void,
) {
  const dragMeta = useRef<DragMeta | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const sectionListRefs = useRef(new Map<string, HTMLDivElement>())
  // A completed drag still ends with a native "click" on the row — the
  // browser dispatches it to whatever element holds pointer capture, which
  // is the dragged row itself regardless of where it visually ended up. Set
  // once a drag actually happens, consumed by the row's own onClick so that
  // click doesn't also toggle it open/closed right after the drop.
  const justDraggedRef = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ sectionId: string; index: number } | null>(null)

  function findDropTarget(clientX: number, clientY: number, draggingEntryId: string) {
    if (!items || !sections) return null
    let best: { sectionId: string; index: number; distance: number } | null = null
    for (const section of sections) {
      const sectionEntries = items
        .filter((e) => e.sectionId === section.id && e.id !== draggingEntryId)
        .sort((a, b) => a.order - b.order)
      sectionEntries.forEach((entry, index) => {
        const row = rowRefs.current.get(entry.id)
        if (!row) return
        const rect = row.getBoundingClientRect()
        if (clientX < rect.left - 60 || clientX > rect.right + 60) return
        const midY = rect.top + rect.height / 2
        const distance = Math.abs(clientY - midY)
        const targetIndex = clientY < midY ? index : index + 1
        if (!best || distance < best.distance) {
          best = { sectionId: section.id, index: targetIndex, distance }
        }
      })
      if (sectionEntries.length === 0) {
        const listEl = sectionListRefs.current.get(section.id)
        if (listEl) {
          const rect = listEl.getBoundingClientRect()
          if (clientY >= rect.top - 20 && clientY <= rect.bottom + 20) {
            best = { sectionId: section.id, index: 0, distance: -1 }
          }
        }
      }
    }
    return best ? { sectionId: best.sectionId, index: best.index } : null
  }

  function handlePointerDown(entryId: string, e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId
    // Captured on the row itself once the drag actually starts, so every
    // subsequent pointermove/pointerup keeps targeting this row even once
    // the finger/cursor has moved over a different row or an empty section
    // — without it, move events stop reaching this handler entirely as
    // soon as the pointer leaves the original row's bounds.
    const target = e.currentTarget as HTMLElement
    const timer = window.setTimeout(() => {
      const meta = dragMeta.current
      if (!meta || meta.entryId !== entryId) return
      meta.started = true
      target.setPointerCapture(pointerId)
      setDraggingId(entryId)
      setDragOffset({ dx: 0, dy: 0 })
    }, LONG_PRESS_MS)
    dragMeta.current = { entryId, pointerId, startX, startY, timer, started: false }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const meta = dragMeta.current
    if (!meta || meta.pointerId !== e.pointerId) return
    const dx = e.clientX - meta.startX
    const dy = e.clientY - meta.startY
    if (!meta.started) {
      if (Math.hypot(dx, dy) > MOVE_CANCEL_THRESHOLD_PX) {
        window.clearTimeout(meta.timer)
        dragMeta.current = null
      }
      return
    }
    e.preventDefault()
    setDragOffset({ dx, dy })
    setDropTarget(findDropTarget(e.clientX, e.clientY, meta.entryId))
  }

  function handlePointerUp(e: React.PointerEvent) {
    const meta = dragMeta.current
    if (!meta || meta.pointerId !== e.pointerId) return
    window.clearTimeout(meta.timer)
    if (meta.started) {
      const target = e.currentTarget as HTMLElement
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
      if (dropTarget) onMove(meta.entryId, dropTarget.sectionId, dropTarget.index)
      justDraggedRef.current = true
    }
    dragMeta.current = null
    setDraggingId(null)
    setDragOffset(null)
    setDropTarget(null)
  }

  /** Call from the row's onClick before acting on it — returns true (and clears the flag) exactly once right after a drag, so that drag's trailing click doesn't also toggle the row. */
  function consumeJustDragged(): boolean {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return true
    }
    return false
  }

  return {
    rowRefs,
    sectionListRefs,
    draggingId,
    dragOffset,
    dropTarget,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeJustDragged,
  }
}
