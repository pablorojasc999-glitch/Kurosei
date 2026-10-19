import { describe, expect, it } from 'vitest'
import type { Exercise, ExerciseMuscleContribution, MuscleGroup } from '../domain/types'
import { buildExerciseLibraryCsv } from './exerciseCsv'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }
const exercise = (id: string, name: string, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  type: 'strength',
  category: null,
  ...base,
  ...over,
})
const group = (id: string, name: string): MuscleGroup => ({ id, name, ...base })
const contribution = (
  exerciseId: string,
  muscleGroupId: string,
  factor: number,
): ExerciseMuscleContribution => ({ id: `${exerciseId}-${muscleGroupId}`, exerciseId, muscleGroupId, factor, ...base })

const lines = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n')

describe('buildExerciseLibraryCsv', () => {
  const groups = [group('q', 'Cuádriceps'), group('g', 'Glúteos')]

  it('lleva un encabezado con un grupo muscular por columna', () => {
    expect(lines(buildExerciseLibraryCsv([], [], groups))).toEqual([
      'EJERCICIO;TIPO;CATEGORÍA;CUÁDRICEPS;GLÚTEOS',
    ])
  })

  it('escribe el factor de cada grupo y deja vacío el que no participa', () => {
    const csv = buildExerciseLibraryCsv(
      [exercise('sq', 'Sentadilla', { category: 'squat' })],
      [contribution('sq', 'q', 1), contribution('sq', 'g', 0.5)],
      groups,
    )
    expect(lines(csv)[1]).toBe('Sentadilla;Fuerza;Sentadilla;1;0,5')
    const sinGluteos = buildExerciseLibraryCsv(
      [exercise('ex', 'Extensión')],
      [contribution('ex', 'q', 1)],
      groups,
    )
    expect(lines(sinGluteos)[1]).toBe('Extensión;Fuerza;;1;')
  })

  it('marca el cardio y ordena por nombre', () => {
    const csv = buildExerciseLibraryCsv(
      [exercise('b', 'Trote', { type: 'cardio' }), exercise('a', 'Banca')],
      [],
      groups,
    )
    expect(lines(csv).slice(1)).toEqual(['Banca;Fuerza;;;', 'Trote;Cardio;;;'])
  })
})
