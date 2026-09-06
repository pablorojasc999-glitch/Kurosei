import { describe, expect, it } from 'vitest'
import type {
  Day,
  ExecutedSet,
  Exercise,
  PlannedExercise,
  PlannedSet,
  SessionExercise,
  StrengthSession,
  Week,
} from '../domain/types'
import { buildBlockGrid, formatSet, summarizeSets, type GridSet } from './blockGrid'

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

/** Serie normalizada, que es lo que consume `summarizeSets`. */
const gs = (reps: number, weightKg: number | null = null, rpe: number | null = null): GridSet => ({
  weightKg,
  reps,
  rpe,
})

const session = (id: string, dayId: string): StrengthSession => ({
  id,
  dayId,
  startedAt: '2026-03-02T10:00:00.000Z',
  endedAt: null,
  ...base,
})
const sessionEx = (id: string, sessionId: string, exerciseId: string): SessionExercise => ({
  id,
  sessionId,
  exerciseId,
  order: 0,
  notes: '',
  closedAt: null,
  ...base,
})
const done = (
  sessionExerciseId: string,
  setNumber: number,
  reps: number,
  weightKg: number | null = null,
  rpe: number | null = null,
): ExecutedSet => ({
  id: `${sessionExerciseId}-${setNumber}`,
  sessionExerciseId,
  setNumber,
  weightKg,
  reps,
  rpe,
  eva: null,
  notes: '',
  performedAt: '2026-03-02T10:00:00.000Z',
  restTakenSeconds: null,
  ...base,
})

/** Envuelve las listas sueltas en la entrada que espera `buildBlockGrid`. */
function input(
  over: Partial<Parameters<typeof buildBlockGrid>[0]> = {},
): Parameters<typeof buildBlockGrid>[0] {
  return {
    weeks: [],
    days: [],
    plannedExercises: [],
    plannedSets: [],
    sessions: [],
    sessionExercises: [],
    executedSets: [],
    exercises: [],
    ...over,
  }
}

describe('summarizeSets', () => {
  it('sin series no dice nada', () => {
    expect(summarizeSets([])).toEqual({ volume: '', intensity: '' })
  })

  it('series iguales se resumen como N×R', () => {
    expect(summarizeSets([gs(3), gs(3), gs(3)]).volume).toBe('3×3')
  })

  it('series distintas se listan, que es la información que se perdería al promediar', () => {
    expect(summarizeSets([gs(5), gs(5), gs(3)]).volume).toBe('5/5/3')
  })

  it('peso y RPE constantes se muestran tal cual', () => {
    expect(summarizeSets([gs(3, 140, 8), gs(3, 140, 8)]).intensity).toBe('140 kg @8')
  })

  it('si el peso sube dentro del día informa la serie tope', () => {
    expect(summarizeSets([gs(3, 120), gs(3, 130), gs(3, 140)]).intensity).toBe('140 kg máx')
  })

  it('un peso a medio poner no se toma como constante', () => {
    expect(summarizeSets([gs(3, 140), gs(3, null)]).intensity).toBe('140 kg máx')
  })

  it('quita el decimal muerto pero conserva los medios kilos', () => {
    expect(summarizeSets([gs(3, 140)]).intensity).toBe('140 kg')
    expect(summarizeSets([gs(3, 137.5)]).intensity).toBe('137.5 kg')
  })

  it('sólo RPE, sin peso', () => {
    expect(summarizeSets([gs(3, null, 8)]).intensity).toBe('@8')
  })
})

describe('formatSet', () => {
  it('escribe la serie como se lee en la fila desplegada', () => {
    expect(formatSet(gs(2, 130, 8))).toBe('130×2 @8')
    expect(formatSet(gs(2, 137.5))).toBe('137.5×2')
    expect(formatSet(gs(10, null, 9))).toBe('10 reps @9')
    expect(formatSet(gs(10))).toBe('10 reps')
  })
})

