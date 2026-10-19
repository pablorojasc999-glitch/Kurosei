import { describe, expect, it } from 'vitest'
import type {
  Day,
  ExecutedSet,
  Exercise,
  ExerciseCategory,
  Macrocycle,
  Mesocycle,
  PlannedExercise,
  PlannedSet,
  SessionExercise,
  StrengthSession,
  Week,
} from '../domain/types'
import { buildTrainingLogCsv, setStress, TRAINING_LOG_HEADER, type TrainingLogData } from './trainingLogCsv'
import { e1rmForSet } from './e1rm'
import { calculateStressIndex } from './stressIndex'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }

const macro: Macrocycle = { id: 'M', name: 'Prep', goal: '', startDate: '2026-08-01', endDate: '2026-12-31', ...base }
const meso = (id: string, order: number, startDate: string, name: string): Mesocycle => ({
  id, macrocycleId: 'M', name, phaseType: 'accumulation', order, startDate, endDate: startDate, ...base,
})
const week = (id: string, mesocycleId: string | null, startDate: string, endDate: string): Week => ({
  id, mesocycleId, order: 0, startDate, endDate, ...base,
})
const day = (id: string, weekId: string | null, date: string): Day => ({
  id, weekId, date, label: '', planClosedAt: null, ...base,
})
const exercise = (id: string, name: string, category: ExerciseCategory | null, type: 'strength' | 'cardio' = 'strength'): Exercise => ({
  id, name, type, category, ...base,
})
const plannedExercise = (id: string, dayId: string, exerciseId: string, order = 0): PlannedExercise => ({
  id, dayId, exerciseId, order, notes: '', closedAt: null, ...base,
})
const plannedSet = (pe: string, n: number, w: number | null, reps: number, rpe: number | null): PlannedSet => ({
  id: `${pe}-p${n}`, plannedExerciseId: pe, setNumber: n, targetWeightKg: w, targetReps: reps, targetRpe: rpe,
  restSecondsTarget: null, dropSet: false, restPause: false, ...base,
})
const session = (id: string, dayId: string): StrengthSession => ({ id, dayId, startedAt: '2026-01-01', endedAt: null, ...base })
const sessionExercise = (id: string, sessionId: string, exerciseId: string, order = 0): SessionExercise => ({
  id, sessionId, exerciseId, order, notes: '', closedAt: null, ...base,
})
const executedSet = (se: string, n: number, w: number | null, reps: number, rpe: number | null): ExecutedSet => ({
  id: `${se}-e${n}`, sessionExerciseId: se, setNumber: n, weightKg: w, reps, rpe, eva: null, notes: '',
  performedAt: '2026-01-01', restTakenSeconds: null, dropSet: false, restPause: false, ...base,
})

const empty: TrainingLogData = {
  macrocycles: [macro], mesocycles: [], weeks: [], days: [], exercises: [], plannedExercises: [],
  plannedSets: [], sessions: [], sessionExercises: [], executedSets: [],
}

const parse = (csv: string) =>
  csv.replace('﻿', '').trimEnd().split('\r\n').map((line) => line.split(';'))
const col = (name: string) => TRAINING_LOG_HEADER.indexOf(name)

