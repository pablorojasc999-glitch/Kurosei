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
import {
  buildBlockGrid,
  compareSets,
  currentWeekIndex,
  executedMatchesPlan,
  formatSet,
  setMatchesPlan,
  summarizeSets,
  type GridSet,
} from './blockGrid'

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
    expect(summarizeSets([])).toEqual({ volume: '', sets: 0, varied: false, intensity: '' })
  })

  it('series iguales se resumen como N×R', () => {
    expect(summarizeSets([gs(3), gs(3), gs(3)]).volume).toBe('3×3')
  })

  it('series distintas dan el rango, que es lo que cabe en la celda', () => {
    expect(summarizeSets([gs(5), gs(5), gs(3)]).volume).toBe('3-5')
  })

  it('con peso manda el peso: el peso y el RPE juntos no caben en la celda', () => {
    // `190 kg máx @8 máx` medía 104 px en un hueco de 50 y se salía.
    expect(summarizeSets([gs(3, 140, 8), gs(3, 140, 8)]).intensity).toBe('140 kg')
  })

  it('si el peso sube dentro del día informa la serie tope con un +', () => {
    expect(summarizeSets([gs(3, 120), gs(3, 130), gs(3, 140)]).intensity).toBe('140 kg+')
  })

  it('un peso a medio poner no se toma como constante', () => {
    expect(summarizeSets([gs(3, 140), gs(3, null)]).intensity).toBe('140 kg+')
  })

  it('la intensidad está acotada, pase lo que pase', () => {
    const duro = [gs(3, 190, 8), gs(3, 200, 9), gs(3, 212.5, 10)]
    expect(summarizeSets(duro).intensity).toBe('212.5 kg+')
    expect(summarizeSets(duro).intensity.length).toBeLessThanOrEqual(10)
  })

  it('quita el decimal muerto pero conserva los medios kilos', () => {
    expect(summarizeSets([gs(3, 140)]).intensity).toBe('140 kg')
    expect(summarizeSets([gs(3, 137.5)]).intensity).toBe('137.5 kg')
  })

  it('el RPE variable también lleva +', () => {
    expect(summarizeSets([gs(3, null, 7), gs(3, null, 9)]).intensity).toBe('@9+')
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
    expect(cells[0].executed.volume).toBe('1-2')
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

describe('el titular de la celda está acotado', () => {
  it('con reps distintas da un rango, no la lista', () => {
    const r = summarizeSets([gs(10), gs(10), gs(8)])
    expect(r.volume).toBe('8-10')
    expect(r.varied).toBe(true)
    expect(r.sets).toBe(3)
  })

  it('diez series variadas siguen siendo dos números', () => {
    const diez = [12, 10, 10, 8, 8, 8, 6, 6, 5, 5].map((reps) => gs(reps))
    const r = summarizeSets(diez)
    expect(r.volume).toBe('5-12')
    expect(r.sets).toBe(10)
    // Lo que se salía de la celda: la lista medía 26 caracteres.
    expect(r.volume.length).toBeLessThanOrEqual(7)
  })

  it('con reps iguales sigue siendo N×M y no un rango', () => {
    const r = summarizeSets([gs(8), gs(8), gs(8)])
    expect(r.volume).toBe('3×8')
    expect(r.varied).toBe(false)
  })

  it('una sola serie no es un rango', () => {
    expect(summarizeSets([gs(5)])).toMatchObject({ volume: '1×5', varied: false })
  })
})

describe('executedMatchesPlan', () => {
  it('mismas series y mismas reps es cumplir el plan', () => {
    expect(executedMatchesPlan([gs(8), gs(8)], [gs(8), gs(8)])).toBe(true)
  })

  it('menos series no es cumplirlo', () => {
    expect(executedMatchesPlan([gs(8), gs(8), gs(8)], [gs(8), gs(8)])).toBe(false)
  })

  it('más reps tampoco: es otra cosa, aunque sea mejor', () => {
    expect(executedMatchesPlan([gs(8)], [gs(10)])).toBe(false)
  })

  it('el peso cuenta cuando el plan lo prescribe', () => {
    expect(executedMatchesPlan([gs(8, 100)], [gs(8, 80)])).toBe(false)
    expect(executedMatchesPlan([gs(8, 100)], [gs(8, 100)])).toBe(true)
  })

  it('si el plan no decía peso, cargar lo que sea no es salirse', () => {
    expect(executedMatchesPlan([gs(8, null)], [gs(8, 80)])).toBe(true)
  })

  it('el RPE no cuenta: es cómo se sintió, no un objetivo', () => {
    expect(executedMatchesPlan([gs(8, 100, 8)], [gs(8, 100, 9)])).toBe(true)
  })

  it('sin plan no hay nada que cumplir', () => {
    expect(executedMatchesPlan([], [])).toBe(false)
    expect(executedMatchesPlan([], [gs(8)])).toBe(false)
  })
})

describe('setMatchesPlan', () => {
  it('misma serie, mismas reps y mismo peso', () => {
    expect(setMatchesPlan(gs(4, 190), gs(4, 190))).toBe(true)
  })

  it('el mismo número de reps con otro peso no es la misma serie', () => {
    // El caso de la rampa: planeado 160, hecho 190. Las reps coinciden y aun
    // así te saliste del plan.
    expect(setMatchesPlan(gs(4, 160), gs(4, 190))).toBe(false)
  })

  it('sin peso prescrito, sólo cuentan las reps', () => {
    expect(setMatchesPlan(gs(4, null), gs(4, 190))).toBe(true)
    expect(setMatchesPlan(gs(4, null), gs(5, 190))).toBe(false)
  })
})

describe('compareSets', () => {
  it('empareja por posición', () => {
    const r = compareSets([gs(8), gs(8)], [gs(10), gs(8)])
    expect(r).toHaveLength(2)
    expect(r[0].planned?.reps).toBe(8)
    expect(r[0].executed?.reps).toBe(10)
  })

  it('la serie que no llegaste a hacer sale sin ejecutada', () => {
    const r = compareSets([gs(8), gs(8), gs(8)], [gs(8)])
    expect(r).toHaveLength(3)
    expect(r[2].planned?.reps).toBe(8)
    expect(r[2].executed).toBeNull()
  })

  it('la serie de más sale sin plan', () => {
    const r = compareSets([gs(8)], [gs(8), gs(6)])
    expect(r).toHaveLength(2)
    expect(r[1].planned).toBeNull()
    expect(r[1].executed?.reps).toBe(6)
  })

  it('sin nada no da filas', () => {
    expect(compareSets([], [])).toEqual([])
  })
})

describe('currentWeekIndex', () => {
  const slots = (fechas: (string | null)[][]) =>
    fechas.map((dates, slotIndex) => ({
      slotIndex,
      label: `Día ${slotIndex + 1}`,
      dates,
      dayIds: dates.map(() => null),
      rows: [],
    }))

  it('es la última semana que ya empezó', () => {
    const s = slots([['2026-09-01', '2026-09-08', '2026-09-15']])
    expect(currentWeekIndex(s, '2026-09-10')).toBe(1)
  })

  it('el primer día de la semana ya cuenta como empezada', () => {
    const s = slots([['2026-09-01', '2026-09-08']])
    expect(currentWeekIndex(s, '2026-09-08')).toBe(1)
  })

  it('toma el día más temprano de la semana, esté en la posición que esté', () => {
    // El segundo día de la semana 0 es anterior al primero de la semana 1.
    const s = slots([['2026-09-03', '2026-09-10'], ['2026-09-01', '2026-09-08']])
    expect(currentWeekIndex(s, '2026-09-02')).toBe(0)
  })

  it('si el bloque entero es futuro, ninguna', () => {
    expect(currentWeekIndex(slots([['2026-10-01']]), '2026-09-13')).toBe(-1)
  })

  it('sin fechas tampoco falla', () => {
    expect(currentWeekIndex(slots([[null, null]]), '2026-09-13')).toBe(-1)
    expect(currentWeekIndex([], '2026-09-13')).toBe(-1)
  })
})
