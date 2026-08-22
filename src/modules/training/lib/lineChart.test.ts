import { describe, expect, it } from 'vitest'
import { buildLineChartGeometry, computeJointRange, dateToX } from './lineChart'

const DOMAIN = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']

describe('dateToX', () => {
  it('spaces dates evenly across the width by their index in the domain', () => {
    expect(dateToX(DOMAIN, '2026-01-01', 300)).toBeCloseTo(0)
    expect(dateToX(DOMAIN, '2026-01-04', 300)).toBeCloseTo(300)
    expect(dateToX(DOMAIN, '2026-01-02', 300)).toBeCloseTo(100)
  })

  it('centers a single-date domain', () => {
    expect(dateToX(['2026-01-01'], '2026-01-01', 300)).toBe(150)
  })

  it('centers an unknown date as a fallback', () => {
    expect(dateToX(DOMAIN, '2099-01-01', 300)).toBe(150)
  })
})

describe('buildLineChartGeometry', () => {
  it('returns null when every point is null', () => {
    const points = DOMAIN.map((date) => ({ date, value: null }))
    expect(buildLineChartGeometry(DOMAIN, points, 300, 120, 12)).toBeNull()
  })

  it('skips missing/null days instead of interpolating them', () => {
    const points = [
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-02', value: null },
      { date: '2026-01-04', value: 20 },
    ]
    const geometry = buildLineChartGeometry(DOMAIN, points, 300, 120, 12)
    expect(geometry?.points.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-04'])
  })

  it('maps min/max value to the bottom/top of the padded height', () => {
    const points = [
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-04', value: 20 },
    ]
    const geometry = buildLineChartGeometry(DOMAIN, points, 300, 120, 12)
    expect(geometry?.min).toBe(10)
    expect(geometry?.max).toBe(20)
    const first = geometry?.points.find((p) => p.date === '2026-01-01')
    const last = geometry?.points.find((p) => p.date === '2026-01-04')
    expect(first?.y).toBeCloseTo(120 - 12)
    expect(last?.y).toBeCloseTo(12)
  })

  it('uses a flat mid-height line when every value is identical', () => {
    const points = [
      { date: '2026-01-01', value: 5 },
      { date: '2026-01-04', value: 5 },
    ]
    const geometry = buildLineChartGeometry(DOMAIN, points, 300, 120, 12)
    expect(geometry?.points.every((p) => p.y === geometry.points[0].y)).toBe(true)
  })

  it('plots against an externally supplied yRange instead of its own min/max', () => {
    const points = [{ date: '2026-01-01', value: 10 }]
    const geometry = buildLineChartGeometry(DOMAIN, points, 300, 120, 12, { min: 0, max: 100 })
    // 10 out of [0,100] should sit near the bottom, not at the top (which its own min/max would give).
    expect(geometry?.points[0].y).toBeCloseTo(120 - 12 - 0.1 * (120 - 24))
  })
})

describe('computeJointRange', () => {
  it('spans the min/max across every series', () => {
    const seriesA = [{ date: '2026-01-01', value: 10 }]
    const seriesB = [{ date: '2026-01-02', value: 30 }]
    expect(computeJointRange([seriesA, seriesB])).toEqual({ min: 10, max: 30 })
  })

  it('returns null when there is no data anywhere', () => {
    const seriesA = [{ date: '2026-01-01', value: null }]
    expect(computeJointRange([seriesA])).toBeNull()
  })
})
