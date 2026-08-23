import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { addDays, formatDayHeader, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import {
  createTimeBlock,
  deleteTimeBlock,
  ensureDefaultCategories,
  listCategories,
  listTimeBlocksForDate,
  updateTimeBlock,
} from '../db/organizationRepository'
import { layoutTimeBlocks } from '../lib/timelineLayout'
import { formatTimeRange, minutesToTimeInput, roundToStep, timeInputToMinutes } from '../lib/time'

const HOUR_HEIGHT = 56
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT
const MIN_BLOCK_HEIGHT = 26
const SWIPE_THRESHOLD_PX = 50

function minutesNow(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

interface BlockFormState {
  categoryId: string
  title: string
  notes: string
  start: string
  end: string
}

export function TimeBlockingPage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const dateKey = toDateKey(selectedDate)
  const isToday = dateKey === toDateKey(startOfDay(new Date()))

  useEffect(() => {
    ensureDefaultCategories()
  }, [])

  const categories = useLiveQuery(() => listCategories(), [])
  const blocks = useLiveQuery(() => listTimeBlocksForDate(dateKey), [dateKey])
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  const [form, setForm] = useState<BlockFormState | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()
  const touchStartX = useRef<number | null>(null)
  const nowLineRef = useRef<HTMLDivElement | null>(null)

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
    })
    setError(null)
  }

  function openEditBlockForm(block: {
    id: string
    categoryId: string
    title: string
    notes: string
    startMinutes: number
    endMinutes: number
  }) {
    setEditingBlockId(block.id)
    setForm({
      categoryId: block.categoryId,
      title: block.title,
      notes: block.notes,
      start: minutesToTimeInput(block.startMinutes),
      end: minutesToTimeInput(block.endMinutes),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    const startMinutes = timeInputToMinutes(form.start)
    const endMinutes = timeInputToMinutes(form.end)
    if (startMinutes === null || endMinutes === null) {
      setError('Revisa las horas.')
      return
    }
    if (endMinutes <= startMinutes) {
      setError('La hora de término debe ser posterior a la de inicio.')
      return
    }
    const title = form.title.trim()
    if (!title) {
      setError('Ponle un título al bloque.')
      return
    }
    await guard(async () => {
      const input = {
        categoryId: form.categoryId,
        date: dateKey,
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

  const layout = blocks ? layoutTimeBlocks(blocks) : []
  const nowTop = (minutesNow(new Date()) / 1440) * TOTAL_HEIGHT

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="day-nav">
        <button type="button" onClick={goToPreviousDay} aria-label="Día anterior">
          ‹
        </button>
        <button type="button" className="day-nav-label day-nav-label--button" onClick={goToToday}>
          {formatDayHeader(selectedDate)}
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
              {layout.map(({ block, column, columnCount }) => {
                const category = categoryById.get(block.categoryId)
                const top = (block.startMinutes / 1440) * TOTAL_HEIGHT
                const height = Math.max(
                  ((block.endMinutes - block.startMinutes) / 1440) * TOTAL_HEIGHT,
                  MIN_BLOCK_HEIGHT,
                )
                const widthPct = 100 / columnCount
                return (
                  <button
                    key={block.id}
                    type="button"
                    className="timeline-block"
                    style={{
                      top,
                      height,
                      width: `calc(${widthPct}% - 4px)`,
                      left: `${column * widthPct}%`,
                      background: category ? `${category.color}2e` : undefined,
                      borderColor: category?.color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditBlockForm(block)
                    }}
                  >
                    <span className="timeline-block-title">
                      {category?.emoji} {block.title}
                    </span>
                    {height >= 40 && (
                      <span className="timeline-block-time">
                        {formatTimeRange(block.startMinutes, block.endMinutes)}
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
                <label>
                  Inicio
                  <input
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                  />
                </label>
                <label>
                  Término
                  <input
                    type="time"
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                  />
                </label>
              </div>
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
