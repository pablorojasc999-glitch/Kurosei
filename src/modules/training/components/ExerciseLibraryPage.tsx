import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/db/database'
import {
  createExercise,
  ensureCanonicalMuscleGroups,
  softDeleteExercise,
} from '../db/trainingRepository'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import type { ExerciseCategory, ExerciseType, MuscleGroup } from '../domain/types'

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Sentadilla',
  bench: 'Banca',
  deadlift: 'Peso muerto',
}

export function ExerciseLibraryPage() {
  const muscleGroups = useLiveQuery(
    () => db.training_muscle_groups.filter((g) => g.deletedAt === null).sortBy('name'),
    [],
  )
  const exercises = useLiveQuery(
    () => db.training_exercises.filter((e) => e.deletedAt === null).sortBy('name'),
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
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [exerciseCategory, setExerciseCategory] =
    useState<ExerciseCategory | ''>('')
  const [factors, setFactors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureCanonicalMuscleGroups().then(setCanonicalGroups)
  }, [])

  function updateFactor(muscleGroupId: string, value: string) {
    setFactors((prev) => ({ ...prev, [muscleGroupId]: value }))
  }

  async function handleAddExercise(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const muscleContributions = canonicalGroups
        .map((g) => ({
          muscleGroupId: g.id,
          factor: Number(factors[g.id]) || 0,
        }))
        .filter((c) => c.factor > 0)

      await createExercise({
        name: exerciseName.trim(),
        type: exerciseType,
        category: exerciseCategory || null,
        muscleContributions,
      })
      setExerciseName('')
      setExerciseType('strength')
      setExerciseCategory('')
      setFactors({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  function muscleGroupName(id: string): string {
    return muscleGroups?.find((g) => g.id === id)?.name ?? '?'
  }

  return (
    <div className="page">
      <h1>Biblioteca de ejercicios</h1>

      <section>
        <h2>Nuevo ejercicio</h2>
        <form onSubmit={handleAddExercise} className="exercise-form">
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
                Ej. sentadilla: cuádriceps 1, glúteos 1, isquios 0.5. Dejá en
                0 los grupos que no participan.
              </p>
              {canonicalGroups.map((g) => (
                <div key={g.id} className="contribution-row">
                  <span className="contribution-row-label">{g.name}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={factors[g.id] ?? ''}
                    onChange={(e) => updateFactor(g.id, e.target.value)}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit">Guardar ejercicio</button>
        </form>
      </section>

      <section>
        <h2>Ejercicios</h2>
        <ul className="exercise-list">
          {exercises?.map((ex) => (
            <li key={ex.id} className="exercise-item">
              <div>
                <strong>{ex.name}</strong>{' '}
                <span className="tag">
                  {ex.type === 'strength' ? 'Fuerza' : 'Cardio'}
                </span>
                {ex.category && (
                  <span className="tag">{CATEGORY_LABELS[ex.category]}</span>
                )}
                <div className="contribution-summary">
                  {contributions
                    ?.filter((c) => c.exerciseId === ex.id)
                    .map((c) => (
                      <span key={c.id} className="contribution-chip">
                        {muscleGroupName(c.muscleGroupId)} ×{c.factor}
                      </span>
                    ))}
                </div>
              </div>
              <ConfirmDeleteButton
                onConfirm={() => softDeleteExercise(ex.id)}
                confirmMessage={`¿Eliminar "${ex.name}"?`}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