describe('buildBlockGrid', () => {
  it('un bloque vacío no tiene columnas ni filas', () => {
    expect(buildBlockGrid(input())).toEqual({ weeks: [], slots: [] })
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
    const grid = buildBlockGrid(input({ weeks, days }))
    expect(grid.slots).toHaveLength(2)
    expect(grid.slots[0].dates).toEqual(['2026-03-02', '2026-03-10'])
    expect(grid.slots[1].dates).toEqual(['2026-03-04', '2026-03-12'])
  })

  it('ordena los días de cada semana por fecha aunque lleguen al revés', () => {
    const weeks = [week('w1', 0)]
    const days = [day('d2', 'w1', '2026-03-04'), day('d1', 'w1', '2026-03-02')]
    const grid = buildBlockGrid(input({ weeks, days }))
    expect(grid.slots.map((s) => s.dayIds[0])).toEqual(['d1', 'd2'])
  })

  it('ordena las semanas por `order`, no por como lleguen', () => {
    const weeks = [week('w2', 1), week('w1', 0)]
    const grid = buildBlockGrid(input({ weeks }))
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
    const grid = buildBlockGrid(input({ weeks, days, plannedExercises: pes, plannedSets: sets, exercises: [ex('squat', 'Box squat')] }))

    const row = grid.slots[0].rows[0]
    expect(row.exerciseName).toBe('Box squat')
    expect(row.cells.map((c) => c.planned.volume)).toEqual(['3×3', '3×3', '2×3'])
    expect(row.cells.map((c) => c.planned.intensity)).toEqual(['130 kg', '140 kg', '150 kg'])
  })

  it('un ejercicio que sólo está en una semana deja las demás celdas vacías', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const days = [day('d1', 'w1', '2026-03-02'), day('d2', 'w2', '2026-03-09')]
    const pes = [pe('p1', 'd1', 'squat', 0), pe('p2', 'd2', 'squat', 0), pe('p3', 'd2', 'remo', 1)]
    const grid = buildBlockGrid(input({ weeks, days, plannedExercises: pes, exercises: [ex('squat', 'Box squat'), ex('remo', 'Remo')] }))

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
    const grid = buildBlockGrid(input({ weeks, days }))
    expect(grid.slots).toHaveLength(2)
    expect(grid.slots[1].dayIds).toEqual(['d2', null])
    expect(grid.slots[1].dates).toEqual(['2026-03-04', null])
  })

  it('respeta el orden de los ejercicios dentro del día', () => {
    const weeks = [week('w1', 0)]
    const days = [day('d1', 'w1', '2026-03-02')]
    const pes = [pe('p2', 'd1', 'remo', 1), pe('p1', 'd1', 'squat', 0)]
    const grid = buildBlockGrid(input({ weeks, days, plannedExercises: pes, exercises: [ex('squat', 'Box squat'), ex('remo', 'Remo')] }))
    expect(grid.slots[0].rows.map((r) => r.exerciseId)).toEqual(['squat', 'remo'])
  })

  it('usa el label del día cuando se repite en todas las semanas', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const days = [
      day('d1', 'w1', '2026-03-02', 'Sentadilla pesada'),
      day('d2', 'w2', '2026-03-09', 'Sentadilla pesada'),
    ]
    expect(buildBlockGrid(input({ weeks, days })).slots[0].label).toBe('Sentadilla pesada')
  })

  it('cae en "Día N" si los labels no coinciden o están vacíos', () => {
    const weeks = [week('w1', 0), week('w2', 1)]
    const distintos = [
      day('d1', 'w1', '2026-03-02', 'Pesado'),
      day('d2', 'w2', '2026-03-09', 'Ligero'),
    ]
    expect(buildBlockGrid(input({ weeks, days: distintos })).slots[0].label).toBe('Día 1')

    const vacios = [day('d1', 'w1', '2026-03-02'), day('d2', 'w2', '2026-03-09')]
    expect(buildBlockGrid(input({ weeks, days: vacios })).slots[0].label).toBe('Día 1')
  })
})

