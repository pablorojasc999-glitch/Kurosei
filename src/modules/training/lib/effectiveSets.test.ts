import { describe, expect, it } from 'vitest'
import { buildEffectiveSets, countsAsEffective } from './effectiveSets'
import type {
  Day,
  ExerciseMuscleContribution,
  PlannedExercise,
  PlannedSet,
  Week,
} from '../domain/types'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }

const week = (id: string, order: number): Week => ({
  id,
  mesocycleId: 'meso',
  order,
  ...base,
})

const day = (id: string, weekId: string): Day => ({
  id,
  weekId,
  date: '2026-09-21',
  label: '',
  planClosedAt: null,
  ...base,
})

const pe = (
  id: string,
  dayId: string,
  exerciseId: string,
  over: Partial<PlannedExercise> = {},
): PlannedExercise => ({
  id,
  dayId,
  exerciseId,
  order: 0,
  notes: '',
  closedAt: null,
  ...base,
  ...over,
})

const set = (
  id: string,
  plannedExerciseId: string,
  over: Partial<PlannedSet> = {},
): PlannedSet => ({
  id,
  plannedExerciseId,
  setNumber: 1,
  targetWeightKg: 100,
  targetReps: 5,
  targetRpe: 8,
  restSecondsTarget: null,
  dropSet: false,
  restPause: false,
  ...base,
  ...over,
})

const contribution = (
  exerciseId: string,
  muscleGroupId: string,
  factor: number,
): ExerciseMuscleContribution => ({
  id: `${exerciseId}-${muscleGroupId}`,
  exerciseId,
  muscleGroupId,
  factor,
  ...base,
})

const nombres = new Map([
  ['g-pec', 'Pecho'],
  ['g-tri', 'Tríceps'],
  ['g-cua', 'Cuádriceps'],
])

const build = (over: Partial<Parameters<typeof buildEffectiveSets>[0]> = {}) =>
  buildEffectiveSets({
    weeks: [week('w1', 0), week('w2', 1)],
    days: [day('d1', 'w1'), day('d2', 'w2')],
    plannedExercises: [],
    plannedSets: [],
    contributions: [],
    muscleGroupNames: nombres,
    ...over,
  })

describe('countsAsEffective', () => {
  it('lo que nunca se marcó, cuenta', () => {
    expect(countsAsEffective(pe('p', 'd1', 'banca'))).toBe(true)
  })

  it('sólo false lo saca del conteo', () => {
    expect(countsAsEffective(pe('p', 'd1', 'banca', { countsAsEffective: false }))).toBe(false)
    expect(countsAsEffective(pe('p', 'd1', 'banca', { countsAsEffective: true }))).toBe(true)
  })
})

describe('buildEffectiveSets', () => {
  it('sin nada planificado no hay filas', () => {
    expect(build()).toEqual([])
  })

  it('pondera cada serie por la implicancia del músculo', () => {
    const filas = build({
      plannedExercises: [pe('p1', 'd1', 'banca')],
      plannedSets: [set('s1', 'p1'), set('s2', 'p1', { setNumber: 2 })],
      contributions: [contribution('banca', 'g-pec', 0.8), contribution('banca', 'g-tri', 0.5)],
    })
    expect(filas.map((f) => [f.name, f.total])).toEqual([
      ['Pecho', 1.6],
      ['Tríceps', 1],
    ])
  })

  it('reparte las series en la semana que les toca', () => {
    const filas = build({
      plannedExercises: [pe('p1', 'd1', 'banca'), pe('p2', 'd2', 'banca')],
      plannedSets: [
        set('s1', 'p1'),
        set('s2', 'p2'),
        set('s3', 'p2', { setNumber: 2 }),
        set('s4', 'p2', { setNumber: 3 }),
      ],
      contributions: [contribution('banca', 'g-pec', 1)],
    })
    expect(filas[0].perWeek).toEqual([1, 3])
    expect(filas[0].total).toBe(4)
  })

  it('un ejercicio marcado como no efectivo no suma', () => {
    const filas = build({
      plannedExercises: [
        pe('p1', 'd1', 'banca'),
        pe('p2', 'd2', 'banca', { countsAsEffective: false }),
      ],
      plannedSets: [set('s1', 'p1'), set('s2', 'p2')],
      contributions: [contribution('banca', 'g-pec', 1)],
    })
    expect(filas[0].perWeek).toEqual([1, 0])
  })

  it('un drop set pesa un 30% más, igual que en el resto de la app', () => {
    const filas = build({
      plannedExercises: [pe('p1', 'd1', 'banca')],
      plannedSets: [set('s1', 'p1', { dropSet: true })],
      contributions: [contribution('banca', 'g-pec', 0.8)],
    })
    expect(filas[0].perWeek[0]).toBeCloseTo(1.04, 5)
  })

  it('junta en una fila los músculos que son el mismo', () => {
    // Dos filas de biblioteca para el mismo músculo, una en inglés: el mapa
    // corporal ya las junta y acá tienen que salir juntas también.
    const filas = build({
      plannedExercises: [pe('p1', 'd1', 'banca')],
      plannedSets: [set('s1', 'p1')],
      contributions: [contribution('banca', 'g-a', 1), contribution('banca', 'g-b', 1)],
      muscleGroupNames: new Map([
        ['g-a', 'Pecho'],
        ['g-b', 'Chest'],
      ]),
    })
    expect(filas).toHaveLength(1)
    expect(filas[0].total).toBe(2)
  })

  it('ordena de más a menos trabajo', () => {
    const filas = build({
      plannedExercises: [pe('p1', 'd1', 'banca'), pe('p2', 'd1', 'squat')],
      plannedSets: [set('s1', 'p1'), set('s2', 'p2'), set('s3', 'p2', { setNumber: 2 })],
      contributions: [contribution('banca', 'g-pec', 1), contribution('squat', 'g-cua', 1)],
    })
    expect(filas.map((f) => f.name)).toEqual(['Cuádriceps', 'Pecho'])
  })

  it('un ejercicio sin series o sin implicancias no crea filas vacías', () => {
    const sinSeries = build({
      plannedExercises: [pe('p1', 'd1', 'banca')],
      contributions: [contribution('banca', 'g-pec', 1)],
    })
    expect(sinSeries).toEqual([])

    const sinImplicancias = build({
      plannedExercises: [pe('p1', 'd1', 'banca')],
      plannedSets: [set('s1', 'p1')],
    })
    expect(sinImplicancias).toEqual([])
  })

  it('ignora un día que no es de ninguna semana del bloque', () => {
    const filas = build({
      days: [day('d1', 'w1'), day('otra', 'w-de-otro-bloque')],
      plannedExercises: [pe('p1', 'otra', 'banca')],
      plannedSets: [set('s1', 'p1')],
      contributions: [contribution('banca', 'g-pec', 1)],
    })
    expect(filas).toEqual([])
  })

  it('ignora una implicancia de un grupo que ya no está', () => {
    const filas = build({
      plannedExercises: [pe('p1', 'd1', 'banca')],
      plannedSets: [set('s1', 'p1')],
      contributions: [contribution('banca', 'g-borrado', 1), contribution('banca', 'g-pec', 1)],
    })
    expect(filas.map((f) => f.name)).toEqual(['Pecho'])
  })
})
