import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { toDateKey } from '../../training/lib/calendarGrid'
import {
  applyTemplateToDate,
  listMealSections,
  listMealTemplates,
  listTemplateEntries,
  softDeleteMealTemplate,
} from '../db/nutritionRepository'
import { sumMacros } from '../lib/macros'

export function PlantillasPage() {
  const templates = useLiveQuery(() => listMealTemplates(), [])
  const sections = useLiveQuery(() => listMealSections(), [])
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
  const templateEntries = useLiveQuery(
    () => (openTemplateId ? listTemplateEntries(openTemplateId) : Promise.resolve([])),
    [openTemplateId],
  )
  const [applyDate, setApplyDate] = useState(() => toDateKey(new Date()))
  const [applied, setApplied] = useState(false)

  const sectionNameById = new Map((sections ?? []).map((s) => [s.id, s.name]))
  const openTemplate = templates?.find((t) => t.id === openTemplateId)

  async function handleApply() {
    if (!openTemplateId) return
    await applyTemplateToDate(openTemplateId, applyDate)
    setApplied(true)
  }

  if (openTemplateId && openTemplate) {
    const totals = sumMacros(templateEntries ?? [])
    const bySection = new Map<string, typeof templateEntries>()
    for (const entry of templateEntries ?? []) {
      const list = bySection.get(entry.sectionId) ?? []
      list.push(entry)
      bySection.set(entry.sectionId, list)
    }

    return (
      <div className="page">
        <button
          type="button"
          onClick={() => {
            setOpenTemplateId(null)
            setApplied(false)
          }}
        >
          ‹ Volver a plantillas
        </button>
        <h1>
          {openTemplate.emoji} {openTemplate.name}
        </h1>
        <div className="finance-summary-row">
          <div className="finance-summary-card">
            <span>Calorías</span>
            <strong>{Math.round(totals.calories)}</strong>
          </div>
          <div className="finance-summary-card">
            <span>Proteínas</span>
            <strong>{Math.round(totals.proteinG)} g</strong>
          </div>
          <div className="finance-summary-card">
            <span>Carbos</span>
            <strong>{Math.round(totals.carbsG)} g</strong>
          </div>
          <div className="finance-summary-card">
            <span>Grasas</span>
            <strong>{Math.round(totals.fatG)} g</strong>
          </div>
        </div>

        {[...bySection.entries()].map(([sectionId, sectionEntries]) => (
          <section key={sectionId} className="nutrition-meal-section">
            <div className="nutrition-meal-section-header">
              <h2>{sectionNameById.get(sectionId) ?? 'Sección eliminada'}</h2>
            </div>
            <div className="nutrition-entry-list">
              {(sectionEntries ?? []).map((entry) => (
                <div key={entry.id} className="nutrition-entry-row">
                  <span className="nutrition-entry-info">
                    <strong>{entry.kind === 'manual' ? entry.manualName : '(alimento)'}</strong>
                  </span>
                  <span className="nutrition-entry-macros">{Math.round(entry.calories)} kcal</span>
                </div>
              ))}
            </div>
          </section>
        ))}

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
          {applied && (
            <p className="contributions-hint">Se agregó a Registro del {applyDate}.</p>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Plantillas</h1>
      <p className="contributions-hint">
        Guardá el día de Registro que quieras reutilizar como plantilla, y cargala en cualquier
        otra fecha.
      </p>
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
          <p className="empty-hint">
            Todavía no guardaste ninguna plantilla. Andá a Registro y usá "Guardar este día como
            plantilla".
          </p>
        )}
      </div>
    </div>
  )
}
