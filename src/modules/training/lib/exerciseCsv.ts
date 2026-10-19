import { toCsv } from '../../../shared/lib/csv'
import type {
  Exercise,
  ExerciseCategory,
  ExerciseMuscleContribution,
  MuscleGroup,
} from '../domain/types'

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  squat: 'Sentadilla',
  bench: 'Banca',
  deadlift: 'Peso muerto',
}

/**
 * La biblioteca de ejercicios, una fila por ejercicio y una columna por grupo
 * muscular con su factor de contribución.
 *
 * Los grupos van como columnas y no como una lista dentro de una celda porque
 * es lo que permite filtrar y sumar en la hoja; una celda vacía es "no
 * participa", igual que el "Sin participación" del formulario.
 */
export function buildExerciseLibraryCsv(
  exercises: Exercise[],
  contributions: ExerciseMuscleContribution[],
  muscleGroups: MuscleGroup[],
): string {
  const factorByExercise = new Map<string, Map<string, number>>()
  for (const c of contributions) {
    const factors = factorByExercise.get(c.exerciseId) ?? new Map<string, number>()
    factors.set(c.muscleGroupId, c.factor)
    factorByExercise.set(c.exerciseId, factors)
  }

  const header = ['EJERCICIO', 'TIPO', 'CATEGORÍA', ...muscleGroups.map((g) => g.name.toUpperCase())]
  const rows = [...exercises]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((exercise) => {
      const factors = factorByExercise.get(exercise.id)
      return [
        exercise.name,
        exercise.type === 'strength' ? 'Fuerza' : 'Cardio',
        exercise.category ? CATEGORY_LABELS[exercise.category] : '',
        ...muscleGroups.map((g) => factors?.get(g.id) ?? null),
      ]
    })
  return toCsv(header, rows)
}
