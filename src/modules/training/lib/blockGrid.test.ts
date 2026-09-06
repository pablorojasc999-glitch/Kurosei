import { describe, expect, it } from 'vitest'
import type { Day, Exercise, PlannedExercise, PlannedSet, Week } from '../domain/types'
import { buildBlockGrid, summarizeSets } from './blockGrid'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }

const week = (id: string, order: number): Week => ({ id, mesocycleId: 'm', order, ...base })
const day = (id: string, weekId: string, date: string, label = ''): Day => ({
  id,
  weekId,
  date,
  label,
  planClosedAt: null,
  ...base,
})
const pe = (id: string, dayId: string, exerciseId: string, order: number): PlannedExercise => ({
  id,
  dayId,
  exerciseId,
  order,
  notes: '',
  closedAt: null,
  ...base,
})
const set = (
  plannedExerciseId: string,
  setNumber: number,
  targetReps: number,
  targetWeightKg: number | null = null,
  targetRpe: number | null = null,
): PlannedSet => ({
  id: `${plannedExerciseId}-${setNumber}`,
  plannedExerciseId,
  setNumber,
  targetWeightKg,
  targetReps,
  targetRpe,
  restSecondsTarget: null,
  ...base,
})
const ex = (id: string, name: string): Exercise => ({ id, name, type: 'strength', category: null, ...base })

describe('summarizeSets', () => {
  it('sin series no dice nada', () => {
    expect(summarizeSets([])).toEqual({ volume: '', intensity: '' })
  })

  it('series iguales se resumen como N×R', () => {
    const sets = [set('p', 1, 3), set('p', 2, 3), set('p', 3, 3)]
    expect(summarizeSets(sets).volume).toBe('3×3')
  })

  it('series distintas se listan, que es la información que se perdería al promediar', () => {
    const sets = [set('p', 1, 5), set('p', 2, 5), set('p', 3, 3)]
    expect(summarizeSets(sets).volume).toBe('5/5/3')
  })

  it('ordena por número de serie aunque lleguen desordenadas', () => {
    const sets = [set('p', 3, 3), set('p', 1, 5), set('p', 2, 5)]
    expect(summarizeSets(sets).volume).toBe('5/5/3')
  })

  it('peso y RPE constantes se muestran tal cual', () => {
    const sets = [set('p', 1, 3, 140, 8), set('p', 2, 3, 140, 8)]
    expect(summarizeSets(sets).intensity).toBe('140 kg @8')
  })

  it('si el peso sube dentro del día informa la serie tope', () => {
    const sets = [set('p', 1, 3, 120), set('p', 2, 3, 130), set('p', 3, 3, 140)]
    expect(summarizeSets(sets).intensity).toBe('140 kg máx')
  })

  it('un peso a medio poner no se toma como constante', () => {
    const sets = [set('p', 1, 3, 140), set('p', 2, 3, null)]
    expect(summarizeSets(sets).intensity).toBe('140 kg máx')
  })

  it('quita el decimal muerto pero conserva los medios kilos', () => {
    expect(summarizeSets([set('p', 1, 3, 140)]).intensity).toBe('140 kg')
    expect(summarizeSets([set('p', 1, 3, 137.5)]).intensity).toBe('137.5 kg')
  })

  it('sólo RPE, sin peso', () => {
    expect(summarizeSets([set('p', 1, 3, null, 8)]).intensity).toBe('@8')
  })
})

