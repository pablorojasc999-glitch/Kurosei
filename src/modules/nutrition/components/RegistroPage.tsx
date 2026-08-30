import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import {
  addFoodEntry,
  addManualEntry,
  applyTemplateToDate,
  createMealSection,
  listEntriesForDate,
  listEntriesForDateRange,
  listFoods,
  listGoalPlans,
  listMealSections,
  listMealTemplates,
  moveEntry,
  softDeleteEntry,
  updateFoodEntryQuantity,
  updateManualEntry,
} from '../db/nutritionRepository'
import type { NutritionEntry } from '../domain/types'
import { findActivePlan, getGoalStatus, progressPercent } from '../lib/goalPlans'
import { sumMacros, type MacroTotals } from '../lib/macros'
import { formatNutrient } from '../lib/nutrients'
import { useEntryDragReorder } from '../lib/useEntryDragReorder'
import { weekDates } from '../lib/weekStrip'
import { AddEntryForm } from './AddEntryForm'
import { EntryEditor } from './EntryEditor'
import { EntryRow } from './EntryRow'
import { WeekStrip } from './WeekStrip'

function MacroCard({
  label,
  consumed,
  unit,
  target,
}: {
  label: string
  consumed: number
  unit: string
  target: number | null
}) {
  return (
    <div className="finance-summary-card">
      <span>{label}</span>
      <strong>
        {formatNutrient(consumed)}
        {unit}
        {target !== null && (
          <span className="nutrition-progress-goal"> / {formatNutrient(target)}{unit}</span>
        )}
      </strong>
      {target !== null && (
        <div className="nutrition-progress-track">
          <div
            className="nutrition-progress-fill"
            style={{ width: `${progressPercent(consumed, target)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function RegistroPage() {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const dateKey = toDateKey(selectedDate)
  const days = weekDates(selectedDate)
  const weekStartKey = toDateKey(days[0])
  const weekEndKey = toDateKey(days[6])

  const sections = useLiveQuery(() => listMealSections(), [])
  const entries = useLiveQuery(() => listEntriesForDate(dateKey), [dateKey])
  const weekEntries = useLiveQuery(
    () => listEntriesForDateRange(weekStartKey, weekEndKey),
    [weekStartKey, weekEndKey],
  )
  const goalPlans = useLiveQuery(() => listGoalPlans(), [])
  const foods = useLiveQuery(() => listFoods(), [])
  const templates = useLiveQuery(() => listMealTemplates(), [])
  const foodById = new Map((foods ?? []).map((f) => [f.id, f]))

  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null)
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  const {
    rowRefs,
    sectionListRefs,
    draggingId,
    dragOffset,
    dropTarget,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeJustDragged,
  } = useEntryDragReorder(entries, sections, (entryId, targetSectionId, targetIndex) => {
    void moveEntry(entryId, targetSectionId, targetIndex)
  })

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault()
    const name = newSectionName.trim()
    if (!name) return
    await createMealSection(name)
    setNewSectionName('')
    setShowNewSection(false)
  }

  async function handleApplyTemplate(templateId: string) {
    await applyTemplateToDate(templateId, dateKey)
    setShowTemplatePicker(false)
  }

  const dayTotals = sumMacros(entries ?? [])
  const activePlan = findActivePlan(goalPlans ?? [], dateKey)

  const weekDayStatuses = days.map((date) => {
    const key = toDateKey(date)
    const dayEntries = (weekEntries ?? []).filter((e) => e.date === key)
    const totals: MacroTotals = sumMacros(dayEntries)
    const plan = findActivePlan(goalPlans ?? [], key)
    return { date, status: getGoalStatus(plan, totals.calories, dayEntries.length > 0) }
  })

  return (
    <div className="page">
      <h1>Registro</h1>

      <WeekStrip days={weekDayStatuses} selectedDate={selectedDate} onSelect={setSelectedDate} />

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
        <MacroCard
          label="Calorías"
          consumed={dayTotals.calories}
          unit=""
          target={activePlan?.targetCalories ?? null}
        />
        <MacroCard
          label="Proteínas"
          consumed={dayTotals.proteinG}
          unit=" g"
          target={activePlan?.targetProteinG ?? null}
        />
        <MacroCard
          label="Carbos"
          consumed={dayTotals.carbsG}
          unit=" g"
          target={activePlan?.targetCarbsG ?? null}
        />
        <MacroCard
          label="Grasas"
          consumed={dayTotals.fatG}
          unit=" g"
          target={activePlan?.targetFatG ?? null}
        />
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
              <span className="nutrition-meal-section-totals">
                🔥 {formatNutrient(sectionTotals.calories)} kcal · P{' '}
                {formatNutrient(sectionTotals.proteinG)} · C {formatNutrient(sectionTotals.carbsG)} ·
                G {formatNutrient(sectionTotals.fatG)}
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
              {sectionEntries.map((entry) => {
                const entryFood = entry.foodId ? foodById.get(entry.foodId) : undefined
                return (
                  <div key={entry.id}>
                    <EntryRow
                      entry={entry}
                      food={entryFood}
                      isDragging={draggingId === entry.id}
                      dragOffset={draggingId === entry.id ? dragOffset : null}
                      showDetail={expandedEntryId === entry.id}
                      registerRef={(el) => {
                        if (el) rowRefs.current.set(entry.id, el)
                        else rowRefs.current.delete(entry.id)
                      }}
                      onPointerDown={(e) => handlePointerDown(entry.id, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onToggleDetail={() => {
                        if (consumeJustDragged()) return
                        setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))
                      }}
                      onDelete={() => void softDeleteEntry(entry.id)}
                    />
                    {expandedEntryId === entry.id &&
                      (entry.kind === 'manual' || entryFood) && (
                        <EntryEditor
                          entry={entry}
                          food={entryFood}
                          onSaveQuantity={async (quantity) => {
                            await updateFoodEntryQuantity(entry.id, quantity)
                            setExpandedEntryId(null)
                          }}
                          onSaveManual={async (input) => {
                            await updateManualEntry(entry.id, { ...input, notes: entry.notes })
                            setExpandedEntryId(null)
                          }}
                        />
                      )}
                  </div>
                )
              })}
              {sectionEntries.length === 0 && (
                <p className="empty-hint">Sin registros todavía.</p>
              )}
            </div>
            {addingToSectionId === section.id ? (
              <AddEntryForm
                foods={foods ?? []}
                onAddFood={async (foodId, quantity, notes) => {
                  await addFoodEntry({ date: dateKey, sectionId: section.id, foodId, quantity, notes })
                }}
                onAddManual={async (input) => {
                  await addManualEntry({ date: dateKey, sectionId: section.id, ...input })
                }}
                onDone={() => setAddingToSectionId(null)}
              />
            ) : (
              <button
                type="button"
                className="nutrition-add-pill"
                aria-label={`Agregar a ${section.name}`}
                onClick={() => setAddingToSectionId(section.id)}
              >
                +
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

      {showTemplatePicker ? (
        <div className="nutrition-template-picker">
          <span className="bitacora-nutrition-summary-label">Elegí una plantilla</span>
          <ul>
            {templates?.map((template) => (
              <li key={template.id}>
                <button type="button" onClick={() => void handleApplyTemplate(template.id)}>
                  {template.emoji} {template.name}
                </button>
              </li>
            ))}
            {templates?.length === 0 && (
              <p className="empty-hint">Todavía no creaste ninguna plantilla.</p>
            )}
          </ul>
          <button type="button" onClick={() => setShowTemplatePicker(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowTemplatePicker(true)}>
          Cargar plantilla
        </button>
      )}
    </div>
  )
}
