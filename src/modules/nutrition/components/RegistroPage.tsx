import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import {
  createMealSection,
  listEntriesForDate,
  listFoods,
  listMealSections,
  moveEntry,
  saveDateAsTemplate,
  softDeleteEntry,
} from '../db/nutritionRepository'
import type { NutritionEntry } from '../domain/types'
import { sumMacros } from '../lib/macros'
import { AddEntryForm } from './AddEntryForm'
import { EntryRow } from './EntryRow'

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

export function RegistroPage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const dateKey = toDateKey(selectedDate)

  const sections = useLiveQuery(() => listMealSections(), [])
  const entries = useLiveQuery(() => listEntriesForDate(dateKey), [dateKey])
  const foods = useLiveQuery(() => listFoods(), [])
  const foodById = new Map((foods ?? []).map((f) => [f.id, f]))

  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null)
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateEmoji, setTemplateEmoji] = useState('')
  const [templateError, setTemplateError] = useState<string | null>(null)
  const { isSubmitting: savingTemplate, guard: guardTemplate } = useSubmitGuard()

  // --- Long-press drag: reorder within a meal, or move to a different one ---
  const dragMeta = useRef<DragMeta | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const sectionListRefs = useRef(new Map<string, HTMLDivElement>())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ sectionId: string; index: number } | null>(null)

  function findDropTarget(clientX: number, clientY: number, draggingEntryId: string) {
    if (!entries || !sections) return null
    let best: { sectionId: string; index: number; distance: number } | null = null
    for (const section of sections) {
      const sectionEntries = entries
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
      if (dropTarget) void moveEntry(meta.entryId, dropTarget.sectionId, dropTarget.index)
    }
    dragMeta.current = null
    setDraggingId(null)
    setDragOffset(null)
    setDropTarget(null)
  }

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault()
    const name = newSectionName.trim()
    if (!name) return
    await createMealSection(name)
    setNewSectionName('')
    setShowNewSection(false)
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    setTemplateError(null)
    await guardTemplate(async () => {
      try {
        const name = templateName.trim()
        if (!name) throw new Error('El nombre no puede estar vacío.')
        if ((entries ?? []).length === 0) {
          throw new Error('Este día todavía no tiene nada registrado.')
        }
        await saveDateAsTemplate(dateKey, name, templateEmoji.trim())
        setShowSaveTemplate(false)
        setTemplateName('')
        setTemplateEmoji('')
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const dayTotals = sumMacros(entries ?? [])

  return (
    <div className="page">
      <h1>Registro</h1>

      <div className="day-nav">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          aria-label="Día anterior"
        >
          ‹
        </button>
        <span className="day-nav-label">
          <DayHeaderLabel date={selectedDate} />
        </span>
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      <div className="finance-summary-row">
        <div className="finance-summary-card">
          <span>Calorías</span>
          <strong>{Math.round(dayTotals.calories)}</strong>
        </div>
        <div className="finance-summary-card">
          <span>Proteínas</span>
          <strong>{Math.round(dayTotals.proteinG)} g</strong>
        </div>
        <div className="finance-summary-card">
          <span>Carbos</span>
          <strong>{Math.round(dayTotals.carbsG)} g</strong>
        </div>
        <div className="finance-summary-card">
          <span>Grasas</span>
          <strong>{Math.round(dayTotals.fatG)} g</strong>
        </div>
      </div>

      {sections?.map((section) => {
        const sectionEntries = (entries ?? [])
          .filter((e: NutritionEntry) => e.sectionId === section.id)
          .sort((a, b) => a.order - b.order)
        const sectionTotals = sumMacros(sectionEntries)
        return (
          <section key={section.id} className="nutrition-meal-section">
            <div className="nutrition-meal-section-header">
              <h2>{section.name}</h2>
              <span className="finance-transaction-subtitle">
                {Math.round(sectionTotals.calories)} kcal
              </span>
            </div>
            <div
              ref={(el) => {
                if (el) sectionListRefs.current.set(section.id, el)
                else sectionListRefs.current.delete(section.id)
              }}
              className={`nutrition-entry-list${
                dropTarget?.sectionId === section.id ? ' nutrition-entry-list--drop-target' : ''
              }`}
            >
              {sectionEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  food={entry.foodId ? foodById.get(entry.foodId) : undefined}
                  isDragging={draggingId === entry.id}
                  dragOffset={draggingId === entry.id ? dragOffset : null}
                  registerRef={(el) => {
                    if (el) rowRefs.current.set(entry.id, el)
                    else rowRefs.current.delete(entry.id)
                  }}
                  onPointerDown={(e) => handlePointerDown(entry.id, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onDelete={() => void softDeleteEntry(entry.id)}
                />
              ))}
              {sectionEntries.length === 0 && (
                <p className="empty-hint">Sin registros todavía.</p>
              )}
            </div>
            {addingToSectionId === section.id ? (
              <AddEntryForm
                date={dateKey}
                sectionId={section.id}
                foods={foods ?? []}
                onDone={() => setAddingToSectionId(null)}
              />
            ) : (
              <button
                type="button"
                className="collapsible-toggle"
                onClick={() => setAddingToSectionId(section.id)}
              >
                + Agregar a {section.name}
              </button>
            )}
          </section>
        )
      })}

      {showNewSection ? (
        <form onSubmit={handleCreateSection} className="entity-form">
          <label>
            Nombre de la sección
            <input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Ej. Snack 1"
              autoFocus
              required
            />
          </label>
          <button type="submit">Crear</button>
          <button type="button" onClick={() => setShowNewSection(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="finance-add-button" onClick={() => setShowNewSection(true)}>
          + Agregar sección
        </button>
      )}

      {showSaveTemplate ? (
        <form onSubmit={handleSaveTemplate} className="entity-form">
          <label>
            Nombre de la plantilla
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ej. Día de entrenamiento"
              autoFocus
              required
            />
          </label>
          <label>
            Emoji (opcional)
            <input
              value={templateEmoji}
              onChange={(e) => setTemplateEmoji(e.target.value)}
              placeholder="🏋️"
              maxLength={4}
            />
          </label>
          {templateError && <p className="error">{templateError}</p>}
          <button type="submit" disabled={savingTemplate}>
            Guardar plantilla
          </button>
          <button type="button" onClick={() => setShowSaveTemplate(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowSaveTemplate(true)}>
          Guardar este día como plantilla
        </button>
      )}
    </div>
  )
}

