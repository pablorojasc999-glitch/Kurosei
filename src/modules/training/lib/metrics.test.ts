import { describe, expect, it } from 'vitest'
import {
  averageRpeDeviation,
  buildE1rmTrend,
  isNewPR,
  muscleGroupVolume,
  needsDeloadAlert,
  relativeIntensity,
  tonnage,
} from './metrics'

describe('tonnage', () => {
  it('sums weight times reps across sets', () => {
    expect(
      tonnage([
        { weightKg: 100, reps: 5 },
        { weightKg: 80, reps: 10 },
      ]),
    ).toBe(1300)
  })

  it('returns 0 for no sets', () => {
    expect(tonnage([])).toBe(0)
  })
})

describe('relativeIntensity', () => {
  it('computes %1RM relative to a given e1RM', () => {
    expect(relativeIntensity(90, 120)).toBe(75)
  })

  it('returns 0 when e1RM is not positive, avoiding a divide-by-zero', () => {
    expect(relativeIntensity(90, 0)).toBe(0)
  })
})

describe('muscleGroupVolume', () => {
  it('splits set credit across muscle groups by contribution %', () => {
    const contributions = new Map([
      [
        'bench',
        [
          { muscleGroupId: 'chest', percentage: 60 },
          { muscleGroupId: 'triceps', percentage: 25 },
          { muscleGroupId: 'front-delt', percentage: 15 },
        ],
      ],
      ['triceps-pushdown', [{ muscleGroupId: 'triceps', percentage: 100 }]],
    ])

    const result = muscleGroupVolume(
      [
        { exerciseId: 'bench' },
        { exerciseId: 'bench' },
        { exerciseId: 'triceps-pushdown' },
      ],
      contributions,
    )

    expect(result.get('chest')).toBeCloseTo(1.2)
    expect(result.get('triceps')).toBeCloseTo(1.5)
    expect(result.get('front-delt')).toBeCloseTo(0.3)
  })

  it('ignores exercises with no known contribution mapping', () => {
    const result = muscleGroupVolume([{ exerciseId: 'unknown' }], new Map())
    expect(result.size).toBe(0)
  })
})

describe('isNewPR', () => {
  it('is a PR when there is no prior best', () => {
    expect(isNewPR(100, null)).toBe(true)
  })

  it('is a PR only when strictly greater than the prior best', () => {
    expect(isNewPR(101, 100)).toBe(true)
    expect(isNewPR(100, 100)).toBe(false)
    expect(isNewPR(99, 100)).toBe(false)
  })
})

describe('buildE1rmTrend', () => {
  it('sorts points chronologically without mutating the input', () => {
    const input = [
      { date: '2026-02-01', e1rm: 150 },
      { date: '2026-01-01', e1rm: 140 },
    ]
    const result = buildE1rmTrend(input)
    expect(result.map((p) => p.e1rm)).toEqual([140, 150])
    expect(input[0].date).toBe('2026-02-01')
  })
})

describe('averageRpeDeviation', () => {
  it('averages actual-minus-planned RPE across pairs', () => {
    expect(
      averageRpeDeviation([
        { plannedRpe: 8, actualRpe: 9 },
        { plannedRpe: 8, actualRpe: 8 },
      ]),
    ).toBe(0.5)
  })

  it('returns 0 with no pairs', () => {
    expect(averageRpeDeviation([])).toBe(0)
  })
})

describe('needsDeloadAlert', () => {
  it('flags when every recent session ran consistently hotter than planned', () => {
    expect(needsDeloadAlert([1, 1.5, 2])).toBe(true)
  })

  it('does not flag a single hard session among otherwise on-target ones', () => {
    expect(needsDeloadAlert([0.2, 2, 0.1])).toBe(false)
  })

  it('does not flag with no data', () => {
    expect(needsDeloadAlert([])).toBe(false)
  })
})
