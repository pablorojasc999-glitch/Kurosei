import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import {
  createExercise,
  createMuscleGroup,
  softDeleteExercise,
} from '../db/trainingRepository'
import type { ExerciseCategory, ExerciseType } from '../domain/types'

interface ContributionRow {
  muscleGroupId: string
  percentage: number
}

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

  const [newGroupName, setNewGroupName] = useState('')
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [exerciseCategory, setExerciseCategory] =
    useState<ExerciseCategory | ''>('')
  const [rows, setRows] = useState<ContributionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [groupError, setGroupError] = useState<string | null>(null)

  async function handleAddMuscleGroup(e: React.FormEvent) {
    e.preventDefault()
    setGroupError(null)
    if (!newGroupName.trim()) return
    try {
      await createMuscleGroup(newGroupName.trim())
      setNewGroupName('')
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  function addRow() {
    if (!muscleGroups?.length) return
    setRows((prev) => [
      ...prev,
      { muscleGroupId: muscleGroups[0].id, percentage: 0 },
    ])
  }

  function updateRow(index: number, patch: Partial<ContributionRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleAddExercise(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createExercise({
        name: exerciseName.trim(),
        type: exerciseType,
        category: exerciseCategory || null,
        muscleContributions: rows,
      })
      setExerciseName('')
      setExerciseType('strength')
      setExerciseCategory('')
      setRows([])
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
        <h2>Grupos musculares</h2>
        <form onSubmit={handleAddMuscleGroup} className="inline-form">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Ej. Pecho"
          />
          <button type="submit">Agregar</button>
        </form>
        {groupError && <p className="error">{groupError}</p>}
        <ul className="chip-list">
          {muscleGroups?.map((g) => (
            <li key={g.id} className="chip">
              {g.name}
            </li>
          ))}
        </ul>
      </section>

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
              <h3>% de contribución por grupo muscular</h3>
              {rows.map((row, i) => (
                <div key={i} className="contribution-row">
                  <select
                    value={row.muscleGroupId}
                    onChange={(e) =>
                      updateRow(i, { muscleGroupId: e.target.value })
                    }
                  >
                    {muscleGroups?.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.percentage}
                    onChange={(e) =>
                      updateRow(i, { percentage: Number(e.target.value) })
                    }
                  />
                  <span>%</span>
                  <button type="button" onClick={() => removeRow(i)}>
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRow}
                disabled={!muscleGroups?.length}
              >
                + Agregar grupo muscular
              </button>
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
                        {muscleGroupName(c.muscleGroupId)} {c.percentage}%
                      </span>
                    ))}
                </div>
              </div>
              <button
                type="button"
                className="btn-danger"
                onClick={() => softDeleteExercise(ex.id)}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