describe('lo realizado junto al plan', () => {
  function bloque() {
    const weeks = [week('w1', 0), week('w2', 1)]
    const days = [day('d1', 'w1', '2026-03-02'), day('d2', 'w2', '2026-03-09')]
    const pes = [pe('p1', 'd1', 'squat', 0), pe('p2', 'd2', 'squat', 0)]
    const sets = [
      set('p1', 1, 2, 130, 8), set('p1', 2, 2, 132.5, 8), set('p1', 3, 2, 135, 8),
      set('p2', 1, 2, 140, 8), set('p2', 2, 2, 140, 8), set('p2', 3, 2, 140, 8),
    ]
    return { weeks, days, pes, sets, exercises: [ex('squat', 'Box squat')] }
  }

  it('trae el plan serie a serie, en orden, aunque las filas lleguen desordenadas', () => {
    const { weeks, days, pes, sets, exercises } = bloque()
    const desordenadas = [sets[2], sets[0], sets[1], ...sets.slice(3)]
    const grid = buildBlockGrid(
      input({ weeks, days, plannedExercises: pes, plannedSets: desordenadas, exercises }),
    )
    expect(grid.slots[0].rows[0].cells[0].plannedSets.map(formatSet)).toEqual([
      '130×2 @8',
      '132.5×2 @8',
      '135×2 @8',
    ])
  })

  it('empareja lo realizado con su celda pasando por la sesión del día', () => {
    const { weeks, days, pes, sets, exercises } = bloque()
    const grid = buildBlockGrid(
      input({
        weeks,
        days,
        plannedExercises: pes,
        plannedSets: sets,
        exercises,
        sessions: [session('s1', 'd1')],
        sessionExercises: [sessionEx('se1', 's1', 'squat')],
        // Se falló la última: 2 reps planificadas, 1 hecha.
        executedSets: [
          done('se1', 1, 2, 130, 8),
          done('se1', 2, 2, 132.5, 8.5),
          done('se1', 3, 1, 135, 10),
        ],
      }),
    )
    const cells = grid.slots[0].rows[0].cells
    expect(cells[0].executedSets.map(formatSet)).toEqual([
      '130×2 @8',
      '132.5×2 @8.5',
      '135×1 @10',
    ])
    expect(cells[0].executed.volume).toBe('2/2/1')
    // La semana sin sesión se queda sólo con el plan.
    expect(cells[1].executedSets).toEqual([])
    expect(cells[1].executed.volume).toBe('')
  })

  it('una sesión de otro ejercicio no contamina la celda', () => {
    const { weeks, days, pes, sets, exercises } = bloque()
    const grid = buildBlockGrid(
      input({
        weeks,
        days,
        plannedExercises: pes,
        plannedSets: sets,
        exercises,
        sessions: [session('s1', 'd1')],
        sessionExercises: [sessionEx('se1', 's1', 'otro-ejercicio')],
        executedSets: [done('se1', 1, 5, 60)],
      }),
    )
    expect(grid.slots[0].rows[0].cells[0].executedSets).toEqual([])
  })

  it('una sesión de otro día tampoco se cuela', () => {
    const { weeks, days, pes, sets, exercises } = bloque()
    const grid = buildBlockGrid(
      input({
        weeks,
        days,
        plannedExercises: pes,
        plannedSets: sets,
        exercises,
        // La sesión es del día de la semana 2, así que la celda de la 1 va vacía.
        sessions: [session('s2', 'd2')],
        sessionExercises: [sessionEx('se2', 's2', 'squat')],
        executedSets: [done('se2', 1, 2, 140, 9)],
      }),
    )
    const cells = grid.slots[0].rows[0].cells
    expect(cells[0].executedSets).toEqual([])
    expect(cells[1].executedSets.map(formatSet)).toEqual(['140×2 @9'])
  })
})
