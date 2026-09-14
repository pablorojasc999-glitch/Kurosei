import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { DayHeaderLabel } from '../../training/components/DayHeaderLabel'
import {
  addFoodEntry,
  addManualEntry,
  applyTemplateToDate,
  createMealSection,
  getEntryMacroTotals,
  listEntriesForDate,
  listEntriesForDateRange,
  listFoods,
  listGoalPlans,
  listMealSections,
  listMealTemplates,
  moveEntry,
  softDeleteEntry,
  toggleEntryChecked,
  updateFoodEntryQuantity,
  updateManualEntry,
} from '../db/nutritionRepository'
import type { NutritionEntry, NutritionGoalPlan } from '../domain/types'
import { findActivePlan, getGoalStatus, progressPercent } from '../lib/goalPlans'
import type { MacroTotals } from '../lib/macros'
import { formatNutrient, formatSummaryAmount } from '../lib/nutrients'
import { useEntryDragReorder } from '../lib/useEntryDragReorder'
import { weekDates } from '../lib/weekStrip'
import { AddEntryForm } from './AddEntryForm'
import { EntryEditor } from './EntryEditor'
import { EntryRow } from './EntryRow'
import { WaterSection } from './WaterSection'
import { WeekStrip } from './WeekStrip'

/** La barra de avance de un macro. Sin meta no hay contra qué avanzar, así que no se dibuja. */
function ProgressBar({ consumed, target }: { consumed: number; target: number | null }) {
  if (target === null) return null
  return (
    <div className="nutrition-progress-track">
      <div
        className="nutrition-progress-fill"
        style={{ width: `${progressPercent(consumed, target)}%` }}
      />
    </div>
  )
}

/** Uno de los tres macros de la fila de abajo: nombre, consumido sobre meta, y avance. */
function MacroStat({
  label,
  consumed,
  target,
}: {
  label: string
  consumed: number
  target: number | null
}) {
  return (
    <div className="nutrition-summary-macro">
      <span className="nutrition-summary-macro-label">{label}</span>
      <p className="nutrition-summary-macro-value">
        <strong>{formatSummaryAmount(consumed)}</strong>
        {target !== null && <span> / {formatSummaryAmount(target)}</span>}
        <span className="nutrition-summary-unit"> g</span>
      </p>
      <ProgressBar consumed={consumed} target={target} />
    </div>
  )
}

/**
 * El resumen del día: las calorías mandan y por eso van solas arriba, grandes y
 * centradas; los tres macros quedan abajo repartidos en columnas.
 *
 * Los totales van redondeados a propósito: acá se mira de reojo cuánto queda,
 * no se pesa nada.
 */
function DaySummary({
  totals,
  plan,
}: {
  totals: MacroTotals
  plan: NutritionGoalPlan | null
}) {
  return (
    <section className="nutrition-summary">
      <span className="nutrition-summary-label">kcal</span>
      <p className="nutrition-summary-value">
        <strong>{formatSummaryAmount(totals.calories)}</strong>
        {plan && <span> / {formatSummaryAmount(plan.targetCalories)}</span>}
      </p>
      <ProgressBar consumed={totals.calories} target={plan?.targetCalories ?? null} />

      <div className="nutrition-summary-macros">
        <MacroStat label="Proteínas" consumed={totals.proteinG} target={plan?.targetProteinG ?? null} />
        <MacroStat label="Carbs" consumed={totals.carbsG} target={plan?.targetCarbsG ?? null} />
        <MacroStat label="Grasas" consumed={totals.fatG} target={plan?.targetFatG ?? null} />
      </div>
    </section>
  )
}

/** La fecha del panel, en la misma forma que el resto de la app la escribe. */
function formatDateSubtitle(date: Date): string {
  const weekday = date.toLocaleDateString('es-CL', { weekday: 'long' })
  const month = date.toLocaleDateString('es-CL', { month: 'long' })
  return `${weekday} ${date.getDate()} de ${month}`
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

  const dayTotals = getEntryMacroTotals(entries ?? [])
  const activePlan = findActivePlan(goalPlans ?? [], dateKey)

  const weekDayStatuses = days.map((date) => {
    const key = toDateKey(date)
    const dayEntries = (weekEntries ?? []).filter((e) => e.date === key)
    const totals: MacroTotals = getEntryMacroTotals(dayEntries)
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

      <DaySummary totals={dayTotals} plan={activePlan ?? null} />

      {/* El agua es un total del día, como los macros, no una comida: va antes
          de las secciones y no entre ellas. */}
      <WaterSection dateKey={dateKey} />

      {sections?.map((section) => {
        const sectionEntries = (entries ?? [])
          .filter((e: NutritionEntry) => e.sectionId === section.id)
          .sort((a, b) => a.order - b.order)
        const sectionTotals = getEntryMacroTotals(sectionEntries)
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
                      checked={entry.checked !== false}
                      onToggleChecked={() => void toggleEntryChecked(entry.id)}
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
            {/* El "+" no desaparece al abrir: el panel flota por encima. */}
            <button
              type="button"
              className="nutrition-add-pill"
              aria-label={`Agregar a ${section.name}`}
              onClick={() => setAddingToSectionId(section.id)}
            >
              +
            </button>
            {addingToSectionId === section.id && (
              <AddEntryForm
                foods={foods ?? []}
                title={`Agregar a ${section.name}`}
                subtitle={formatDateSubtitle(selectedDate)}
                onAddFood={async (foodId, quantity, notes) => {
                  await addFoodEntry({ date: dateKey, sectionId: section.id, foodId, quantity, notes })
                }}
                onAddManual={async (input) => {
                  await addManualEntry({ date: dateKey, sectionId: section.id, ...input })
                }}
                onDone={() => setAddingToSectionId(null)}
              />
            )}
          </section>
        )
      })}

      <button type="button" className="finance-add-button" onClick={() => setShowNewSection(true)}>
        + Agregar sección
      </button>

      {showNewSection && (
        <BottomSheet title="Nueva sección" onClose={() => setShowNewSection(false)}>
          <form onSubmit={handleCreateSection} className="entity-form" autoComplete="off">
          <label>
            Nombre de la sección
            <input
              autoComplete="off"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Ej. Snack 1"
              required
            />
          </label>
          <button type="submit">Crear</button>
          <button type="button" onClick={() => setShowNewSection(false)}>
            Cancelar
          </button>
          </form>
        </BottomSheet>
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
