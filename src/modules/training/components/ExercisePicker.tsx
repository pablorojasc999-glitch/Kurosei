import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../../shared/db/database'
import { searchExercises } from '../lib/exerciseSearch'
import type { MuscleInvolvement } from '../lib/exerciseSearch'

interface ExercisePickerProps {
  value: string
  onChange: (exerciseId: string) => void
}

/**
 * Elegir un ejercicio buscando por nombre o por músculo.
 *
 * Era un `<select>` con la biblioteca entera en orden alfabético: para armar
 * "algo de hombro" había que acordarse de los nombres y recorrer la lista
 * completa. Acá se escribe "hombro" y salen ordenados por cuánto lo involucran.
 *
 * La consulta se queda escrita después de elegir a propósito: cuando se arma un
 * día se suelen agregar varios ejercicios del mismo grupo, y volver a escribir
 * "hombro" cada vez sería peor que dejarlo.
 */
export function ExercisePicker({ value, onChange }: ExercisePickerProps) {
  const [query, setQuery] = useState('')

  const data = useLiveQuery(async () => {
    const exercises = await db.training_exercises
      .filter((e) => e.deletedAt === null)
      .toArray()
    const groups = await db.training_muscle_groups
      .filter((g) => g.deletedAt === null)
      .toArray()
    const contributions = await db.training_exercise_muscle_contributions
      .filter((c) => c.deletedAt === null)
      .toArray()
    const nameOf = new Map(groups.map((g) => [g.id, g.name]))
    const involvements: MuscleInvolvement[] = contributions.flatMap((c) => {
      const groupName = nameOf.get(c.muscleGroupId)
      // Una contribución a un grupo borrado no se puede buscar por nombre.
      return groupName ? [{ exerciseId: c.exerciseId, groupName, factor: c.factor }] : []
    })
    return { exercises, involvements }
  }, [])

  const results = useMemo(
    () => (data ? searchExercises(query, data.exercises, data.involvements) : []),
    [data, query],
  )

  return (
    <div className="exercise-picker">
      <input
        type="search"
        autoComplete="off"
        className="exercise-picker-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre o músculo"
        aria-label="Buscar ejercicio por nombre o grupo muscular"
      />
      {results.length === 0 ? (
        <p className="empty-hint">
          {data === undefined
            ? 'Cargando ejercicios…'
            : query.trim() === ''
              ? 'Todavía no hay ejercicios en la biblioteca.'
              : `Ningún ejercicio ni músculo calza con "${query.trim()}".`}
        </p>
      ) : (
        <ul className="exercise-picker-list">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={
                  r.id === value
                    ? 'exercise-option exercise-option--selected'
                    : 'exercise-option'
                }
                aria-pressed={r.id === value}
                onClick={() => onChange(r.id === value ? '' : r.id)}
              >
                <span className="exercise-option-name">{r.name}</span>
                {r.matchedGroup && (
                  <span className="exercise-option-factor">
                    {r.matchedGroup.name} {r.matchedGroup.factor.toFixed(1)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
