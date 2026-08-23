import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/db/database'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  createExercise,
  ensureCanonicalMuscleGroups,
  softDeleteExercise,
  updateExercise,
} from '../db/trainingRepository'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import type { Exercise, ExerciseCategory, ExerciseType, MuscleGroup } from '../domain/types'

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Sentadilla',
  bench: 'Banca',
  deadlift: 'Peso muerto',
}

// Factor de contribución: solo décimas entre 0,1 y 1,0. El valor va con
// punto (parseable con Number()); la etiqueta se muestra con coma, como
// corresponde al formato decimal chileno.
const FACTOR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const value = ((i + 1) / 10).toFixed(1)
  return { value, label: value.replace('.', ',') }
})

export function ExerciseLibraryPage() {
  const exercises = useLiveQuery(
    () =>
      db.training_exercises
        .filter((e) => e.deletedAt === null)
        .toArray()
        .then((list) => list.sort((a, b) => a.name.localeCompare(b.name, 'es'))),
    [],
  )
  const contributions = useLiveQuery(
    () =>
      db.training_exercise_muscle_contributions
        .filter((c) => c.deletedAt === null)
        .toArray(),
    [],
  )

  const [canonicalGroups, setCanonicalGroups] = useState<MuscleGroup[]>([])
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [exerciseCategory, setExerciseCategory] =
    useState<ExerciseCategory | ''>('')
  const [factors, setFactors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { isSubmitting, guard } = useSubmitGuard()

  useEffect(() => {
    ensureCanonicalMuscleGroups().then(setCanonicalGroups)
  }, [])

  function updateFactor(muscleGroupId: string, value: string) {
    setFactors((prev) => ({ ...prev, [muscleGroupId]: value }))
  }

  function resetForm() {
    setEditingExerciseId(null)
    setExerciseName('')
    setExerciseType('strength')
    setExerciseCategory('')
    setFactors({})
    setError(null)
  }

  function startEdit(ex: Exercise) {
    setEditingExerciseId(ex.id)
    setExerciseName(ex.name)
    setExerciseType(ex.type)
    setExerciseCategory(ex.category ?? '')
    const nextFactors: Record<string, string> = {}
    for (const c of contributions ?? []) {
      // Must match a FACTOR_OPTIONS value exactly (e.g. "1.0", not "1")
      // or the <select> shows as unselected even though the factor is saved.
      if (c.exerciseId === ex.id) nextFactors[c.muscleGroupId] = c.factor.toFixed(1)
    }
    setFactors(nextFactors)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        const muscleContributions = canonicalGroups
          .map((g) => ({
            muscleGroupId: g.id,
            factor: Number(factors[g.id]) || 0,
          }))
          .filter((c) => c.factor > 0)

        const input = {
          name: exerciseName.trim(),
          type: exerciseType,
          category: exerciseCategory || null,
          muscleContributions,
        }

        if (editingExerciseId) {
          await updateExercise(editingExerciseId, input)
        } else {
          await createExercise(input)
        }
        resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const filteredExercises = exercises?.filter((ex) =>
    ex.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="page">
      <h1>Biblioteca de ejercicios</h1>

      <section>
        <h2>{editingExerciseId ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>
        <form onSubmit={handleSubmit} className="exercise-form">
          <label>
            Nombre
            <input
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              required
            />
          </label>

          <label>
            Tipo
            <select
              value={exerciseType}
              onChange={(e) => setExerciseType(e.target.value as ExerciseType)}
            >
              <option value="strength">Fuerza</option>
              <option value="cardio">Cardio</option>
            </select>
          </label>

          {exerciseType === 'strength' && (
            <label>
              Categoría (opcional)
              <select
                value={exerciseCategory}
                onChange={(e) =>
                  setExerciseCategory(e.target.value as ExerciseCategory | '')
                }
              >
                <option value="">Ninguna</option>
                <option value="squat">Sentadilla</option>
                <option value="bench">Banca</option>
                <option value="deadlift">Peso muerto</option>
              </select>
            </label>
          )}

          {exerciseType === 'strength' && (
            <div className="contributions">
              <h3>Factor de contribución por grupo muscular</h3>
              <p className="contributions-hint">
                Ej. sentadilla: cuádriceps 1,0, glúteos 1,0, isquios 0,5. Dejá
                "Sin participación" en los grupos que no participan.
              </p>
              {canonicalGroups.map((g) => (
                <div key={g.id} className="contribution-row">
                  <span className="contribution-row-label">{g.name}</span>
                  <select
                    value={factors[g.id] ?? ''}
                    onChange={(e) => updateFactor(g.id, e.target.value)}
                  >
                    <option value="">Sin participación</option>
                    {FACTOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={isSubmitting}>
            {editingExerciseId ? 'Guardar cambios' : 'Guardar ejercicio'}
          </button>
          {editingExerciseId && (
            <button type="button" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </form>
      </section>

      <section>
        <h2>Ejercicios</h2>
        <input
          type="search"
          className="exercise-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ejercicio..."
        />
        <ul className="exercise-list">
          {filteredExercises?.map((ex) => (
            <li key={ex.id} className="exercise-item">
              <div>
                <strong>{ex.name}</strong>{' '}
                <span className="tag">
                  {ex.type === 'strength' ? 'Fuerza' : 'Cardio'}
                </span>
                {ex.category && (
                  <span className="tag">{CATEGORY_LABELS[ex.category]}</span>
                )}
              </div>
              <div className="exercise-item-actions">
                <button type="button" onClick={() => startEdit(ex)}>
                  Editar
                </button>
                <ConfirmDeleteButton
                  onConfirm={() => softDeleteExercise(ex.id)}
                  confirmMessage={`¿Eliminar "${ex.name}"?`}
                />
              </div>
            </li>
          ))}
          {filteredExercises?.length === 0 && (
            <p className="empty-hint">Ningún ejercicio coincide con la búsqueda.</p>
          )}
        </ul>
      </section>
    </div>
  )
}
