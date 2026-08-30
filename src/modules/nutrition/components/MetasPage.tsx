import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  createGoalPlan,
  listGoalPlans,
  softDeleteGoalPlan,
  updateGoalPlan,
  type GoalPlanInput,
} from '../db/nutritionRepository'
import type { NutritionGoalPlan } from '../domain/types'
import { formatNutrient } from '../lib/nutrients'

interface FormState {
  name: string
  startDate: string
  endDate: string
  ongoing: boolean
  targetCalories: string
  targetProteinG: string
  targetCarbsG: string
  targetFatG: string
  targetWaterMl: string
}

function emptyForm(): FormState {
  return {
    name: '',
    startDate: '',
    endDate: '',
    ongoing: true,
    targetCalories: '',
    targetProteinG: '',
    targetCarbsG: '',
    targetFatG: '',
    targetWaterMl: '',
  }
}

function planToForm(plan: NutritionGoalPlan): FormState {
  return {
    name: plan.name,
    startDate: plan.startDate,
    endDate: plan.endDate ?? '',
    ongoing: plan.endDate === null,
    targetCalories: String(plan.targetCalories),
    targetProteinG: String(plan.targetProteinG),
    targetCarbsG: String(plan.targetCarbsG),
    targetFatG: String(plan.targetFatG),
    targetWaterMl: String(plan.targetWaterMl),
  }
}

function formatDateRange(plan: NutritionGoalPlan): string {
  const start = plan.startDate.split('-').reverse().join('/')
  if (plan.endDate === null) return `Desde ${start}`
  const end = plan.endDate.split('-').reverse().join('/')
  return `${start} – ${end}`
}

export function MetasPage() {
  const plans = useLiveQuery(() => listGoalPlans(), [])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreateForm() {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
    setShowForm(true)
  }

  function openEditForm(plan: NutritionGoalPlan) {
    setEditingId(plan.id)
    setForm(planToForm(plan))
    setError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        if (!form.name.trim()) throw new Error('El nombre no puede estar vacío.')
        if (!form.startDate) throw new Error('La fecha de inicio es obligatoria.')
        if (!form.ongoing && !form.endDate) {
          throw new Error('Elegí una fecha de fin o marcá el plan como en curso.')
        }
        if (!form.ongoing && form.endDate < form.startDate) {
          throw new Error('La fecha de fin no puede ser anterior a la de inicio.')
        }
        const parsed = {
          targetCalories: Number(form.targetCalories),
          targetProteinG: Number(form.targetProteinG),
          targetCarbsG: Number(form.targetCarbsG),
          targetFatG: Number(form.targetFatG),
          targetWaterMl: Number(form.targetWaterMl),
        }
        if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0)) {
          throw new Error('Las metas de calorías, macros y agua son obligatorias.')
        }
        const input: GoalPlanInput = {
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.ongoing ? null : form.endDate,
          ...parsed,
        }
        if (editingId) {
          await updateGoalPlan(editingId, input)
        } else {
          await createGoalPlan(input)
        }
        setShowForm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  return (
    <div className="page">
      <h1>Metas</h1>
      <p className="contributions-hint">
        Definí metas de calorías, macros y agua para un período — como un mesociclo, pero para
        nutrición. Registro compara el día contra la meta vigente en esa fecha.
      </p>

      {showForm ? (
        <form onSubmit={handleSubmit} className="entity-form">
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Ej. Volumen"
              autoFocus
              required
            />
          </label>
          <label>
            Fecha de inicio
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
              required
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.ongoing}
              onChange={(e) => updateField('ongoing', e.target.checked)}
            />
            Sin fecha de fin (en curso)
          </label>
          {!form.ongoing && (
            <label>
              Fecha de fin
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                required={!form.ongoing}
              />
            </label>
          )}
          <label>
            Calorías (kcal/día)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={form.targetCalories}
              onChange={(e) => updateField('targetCalories', e.target.value)}
              required
            />
          </label>
          <label>
            Proteínas (g/día)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={form.targetProteinG}
              onChange={(e) => updateField('targetProteinG', e.target.value)}
              required
            />
          </label>
          <label>
            Carbohidratos (g/día)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={form.targetCarbsG}
              onChange={(e) => updateField('targetCarbsG', e.target.value)}
              required
            />
          </label>
          <label>
            Grasas (g/día)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={form.targetFatG}
              onChange={(e) => updateField('targetFatG', e.target.value)}
              required
            />
          </label>
          <label>
            Agua (ml/día)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              min={0}
              value={form.targetWaterMl}
              onChange={(e) => updateField('targetWaterMl', e.target.value)}
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {editingId ? 'Guardar cambios' : 'Crear meta'}
          </button>
          <button type="button" onClick={() => setShowForm(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="finance-add-button" onClick={openCreateForm}>
          + Nueva meta
        </button>
      )}

      <div className="nutrition-goal-list">
        {plans?.map((plan) => (
          <div key={plan.id} className="nutrition-goal-card">
            <div className="nutrition-goal-card-header">
              <div>
                <strong>{plan.name}</strong>
                <span className="finance-transaction-subtitle">{formatDateRange(plan)}</span>
              </div>
              <div className="nutrition-goal-card-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Editar meta"
                  onClick={() => openEditForm(plan)}
                >
                  ✎
                </button>
                <ConfirmDeleteButton
                  variant="icon"
                  className="icon-button"
                  label="Eliminar meta"
                  confirmMessage={`¿Eliminar "${plan.name}"?`}
                  onConfirm={() => softDeleteGoalPlan(plan.id)}
                />
              </div>
            </div>
            <div className="nutrition-goal-card-targets">
              <span>{formatNutrient(plan.targetCalories)} kcal</span>
              <span>P {formatNutrient(plan.targetProteinG)} g</span>
              <span>C {formatNutrient(plan.targetCarbsG)} g</span>
              <span>G {formatNutrient(plan.targetFatG)} g</span>
              <span>{formatNutrient(plan.targetWaterMl / 1000)} L agua</span>
            </div>
          </div>
        ))}
        {plans?.length === 0 && (
          <p className="empty-hint">Todavía no creaste ninguna meta.</p>
        )}
      </div>
    </div>
  )
}
