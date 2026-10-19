import { describe, expect, it } from 'vitest'
import type { MuscleContribution } from './metrics'
import { countsForStimulus, weekStimulusByDay, weekStimulusByGroup } from './weekStimulus'

const contributions = new Map<string, MuscleContribution[]>([
  ['squat', [{ muscleGroupId: 'quad', factor: 1 }, { muscleGroupId: 'glute', factor: 0.5 }]],
  ['curl', [{ muscleGroupId: 'biceps', factor: 1 }]],
])
const names: Record<string, string> = { quad: 'Cuádriceps', glute: 'Glúteos', biceps: 'Bíceps' }
const nameOf = (id: string) => names[id]
const valueOf = (totals: ReturnType<typeof weekStimulusByGroup>, name: string) =>
  totals.find((t) => t.name === name)?.value

describe('countsForStimulus', () => {
  it('cuenta desde RPE 6 y las que no tienen RPE, y deja fuera las livianas', () => {
    expect(countsForStimulus(6)).toBe(true)
    expect(countsForStimulus(9)).toBe(true)
    expect(countsForStimulus(5.5)).toBe(false)
    expect(countsForStimulus(null)).toBe(true)
  })
})

describe('weekStimulusByGroup', () => {
  it('pondera cada serie por la contribución del ejercicio', () => {
    const totals = weekStimulusByGroup(
      [{ exerciseId: 'squat', rpe: 8 }, { exerciseId: 'squat', rpe: 8 }],
      contributions,
      nameOf,
    )
    expect(valueOf(totals, 'Cuádriceps')).toBeCloseTo(2, 6)
    expect(valueOf(totals, 'Glúteos')).toBeCloseTo(1, 6)
  })

  it('descarta las series por debajo del RPE mínimo', () => {
    const totals = weekStimulusByGroup(
      [{ exerciseId: 'squat', rpe: 8 }, { exerciseId: 'squat', rpe: 4 }],
      contributions,
      nameOf,
    )
    expect(valueOf(totals, 'Cuádriceps')).toBeCloseTo(1, 6)
  })

  it('cuenta los ejercicios que no traen RPE', () => {
    const totals = weekStimulusByGroup([{ exerciseId: 'curl', rpe: null }], contributions, nameOf)
    expect(valueOf(totals, 'Bíceps')).toBeCloseTo(1, 6)
  })

  it('una serie intensificada pesa un 30% más', () => {
    const totals = weekStimulusByGroup([{ exerciseId: 'curl', rpe: 9, dropSet: true }], contributions, nameOf)
    expect(valueOf(totals, 'Bíceps')).toBeCloseTo(1.3, 6)
  })

  it('junta dos filas del mismo músculo y descarta los grupos sin nombre', () => {
    const dup = new Map<string, MuscleContribution[]>([
      ['x', [{ muscleGroupId: 'quad', factor: 1 }, { muscleGroupId: 'quad2', factor: 0.5 }, { muscleGroupId: 'ghost', factor: 1 }]],
    ])
    const totals = weekStimulusByGroup([{ exerciseId: 'x', rpe: 8 }], dup, (id) =>
      id === 'quad' || id === 'quad2' ? 'Cuádriceps' : undefined,
    )
    expect(totals).toHaveLength(1)
    expect(totals[0].value).toBeCloseTo(1.5, 6)
  })

  it('sin series no hay filas', () => {
    expect(weekStimulusByGroup([], contributions, nameOf)).toEqual([])
  })
})

describe('weekStimulusByDay', () => {
  it('reparte el estímulo por día y la suma de los días da el total', () => {
    const result = weekStimulusByDay(
      [
        { dayId: 'lun', exerciseId: 'squat', rpe: 8 },
        { dayId: 'lun', exerciseId: 'squat', rpe: 8 },
        { dayId: 'jue', exerciseId: 'squat', rpe: 8 },
        { dayId: 'jue', exerciseId: 'curl', rpe: null },
      ],
      ['lun', 'mar', 'jue'],
      contributions,
      nameOf,
    )
    const quad = result.rows.find((r) => r.name === 'Cuádriceps')
    expect(quad?.perDay).toEqual([2, 0, 1])
    expect(quad?.total).toBeCloseTo(3, 6)
    const biceps = result.rows.find((r) => r.name === 'Bíceps')
    expect(biceps?.perDay).toEqual([0, 0, 1])
    for (const row of result.rows) {
      expect(row.perDay.reduce((a, b) => a + b, 0)).toBeCloseTo(row.total, 6)
    }
  })

  it('suma el estímulo de todos los grupos de cada día', () => {
    const result = weekStimulusByDay(
      [{ dayId: 'lun', exerciseId: 'squat', rpe: 8 }, { dayId: 'jue', exerciseId: 'curl', rpe: 8 }],
      ['lun', 'jue'],
      contributions,
      nameOf,
    )
    // Una sentadilla reparte 1 + 0,5; un curl, 1.
    expect(result.dayTotals[0]).toBeCloseTo(1.5, 6)
    expect(result.dayTotals[1]).toBeCloseTo(1, 6)
  })

  it('ordena las filas por total y un día sin series queda en cero', () => {
    const result = weekStimulusByDay(
      [{ dayId: 'lun', exerciseId: 'curl', rpe: 8 }, { dayId: 'lun', exerciseId: 'squat', rpe: 8 }, { dayId: 'lun', exerciseId: 'squat', rpe: 8 }],
      ['lun', 'mar'],
      contributions,
      nameOf,
    )
    expect(result.rows.map((r) => r.name)).toEqual(['Cuádriceps', 'Bíceps', 'Glúteos'])
    expect(result.dayTotals[1]).toBe(0)
  })

  it('sin días no hay filas', () => {
    expect(weekStimulusByDay([], [], contributions, nameOf)).toEqual({ rows: [], dayTotals: [] })
  })
})
