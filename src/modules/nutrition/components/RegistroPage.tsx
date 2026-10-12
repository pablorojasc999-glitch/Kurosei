import { useCallback, useMemo, useState } from 'react'
import { addDays, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { useSupabaseSession } from '../../../shared/hooks/useSupabaseSession'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
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
import { scaleMacros, type MacroTotals } from '../lib/macros'
import { formatNutrient, formatSummaryAmount } from '../lib/nutrients'
import { moveItem } from '../lib/reorder'
import { suggestionWindow } from '../lib/suggestedFoods'
import { useEntryDragReorder } from '../lib/useEntryDragReorder'
import { weekDates } from '../lib/weekStrip'
import { DayCloseCard } from '../../closing/components/DayCloseCard'
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
  const session = useSupabaseSession()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const dateKey = toDateKey(selectedDate)
  // Memoizado para que la consulta de abajo tenga una clave de verdad estable
  // por semana, en vez de un array nuevo (y sus fechas derivadas) en cada
  // render.
  const days = useMemo(() => weekDates(selectedDate), [selectedDate])
  const weekStartKey = toDateKey(days[0])
  const weekEndKey = toDateKey(days[6])

  // Los registros del día (y de la semana, para los puntitos del selector)
  // cambian con casi cada acción de esta pantalla, así que viven en su propia
  // consulta — separados de secciones/metas/alimentos/plantillas, que acá
  // nunca se editan y pedirlos de nuevo en cada alimento registrado sería
  // tráfico de sobra.
  const {
    data: entryData,
    error: loadError,
    refresh,
    setOptimistic: setEntryData,
  } = useRemoteQuery(
    useCallback(async () => {
      if (!session) return undefined
      const [entries, weekEntries] = await Promise.all([
        listEntriesForDate(dateKey),
        listEntriesForDateRange(weekStartKey, weekEndKey),
      ])
      return { entries, weekEntries }
    }, [session, dateKey, weekStartKey, weekEndKey]),
  )
  const entries = entryData?.entries
  const weekEntries = entryData?.weekEntries

  // Fija al montar, no en cada render: si dependiera de `new Date()` suelto,
  // la consulta de abajo se rehacía en cada tecla del buscador de Agregar.
  const recentWindow = useMemo(() => suggestionWindow(), [])

  const { data: referenceData, refresh: refreshReferenceData } = useRemoteQuery(
    useCallback(async () => {
      if (!session) return undefined
      const [sections, goalPlans, foods, templates, recentEntries] = await Promise.all([
        listMealSections(),
        listGoalPlans(),
        listFoods(),
        listMealTemplates(),
        listEntriesForDateRange(recentWindow.from, recentWindow.to),
      ])
      return { sections, goalPlans, foods, templates, recentEntries }
    }, [session, recentWindow]),
  )
  const sections = referenceData?.sections
  const goalPlans = referenceData?.goalPlans
  const foods = referenceData?.foods
  const templates = referenceData?.templates
  const recentEntries = referenceData?.recentEntries
  const foodById = new Map((foods ?? []).map((f) => [f.id, f]))

  /**
   * Las tres formas en que un alta/edición/baja de un registro se refleja al
   * toque, antes de que el servidor confirme nada — `entries` y
   * `weekEntries` se tocan juntos porque el día que se está mirando siempre
   * cae dentro de la semana que muestra el selector. `current` existe
   * siempre que se llega a llamarlas: sólo corren con el registro ya
   * cargado en pantalla.
   */
  function addEntryOptimistically(entry: NutritionEntry) {
    setEntryData((current) => ({
      entries: [...current!.entries, entry],
      weekEntries: [...current!.weekEntries, entry],
    }))
  }
  function updateEntryOptimistically(entryId: string, updater: (e: NutritionEntry) => NutritionEntry) {
    setEntryData((current) => ({
      entries: current!.entries.map((e) => (e.id === entryId ? updater(e) : e)),
      weekEntries: current!.weekEntries.map((e) => (e.id === entryId ? updater(e) : e)),
    }))
  }
  function removeEntryOptimistically(entryId: string) {
    setEntryData((current) => ({
      entries: current!.entries.filter((e) => e.id !== entryId),
      weekEntries: current!.weekEntries.filter((e) => e.id !== entryId),
    }))
  }

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
    // Se suelta y ya queda en su lugar nuevo, calculado igual que lo haría el
    // servidor — sin esto, el ítem soltado volvía a su posición vieja hasta
    // que `refresh()` terminaba de confirmar el reordenamiento.
    const changed = moveItem(entries ?? [], entryId, targetSectionId, targetIndex)
    if (changed.length > 0) {
      const changedById = new Map(changed.map((c) => [c.id, c]))
      const apply = (list: NutritionEntry[]) =>
        list.map((e) => {
          const c = changedById.get(e.id)
          return c ? { ...e, sectionId: c.sectionId, order: c.order } : e
        })
      setEntryData((current) => ({
        entries: apply(current!.entries),
        weekEntries: apply(current!.weekEntries),
      }))
    }
    void moveEntry(entryId, targetSectionId, targetIndex).finally(refresh)
  })

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault()
    const name = newSectionName.trim()
    if (!name) return
    await createMealSection(name)
    setNewSectionName('')
    setShowNewSection(false)
    await refreshReferenceData()
  }

  async function handleApplyTemplate(templateId: string) {
    await applyTemplateToDate(templateId, dateKey)
    setShowTemplatePicker(false)
    await refresh()
  }

  // Ya no hay copia local: sin sesión no hay a quién pedirle el registro.
  if (session === undefined) {
    return (
      <div className="page">
        <h1>Registro</h1>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="page">
        <h1>Registro</h1>
        <p className="empty-hint">
          Iniciá sesión (el ícono de arriba a la derecha) para ver y editar tu registro.
        </p>
      </div>
    )
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
      {loadError && <p className="error">No se pudo cargar: {loadError.message}</p>}

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
                      onToggleChecked={() => {
                        updateEntryOptimistically(entry.id, (e) => ({
                          ...e,
                          checked: e.checked === false,
                          updatedAt: nowIso(),
                        }))
                        void toggleEntryChecked(entry.id).finally(refresh)
                      }}
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
                      onDelete={() => {
                        removeEntryOptimistically(entry.id)
                        void softDeleteEntry(entry.id).finally(refresh)
                      }}
                    />
                    {expandedEntryId === entry.id &&
                      (entry.kind === 'manual' || entryFood) && (
                        <EntryEditor
                          entry={entry}
                          food={entryFood}
                          onSaveQuantity={async (quantity) => {
                            if (entryFood) {
                              const macros = scaleMacros(entryFood, quantity)
                              updateEntryOptimistically(entry.id, (e) => ({
                                ...e,
                                quantity,
                                ...macros,
                                updatedAt: nowIso(),
                              }))
                            }
                            setExpandedEntryId(null)
                            try {
                              await updateFoodEntryQuantity(entry.id, quantity)
                            } finally {
                              await refresh()
                            }
                          }}
                          onSaveManual={async (input) => {
                            updateEntryOptimistically(entry.id, (e) => ({
                              ...e,
                              ...input,
                              notes: entry.notes,
                              updatedAt: nowIso(),
                            }))
                            setExpandedEntryId(null)
                            try {
                              await updateManualEntry(entry.id, { ...input, notes: entry.notes })
                            } finally {
                              await refresh()
                            }
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
                recentEntries={recentEntries ?? []}
                recentSince={recentWindow.recentSince}
                title={`Agregar a ${section.name}`}
                subtitle={formatDateSubtitle(selectedDate)}
                onAddFood={async (foodId, quantity, notes) => {
                  const food = (foods ?? []).find((f) => f.id === foodId)
                  if (!food) throw new Error('Alimento no encontrado.')
                  const siblings = (entries ?? []).filter((e) => e.sectionId === section.id)
                  const nextOrder = siblings.length ? Math.max(...siblings.map((e) => e.order)) + 1 : 0
                  const timestamp = nowIso()
                  const id = generateId()
                  addEntryOptimistically({
                    id,
                    date: dateKey,
                    sectionId: section.id,
                    order: nextOrder,
                    kind: 'food',
                    foodId,
                    quantity,
                    manualName: '',
                    notes,
                    ...scaleMacros(food, quantity),
                    checked: false,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    deletedAt: null,
                  })
                  // Sin esperar: el panel ya cierra con la fila puesta en la
                  // lista — si la escritura falla, el refresh() la saca sola.
                  void addFoodEntry({ id, date: dateKey, sectionId: section.id, foodId, quantity, notes }).finally(
                    refresh,
                  )
                }}
                onAddManual={async (input) => {
                  const siblings = (entries ?? []).filter((e) => e.sectionId === section.id)
                  const nextOrder = siblings.length ? Math.max(...siblings.map((e) => e.order)) + 1 : 0
                  const timestamp = nowIso()
                  const id = generateId()
                  addEntryOptimistically({
                    id,
                    date: dateKey,
                    sectionId: section.id,
                    order: nextOrder,
                    kind: 'manual',
                    foodId: null,
                    quantity: null,
                    manualName: input.manualName,
                    notes: input.notes,
                    calories: input.calories,
                    proteinG: input.proteinG,
                    carbsG: input.carbsG,
                    fatG: input.fatG,
                    checked: false,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    deletedAt: null,
                  })
                  void addManualEntry({ id, date: dateKey, sectionId: section.id, ...input }).finally(refresh)
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

      {/* Al final del día, no arriba: cerrar es lo último que se hace. */}
      <DayCloseCard
        date={toDateKey(selectedDate)}
        module="nutrition"
        prompt="¿Listo con la comida de este día?"
      />
    </div>
  )
}