describe('buildTrainingLogCsv', () => {
  it('lleva exactamente las columnas pedidas, en orden', () => {
    expect(parse(buildTrainingLogCsv(empty))[0]).toEqual([
      'MACROCICLO', 'MESOCICLO', 'MICROCICLO', 'MAX E1RM SQ LAST BLOCK', 'E1RM BP LAST BLOCK',
      'E1RM DL LAST BLOCK', 'FECHA', 'PRIORIDAD', 'REALIZADO', 'SERIE', 'EJERCICIO', 'PESO PLAN',
      'REPS PLAN', 'RPE PLAN', 'PESO REAL', 'REPS REAL', 'RPE REAL', '% DEL 1RM', 'E1RM', 'TONELAJE',
      'NEURAL STRESS', 'MUSCULAR STRESS', 'TOTAL STRESS', 'STRESS INDEX',
    ])
  })

  const data = (over: Partial<TrainingLogData> = {}): TrainingLogData => ({
    ...empty,
    mesocycles: [meso('m1', 0, '2026-08-03', 'Bloque 1'), meso('m2', 1, '2026-09-07', 'Bloque 2')],
    weeks: [week('w1', 'm1', '2026-08-03', '2026-08-09'), week('w2', 'm2', '2026-09-07', '2026-09-13')],
    days: [day('d1', 'w1', '2026-08-04T12:00:00.000Z'), day('d2', 'w2', '2026-09-08T12:00:00.000Z')],
    exercises: [exercise('sq', 'Sentadilla', 'squat'), exercise('ext', 'Extensión', null)],
    ...over,
  })

  it('empareja plan y ejecución por posición y marca la prioridad de los básicos', () => {
    const csv = buildTrainingLogCsv(
      data({
        plannedExercises: [plannedExercise('pe1', 'd1', 'sq'), plannedExercise('pe2', 'd1', 'ext', 1)],
        plannedSets: [plannedSet('pe1', 1, 100, 5, 8), plannedSet('pe2', 1, 40, 12, 9)],
        sessions: [session('s1', 'd1')],
        sessionExercises: [sessionExercise('se1', 's1', 'sq')],
        executedSets: [executedSet('se1', 1, 102.5, 5, 8)],
      }),
    )
    const [, squat, ext] = parse(csv)
    expect(squat[col('MACROCICLO')]).toBe('Prep')
    expect(squat[col('MESOCICLO')]).toBe('Bloque 1')
    expect(squat[col('MICROCICLO')]).toBe('Semana 1')
    expect(squat[col('FECHA')]).toBe('2026-08-04')
    expect(squat[col('PRIORIDAD')]).toBe('1')
    expect(squat[col('REALIZADO')]).toBe('Sí')
    expect(squat.slice(col('PESO PLAN'), col('RPE REAL') + 1)).toEqual(['100', '5', '8', '102,5', '5', '8'])
    expect(squat[col('TONELAJE')]).toBe('512,5')
    // Planificado y no hecho: queda en No y sin nada de lo real.
    expect(ext[col('PRIORIDAD')]).toBe('0')
    expect(ext[col('REALIZADO')]).toBe('No')
    expect(ext.slice(col('PESO REAL'), col('RPE REAL') + 1)).toEqual(['', '', ''])
    expect(ext[col('E1RM')]).toBe('')
  })

  it('una serie hecha de más sale sin plan y con REALIZADO Sí', () => {
    const csv = buildTrainingLogCsv(
      data({
        plannedExercises: [plannedExercise('pe1', 'd1', 'sq')],
        plannedSets: [plannedSet('pe1', 1, 100, 5, 8)],
        sessions: [session('s1', 'd1')],
        sessionExercises: [sessionExercise('se1', 's1', 'sq')],
        executedSets: [executedSet('se1', 1, 100, 5, 8), executedSet('se1', 2, 100, 5, 9)],
      }),
    )
    const rows = parse(csv).slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[1][col('SERIE')]).toBe('2')
    expect(rows[1][col('REPS PLAN')]).toBe('')
    expect(rows[1][col('REALIZADO')]).toBe('Sí')
  })

  it('un ejercicio hecho sin estar en el plan también sale', () => {
    const csv = buildTrainingLogCsv(
      data({
        sessions: [session('s1', 'd1')],
        sessionExercises: [sessionExercise('se1', 's1', 'ext')],
        executedSets: [executedSet('se1', 1, 50, 10, 8)],
      }),
    )
    const [, row] = parse(csv)
    expect(row[col('EJERCICIO')]).toBe('Extensión')
    expect(row[col('REALIZADO')]).toBe('Sí')
  })

  it('el máximo del bloque anterior sale en las columnas LAST BLOCK y se usa para el % del 1RM', () => {
    const csv = buildTrainingLogCsv(
      data({
        plannedExercises: [plannedExercise('pe1', 'd1', 'sq'), plannedExercise('pe2', 'd2', 'sq')],
        plannedSets: [plannedSet('pe2', 1, 120, 5, 8)],
        sessions: [session('s1', 'd1'), session('s2', 'd2')],
        sessionExercises: [sessionExercise('se1', 's1', 'sq'), sessionExercise('se2', 's2', 'sq')],
        executedSets: [executedSet('se1', 1, 150, 3, 8), executedSet('se1', 2, 140, 5, 9), executedSet('se2', 1, 120, 5, 8)],
      }),
    )
    const expectedMax = Math.max(
      e1rmForSet({ weightKg: 150, reps: 3, rpe: 8 }) as number,
      e1rmForSet({ weightKg: 140, reps: 5, rpe: 9 }) as number,
    )
    const rows = parse(csv).slice(1)
    const second = rows.find((r) => r[col('MESOCICLO')] === 'Bloque 2') as string[]
    expect(Number(second[col('MAX E1RM SQ LAST BLOCK')].replace(',', '.'))).toBeCloseTo(expectedMax, 1)
    expect(second[col('E1RM BP LAST BLOCK')]).toBe('')
    expect(Number(second[col('% DEL 1RM')].replace(',', '.'))).toBeCloseTo((120 / expectedMax) * 100, 1)
    // El primer bloque no tiene anterior.
    const first = rows.find((r) => r[col('MESOCICLO')] === 'Bloque 1') as string[]
    expect(first[col('MAX E1RM SQ LAST BLOCK')]).toBe('')
    expect(first[col('% DEL 1RM')]).toBe('')
  })

  it('un accesorio no tiene % del 1RM ni estrés neural, pero sí índice y muscular', () => {
    const csv = buildTrainingLogCsv(
      data({
        sessions: [session('s2', 'd2')],
        sessionExercises: [sessionExercise('se2', 's2', 'ext')],
        executedSets: [executedSet('se2', 1, 50, 10, 8)],
      }),
    )
    const [, row] = parse(csv)
    expect(row[col('% DEL 1RM')]).toBe('')
    expect(row[col('NEURAL STRESS')]).toBe('')
    expect(row[col('TOTAL STRESS')]).toBe('')
    expect(row[col('STRESS INDEX')]).toBe('1')
    expect(row[col('MUSCULAR STRESS')]).toBe('10')
  })

  it('el cardio no entra y un día sin semana deja el contexto vacío', () => {
    const csv = buildTrainingLogCsv(
      data({
        days: [day('d9', null, '2026-10-01T12:00:00.000Z')],
        exercises: [exercise('run', 'Trote', null, 'cardio'), exercise('ext', 'Extensión', null)],
        sessions: [session('s9', 'd9')],
        sessionExercises: [sessionExercise('a', 's9', 'run'), sessionExercise('b', 's9', 'ext', 1)],
        executedSets: [executedSet('b', 1, 30, 12, 7)],
      }),
    )
    const rows = parse(csv).slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0][col('EJERCICIO')]).toBe('Extensión')
    expect(rows[0].slice(0, 3)).toEqual(['', '', ''])
  })

  it('una semana sin mesociclo se nombra por sus fechas', () => {
    const csv = buildTrainingLogCsv(
      data({
        weeks: [week('w1', null, '2026-08-03', '2026-08-09')],
        sessions: [session('s1', 'd1')],
        sessionExercises: [sessionExercise('se1', 's1', 'ext')],
        executedSets: [executedSet('se1', 1, 30, 12, 7)],
      }),
    )
    const [, row] = parse(csv)
    expect(row[col('MESOCICLO')]).toBe('')
    expect(row[col('MICROCICLO')]).toBe('3 ago – 9 ago')
  })
})

describe('setStress', () => {
  it('sin RPE no hay estrés que calcular', () => {
    expect(setStress({ reps: 5, rpe: null, percentOf1rm: 80 })).toEqual({
      stressIndex: null, neural: null, muscular: null, total: null,
    })
  })

  it('el índice es el de la app; muscular y neural lo escalan por repeticiones y por intensidad', () => {
    const si = calculateStressIndex(9)
    const s = setStress({ reps: 5, rpe: 9, percentOf1rm: 80 })
    expect(s.stressIndex).toBeCloseTo(si, 6)
    expect(s.muscular).toBeCloseTo(si * 5, 6)
    expect(s.neural).toBeCloseTo(si * 0.8, 6)
    expect(s.total).toBeCloseTo((si * 0.8 + si * 5) / 2, 6)
  })

  it('sin % del 1RM no hay neural ni total, pero sí muscular', () => {
    const s = setStress({ reps: 10, rpe: 8, percentOf1rm: null })
    expect(s.neural).toBeNull()
    expect(s.total).toBeNull()
    expect(s.muscular).toBeCloseTo(10, 6)
  })
})
