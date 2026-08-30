import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { toDateKey } from '../../training/lib/calendarGrid'
import {
  addFoodEntryToTemplate,
  addManualEntryToTemplate,
  applyTemplateToDate,
  createMealSection,
  createMealTemplate,
  listFoods,
  listMealSections,
  listMealTemplates,
  listTemplateEntries,
  moveTemplateEntry,
  softDeleteMealTemplate,
  softDeleteTemplateEntry,
  updateTemplateFoodEntryQuantity,
  updateTemplateManualEntry,
} from '../db/nutritionRepository'
import { sumMacros } from '../lib/macros'
import { formatNutrient } from '../lib/nutrients'
import { useEntryDragReorder } from '../lib/useEntryDragReorder'
import { AddEntryForm } from './AddEntryForm'
import { EntryEditor } from './EntryEditor'
import { EntryRow } from './EntryRow'

export function PlantillasPage() {
  const templates = useLiveQuery(() => listMealTemplates(), [])
  const sections = useLiveQuery(() => listMealSections(), [])
  const foods = useLiveQuery(() => listFoods(), [])

  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateEmoji, setNewTemplateEmoji] = useState('')

  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
  const templateEntries = useLiveQuery(
    () => (openTemplateId ? listTemplateEntries(openTemplateId) : Promise.resolve([])),
    [openTemplateId],
  )
  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null)
  const [showNewSection, setShowNewSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  const [applyDate, setApplyDate] = useState(() => toDateKey(new Date()))
  const [applied, setApplied] = useState(false)

  const openTemplate = templates?.find((t) => t.id === openTemplateId)

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
  } = useEntryDragReorder(templateEntries, sections, (entryId, targetSectionId, targetIndex) => {
    void moveTemplateEntry(entryId, targetSectionId, targetIndex)
  })

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault()
    const name = newTemplateName.trim()
    if (!name) return
    const template = await createMealTemplate(name, newTemplateEmoji.trim())
    setNewTemplateName('')
    setNewTemplateEmoji('')
    setShowNewTemplate(false)
    setOpenTemplateId(template.id)
  }

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault()
    const name = newSectionName.trim()
    if (!name) return
    await createMealSection(name)
    setNewSectionName('')
    setShowNewSection(false)
  }

  async function handleApply() {
    if (!openTemplateId) return
    await applyTemplateToDate(openTemplateId, applyDate)
    setApplied(true)
  }

  if (openTemplateId && openTemplate) {
    const totals = sumMacros(templateEntries ?? [])
    const foodById = new Map((foods ?? []).map((f) => [f.id, f]))

    return (
      <div className="page">
        <button type="button" onClick={() => setOpenTemplateId(null)}>
          ‹ Volver a plantillas
        </button>
        <h1>
          {openTemplate.emoji} {openTemplate.name}
        </h1>
        <div className="finance-summary-row">
          <div className="finance-summary-card">
            <span>Calorías</span>
            <strong>{formatNutrient(totals.calories)}</strong>
          </div>
          <div className="finance-summary-card">
            <span>Proteínas</span>
            <strong>{formatNutrient(totals.proteinG)} g</strong>
          </div>
          <div className="finance-summary-card">
            <span>Carbos</span>
            <strong>{formatNutrient(totals.carbsG)} g</strong>
          </div>
          <div className="finance-summary-card">
            <span>Grasas</span>
            <strong>{formatNutrient(totals.fatG)} g</strong>
          </div>
        </div>

        {sections?.map((section) => {
          const sectionEntries = (templateEntries ?? [])
            .filter((e) => e.sectionId === section.id)
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
                        onDelete={() => void softDeleteTemplateEntry(entry.id)}
                      />
                      {expandedEntryId === entry.id &&
                        (entry.kind === 'manual' || entryFood) && (
                          <EntryEditor
                            entry={entry}
                            food={entryFood}
                            onSaveQuantity={async (quantity) => {
                              await updateTemplateFoodEntryQuantity(entry.id, quantity)
                              setExpandedEntryId(null)
                            }}
                            onSaveManual={async (input) => {
                              await updateTemplateManualEntry(entry.id, {
                                ...input,
                                notes: entry.notes,
                              })
                              setExpandedEntryId(null)
                            }}
                          />
                        )}
                    </div>
                  )
                })}
                {sectionEntries.length === 0 && (
                  <p className="empty-hint">Sin alimentos todavía.</p>
                )}
              </div>
              {addingToSectionId === section.id ? (
                <AddEntryForm
                  foods={foods ?? []}
                  onAddFood={async (foodId, quantity, notes) => {
                    await addFoodEntryToTemplate({
                      templateId: openTemplateId,
                      sectionId: section.id,
                      foodId,
                      quantity,
                      notes,
                    })
                  }}
                  onAddManual={async (input) => {
                    await addManualEntryToTemplate({
                      templateId: openTemplateId,
                      sectionId: section.id,
                      ...input,
                    })
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
          <button
            type="button"
            className="finance-add-button"
            onClick={() => setShowNewSection(true)}
          >
            + Agregar sección
          </button>
        )}

        <section>
          <h2>Cargar a un día</h2>
          <form
            className="entity-form"
            onSubmit={(e) => {
              e.preventDefault()
              void handleApply()
            }}
          >
            <label>
              Fecha
              <input
                type="date"
                value={applyDate}
                onChange={(e) => {
                  setApplyDate(e.target.value)
                  setApplied(false)
                }}
                required
              />
            </label>
            <button type="submit">Cargar a este día</button>
          </form>
          {applied && <p className="contributions-hint">Se agregó a Registro del {applyDate}.</p>}
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Plantillas</h1>

      {showNewTemplate ? (
        <form onSubmit={handleCreateTemplate} className="entity-form">
          <label>
            Nombre
            <input
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="Ej. Día de entrenamiento"
              autoFocus
              required
            />
          </label>
          <label>
            Emoji (opcional)
            <input
              value={newTemplateEmoji}
              onChange={(e) => setNewTemplateEmoji(e.target.value)}
              placeholder="🏋️"
              maxLength={4}
            />
          </label>
          <button type="submit">Crear</button>
          <button type="button" onClick={() => setShowNewTemplate(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="finance-add-button"
          onClick={() => setShowNewTemplate(true)}
        >
          + Nueva plantilla
        </button>
      )}

      <div className="nutrition-template-grid">
        {templates?.map((template) => (
          <div key={template.id} className="nutrition-template-card">
            <ConfirmDeleteButton
              variant="icon"
              className="icon-button nutrition-template-delete"
              label="Eliminar plantilla"
              confirmMessage={`¿Eliminar "${template.name}"?`}
              onConfirm={() => softDeleteMealTemplate(template.id)}
            />
            <button
              type="button"
              className="nutrition-template-card-body"
              onClick={() => setOpenTemplateId(template.id)}
            >
              <span className="nutrition-template-card-emoji">{template.emoji || '📋'}</span>
              <span>{template.name}</span>
            </button>
          </div>
        ))}
        {templates?.length === 0 && (
          <p className="empty-hint">Todavía no creaste ninguna plantilla.</p>
        )}
      </div>
    </div>
  )
}
