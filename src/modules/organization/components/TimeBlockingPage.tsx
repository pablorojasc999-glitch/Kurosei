import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import { addDays, formatDayHeader, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import {
  createTimeBlock,
  deleteTimeBlock,
  ensureDefaultCategories,
  listCategories,
  listTimeBlockSegmentsForDate,
  updateTimeBlock,
} from '../db/organizationRepository'
import type { TimeBlock } from '../domain/types'
import { layoutTimeBlocks } from '../lib/timelineLayout'
import {
  formatDuration,
  formatTimeRange,
  minutesToTimeInput,
  roundToStep,
  timeInputToMinutes,
} from '../lib/time'
import { TimeSelect } from './TimeSelect'

const HOUR_HEIGHT = 56
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT
const MIN_BLOCK_HEIGHT = 26
const SWIPE_THRESHOLD_PX = 50
const LONG_PRESS_MS = 350
const DRAG_MOVE_THRESHOLD_PX = 6

function minutesNow(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

interface BlockFormState {
  categoryId: string
  title: string
  notes: string
  start: string
  end: string
  date: string
}

export function TimeBlockingPage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const dateKey = toDateKey(selectedDate)
  const isToday = dateKey === toDateKey(startOfDay(new Date()))

  useEffect(() => {
    ensureDefaultCategories()
  }, [])

  const categories = useLiveQuery(() => listCategories(), [])
  const segments = useLiveQuery(() => listTimeBlockSegmentsForDate(dateKey), [dateKey])
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  const [form, setForm] = useState<BlockFormState | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()
  const touchStartX = useRef<number | null>(null)
  const nowLineRef = useRef<HTMLDivElement | null>(null)

  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{ start: number; end: number } | null>(null)
  const dragInfo = useRef<{
    blockId: string
    startY: number
    originalStart: number
    originalEnd: number
  } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  /**
   * Whether the touch gesture currently in progress (or that just ended)
   * moved enough to count as a drag rather than a tap — read by onClick to
   * suppress the click a real drag leaves behind. Reset at the start of
   * *every* touch on *any* block (see handleBlockTouchStart/resetGesture),
   * so it can never get stuck true: some browsers don't fire a click after
   * a moved touch at all, which would otherwise leave a stale "suppress"
   * flag to wrongly eat the next unrelated tap.
   */
  const gestureMovedRef = useRef(false)

  useEffect(() => {
    if (isToday) {
      nowLineRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [isToday])

  function goToPreviousDay() {
    setSelectedDate((d) => addDays(d, -1))
  }
  function goToNextDay() {
    setSelectedDate((d) => addDays(d, 1))
  }
  function goToToday() {
    setSelectedDate(startOfDay(new Date()))
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta > SWIPE_THRESHOLD_PX) goToPreviousDay()
    else if (delta < -SWIPE_THRESHOLD_PX) goToNextDay()
  }

  function openBlockFormAt(rawStartMinutes: number) {
    if (!categories || categories.length === 0) return
    const start = Math.max(0, Math.min(1380, roundToStep(rawStartMinutes, 15)))
    setEditingBlockId(null)
    setForm({
      categoryId: categories[0].id,
      title: '',
      notes: '',
      start: minutesToTimeInput(start),
      end: minutesToTimeInput(Math.min(start + 60, 1439)),
      date: dateKey,
    })
    setError(null)
  }

  function openEditBlockForm(block: TimeBlock) {
    setEditingBlockId(block.id)
    setForm({
      categoryId: block.categoryId,
      title: block.title,
      notes: block.notes,
      start: minutesToTimeInput(block.startMinutes),
      end: minutesToTimeInput(block.endMinutes % 1440),
      date: block.date,
    })
    setError(null)
  }

  function closeSheet() {
    setForm(null)
    setEditingBlockId(null)
    setError(null)
  }

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const rawMinutes = ((e.clientY - rect.top) / TOTAL_HEIGHT) * 1440
    openBlockFormAt(rawMinutes)
  }

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  /** Attached to every block (draggable or not) so a fresh gesture always starts from a clean slate. */
  function resetGesture(e: React.TouchEvent) {
    e.stopPropagation()
    gestureMovedRef.current = false
  }

  function handleBlockTouchStart(e: React.TouchEvent, block: TimeBlock) {
    resetGesture(e)
    const touch = e.touches[0]
    dragInfo.current = {
      blockId: block.id,
      startY: touch.clientY,
      originalStart: block.startMinutes,
      originalEnd: block.endMinutes,
    }
    clearLongPressTimer()
    longPressTimer.current = window.setTimeout(() => {
      if (!dragInfo.current || dragInfo.current.blockId !== block.id) return
      setDraggingBlockId(block.id)
      setDragPreview({ start: block.startMinutes, end: block.endMinutes })
    }, LONG_PRESS_MS)
  }

  function handleBlockTouchMove(e: React.TouchEvent, block: TimeBlock) {
    e.stopPropagation()
    const info = dragInfo.current
    if (!info || info.blockId !== block.id) return
    const touch = e.touches[0]
    const deltaY = touch.clientY - info.startY
    if (Math.abs(deltaY) > DRAG_MOVE_THRESHOLD_PX) gestureMovedRef.current = true

    if (draggingBlockId !== block.id) {
      if (gestureMovedRef.current) {
        clearLongPressTimer()
        dragInfo.current = null
      }
      return
    }
    const duration = info.originalEnd - info.originalStart
    const deltaMinutes = roundToStep((deltaY / HOUR_HEIGHT) * 60, 15)
    const maxSpan = duration > 1440 ? 2880 : 1440
    const newStart = Math.max(0, Math.min(maxSpan - duration, info.originalStart + deltaMinutes))
    setDragPreview({ start: newStart, end: newStart + duration })
  }

  function handleBlockTouchEnd(e: React.TouchEvent, block: TimeBlock) {
    e.stopPropagation()
    clearLongPressTimer()
    const wasDragging = draggingBlockId === block.id
    dragInfo.current = null
    if (!wasDragging) return
    setDraggingBlockId(null)
    const preview = dragPreview
    setDragPreview(null)
    if (preview && (preview.start !== block.startMinutes || preview.end !== block.endMinutes)) {
      updateTimeBlock(block.id, {
        categoryId: block.categoryId,
        date: block.date,
        startMinutes: preview.start,
        endMinutes: preview.end,
        title: block.title,
        notes: block.notes,
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    const startMinutes = timeInputToMinutes(form.start)
    const rawEndMinutes = timeInputToMinutes(form.end)
    if (startMinutes === null || rawEndMinutes === null) {
      setError('Revisa las horas.')
      return
    }
    if (rawEndMinutes === startMinutes) {
      setError('La hora de término debe ser distinta a la de inicio.')
      return
    }
    // An end time earlier than the start means it's the next day (e.g. Dormir 22:00 -> 06:00).
    const endMinutes = rawEndMinutes < startMinutes ? rawEndMinutes + 1440 : rawEndMinutes
    const title = form.title.trim()
    if (!title) {
      setError('Ponle un título al bloque.')
      return
    }
    await guard(async () => {
      const input = {
        categoryId: form.categoryId,
        date: form.date,
        startMinutes,
        endMinutes,
        title,
        notes: form.notes.trim(),
      }
      if (editingBlockId) {
        await updateTimeBlock(editingBlockId, input)
      } else {
        await createTimeBlock(input)
      }
      closeSheet()
    })
  }

  const layoutInput = (segments ?? []).map((s) => ({
    ...s,
    startMinutes: s.segmentStart,
    endMinutes: s.segmentEnd,
  }))
  const layout = layoutTimeBlocks(layoutInput)
  const nowTop = (minutesNow(new Date()) / 1440) * TOTAL_HEIGHT

  const formDurationLabel = (() => {
    if (!form) return null
    const startMinutes = timeInputToMinutes(form.start)
    const rawEndMinutes = timeInputToMinutes(form.end)
    if (startMinutes === null || rawEndMinutes === null || rawEndMinutes === startMinutes) {
      return null
    }
    const endMinutes = rawEndMinutes < startMinutes ? rawEndMinutes + 1440 : rawEndMinutes
    return formatDuration(endMinutes - startMinutes)
  })()

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="day-nav">
        <button type="button" onClick={goToPreviousDay} aria-label="Día anterior">
          ‹
        </button>
        <button
          type="button"
          className="day-nav-label day-nav-label--button"
          aria-label={formatDayHeader(selectedDate)}
          onClick={goToToday}
        >
          <DayHeaderLabel date={selectedDate} />
        </button>
        <button type="button" onClick={goToNextDay} aria-label="Día siguiente">
          ›
        </button>
      </div>

      {!categories ? null : categories.length === 0 ? (
        <p className="empty-hint">
          Todavía no tenés categorías — creá una en la pestaña Categorías para
          empezar a bloquear tu tiempo.
        </p>
      ) : (
        <div className="timeline-wrapper">
          <div className="timeline" style={{ height: TOTAL_HEIGHT }} onClick={handleTimelineClick}>
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="timeline-hour-line" style={{ top: hour * HOUR_HEIGHT }}>
                <span className="timeline-hour-label">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
            {isToday && <div ref={nowLineRef} className="timeline-now-line" style={{ top: nowTop }} />}
            <div className="timeline-blocks">
              {layout.map(({ block: seg, column, columnCount }) => {
                const category = categoryById.get(seg.block.categoryId)
                const isDragging = draggingBlockId === seg.block.id
                const segStart = isDragging && dragPreview ? dragPreview.start : seg.segmentStart
                const segEnd = isDragging && dragPreview ? dragPreview.end : seg.segmentEnd
                const top = (segStart / 1440) * TOTAL_HEIGHT
                const height = Math.max(((segEnd - segStart) / 1440) * TOTAL_HEIGHT, MIN_BLOCK_HEIGHT)
                const widthPct = 100 / columnCount
                const draggable = !seg.continuesFromPreviousDay
                return (
                  <button
                    key={`${seg.block.id}-${seg.continuesFromPreviousDay ? 'tail' : 'head'}`}
                    type="button"
                    className={`timeline-block${draggable ? ' timeline-block--draggable' : ''}${isDragging ? ' timeline-block--dragging' : ''}`}
                    style={{
                      top,
                      height,
                      width: isDragging ? 'calc(100% - 4px)' : `calc(${widthPct}% - 4px)`,
                      left: isDragging ? '0%' : `${column * widthPct}%`,
                      background: category ? `${category.color}2e` : undefined,
                      borderColor: category?.color,
                      borderTopLeftRadius: seg.continuesFromPreviousDay ? 0 : 8,
                      borderTopRightRadius: seg.continuesFromPreviousDay ? 0 : 8,
                      borderBottomLeftRadius: seg.continuesToNextDay && !isDragging ? 0 : 8,
                      borderBottomRightRadius: seg.continuesToNextDay && !isDragging ? 0 : 8,
                      borderTopStyle: seg.continuesFromPreviousDay ? 'dashed' : 'solid',
                      borderBottomStyle: seg.continuesToNextDay && !isDragging ? 'dashed' : 'solid',
                    }}
                    onTouchStart={draggable ? (e) => handleBlockTouchStart(e, seg.block) : resetGesture}
                    onTouchMove={draggable ? (e) => handleBlockTouchMove(e, seg.block) : undefined}
                    onTouchEnd={
                      draggable ? (e) => handleBlockTouchEnd(e, seg.block) : (e) => e.stopPropagation()
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      if (gestureMovedRef.current) {
                        gestureMovedRef.current = false
                        return
                      }
                      openEditBlockForm(seg.block)
                    }}
                  >
                    <span className="timeline-block-title">
                      {category?.emoji} {seg.block.title}
                    </span>
                    {height >= 40 && (
                      <span className="timeline-block-time">
                        {isDragging && dragPreview
                          ? formatTimeRange(dragPreview.start, dragPreview.end)
                          : formatTimeRange(seg.block.startMinutes, seg.block.endMinutes)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {categories && categories.length > 0 && (
        <button
          type="button"
          className="timeline-fab"
          onClick={() => openBlockFormAt(isToday ? minutesNow(new Date()) : 9 * 60)}
          aria-label="Nuevo bloque"
        >
          +
        </button>
      )}

      {form && (
        <>
          <div className="sheet-backdrop" onClick={closeSheet} />
          <div className="sheet">
            <form className="entity-form" onSubmit={handleSubmit}>
              <h2>{editingBlockId ? 'Editar bloque' : 'Nuevo bloque'}</h2>
              <label>
                Categoría
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Reunión de equipo"
                  autoFocus
                />
              </label>
              <div className="category-form-row">
                <TimeSelect
                  label="Inicio"
                  value={form.start}
                  onChange={(v) => setForm({ ...form, start: v })}
                />
                <TimeSelect
                  label="Término"
                  value={form.end}
                  onChange={(v) => setForm({ ...form, end: v })}
                />
              </div>
              {formDurationLabel && <p className="block-duration">Duración: {formDurationLabel}</p>}
              <p className="empty-hint">
                Si el término es antes que el inicio, se toma como esa hora del día siguiente.
              </p>
              <label>
                Notas
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Opcional"
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={isSubmitting}>
                Guardar
              </button>
              <button type="button" onClick={closeSheet}>
                Cancelar
              </button>
              {editingBlockId && (
                <ConfirmDeleteButton
                  onConfirm={async () => {
                    await deleteTimeBlock(editingBlockId)
                    closeSheet()
                  }}
                  label="Eliminar bloque"
                />
              )}
            </form>
          </div>
        </>
      )}
    </div>
  )
}