describe('buildBlockGrid', () => {
  it('un bloque vacío no tiene columnas ni filas', () => {
    expect(buildBlockGrid([], [], [], [], [])).toEqual({ weeks: [], slots: [] })
  })

  it('empareja el día por posición, no por día de la semana', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    // La segunda semana corre un día: aun así el primer día de cada una se
    // empareja en la misma fila.
    const days = [
      day('d1', 'w1', '2026-03-02'),
      day('d2', 'w1', '2026-03-04'),
      day('d3', 'w2', '2026-03-10'),
      day('d4', 'w2', '2026-03-12'),
    ]
    const grid = buildBlockGrid(weeks, days, [], [], [])
    expect(grid.slots).toHaveLength(2)
    expect(grid.slots[0].dates).toEqual(['2026-03-02', '2026-03-10'])
    expect(grid.slots[1].dates).toEqual(['2026-03-04', '2026-03-12'])
  })

  it('ordena los días de cada semana por fecha aunque lleguen al revés', () => {
    const weeks = [week('w1', 0)]
    const days = [day('d2', 'w1', '2026-03-04'), day('d1', 'w1', '2026-03-02')]
    const grid = buildBlockGrid(weeks, days, [], [], [])
    expect(grid.slots.map((s) => s.dayIds[0])).toEqual(['d1', 'd2'])
  })

  it('ordena las semanas por `order`, no por como lleguen', () => {
    const weeks = [week('w2', 1), week('w1', 0)]
    const grid = buildBlockGrid(weeks, [], [], [], [])
    expect(grid.weeks.map((w) => w.id)).toEqual(['w1', 'w2'])
  })

  it('arma la fila del ejercicio con su progresión semana a semana', () => {
    const weeks = [week('w1', 0), week('w2', 1), week('w3', 2)]
    const days = [
      day('d1', 'w1', '2026-03-02'),
      day('d2', 'w2', '2026-03-09'),
      day('d3', 'w3', '2026-03-16'),
    ]
    const pes = [pe('p1', 'd1', 'squat', 0), pe('p2', 'd2', 'squat', 0), pe('p3', 'd3', 'squat', 0)]
    const sets = [
      set('p1', 1, 3, 130), set('p1', 2, 3, 130), set('p1', 3, 3, 130),
      set('p2', 1, 3, 140), set('p2', 2, 3, 140), set('p2', 3, 3, 140),
      set('p3', 1, 3, 150), set('p3', 2, 3, 150),
    ]
    const grid = buildBlockGrid(weeks, days, pes, sets, [ex('squat', 'Box squat')])

    const row = grid.slots[0].rows[0]
    expect(row.exerciseName).toBe('Box squat')
    expect(row.cells.map((c) => c.volume)).toEqual(['3×3', '3×3', '2×3'])
    expect(row.cells.map((c) => c.intensity)).toEqual(['130 kg', '140 kg', '150 kg'])
  })

  it('un ejercicio que sólo está en una semana deja las demás celdas vacías', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const days = [day('d1', 'w1', '2026-03-02'), day('d2', 'w2', '2026-03-09')]
    const pes = [pe('p1', 'd1', 'squat', 0), pe('p2', 'd2', 'squat', 0), pe('p3', 'd2', 'remo', 1)]
    const grid = buildBlockGrid(weeks, days, pes, [], [ex('squat', 'Box squat'), ex('remo', 'Remo')])

    const remo = grid.slots[0].rows.find((r) => r.exerciseId === 'remo')
    expect(remo?.cells.map((c) => c.plannedExerciseId)).toEqual([null, 'p3'])
  })

  it('una semana con menos días deja esa posición vacía en vez de correr las demás', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const days = [
      day('d1', 'w1', '2026-03-02'),
      day('d2', 'w1', '2026-03-04'),
      day('d3', 'w2', '2026-03-09'),
    ]
    const grid = buildBlockGrid(weeks, days, [], [], [])
    expect(grid.slots).toHaveLength(2)
    expect(grid.slots[1].dayIds).toEqual(['d2', null])
    expect(grid.slots[1].dates).toEqual(['2026-03-04', null])
  })

  it('respeta el orden de los ejercicios dentro del día', () => {
    const weeks = [week('w1', 0)]
    const days = [day('d1', 'w1', '2026-03-02')]
    const pes = [pe('p2', 'd1', 'remo', 1), pe('p1', 'd1', 'squat', 0)]
    const grid = buildBlockGrid(weeks, days, pes, [], [ex('squat', 'Box squat'), ex('remo', 'Remo')])
    expect(grid.slots[0].rows.map((r) => r.exerciseId)).toEqual(['squat', 'remo'])
  })

  it('usa el label del día cuando se repite en todas las semanas', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const days = [
      day('d1', 'w1', '2026-03-02', 'Sentadilla pesada'),
      day('d2', 'w2', '2026-03-09', 'Sentadilla pesada'),
    ]
    expect(buildBlockGrid(weeks, days, [], [], []).slots[0].label).toBe('Sentadilla pesada')
  })

  it('cae en "Día N" si los labels no coinciden o están vacíos', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const distintos = [
      day('d1', 'w1', '2026-03-02', 'Pesado'),
      day('d2', 'w2', '2026-03-09', 'Ligero'),
    ]
    expect(buildBlockGrid(weeks, distintos, [], [], []).slots[0].label).toBe('Día 1')

    const vacios = [day('d1', 'w1', '2026-03-02'), day('d2', 'w2', '2026-03-09')]
    expect(buildBlockGrid(weeks, vacios, [], [], []).slots[0].label).toBe('Día 1')
  })
})
