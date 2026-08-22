import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateStressIndex,
  classifyStressLevel,
  rpeStressIndexFormula,
  setStressIndexFormula,
} from './stressIndex'

describe('calculateStressIndex', () => {
  beforeEach(() => {
    setStressIndexFormula(rpeStressIndexFormula)
  })

  it('matches the chart exactly at its five known points', () => {
    expect(calculateStressIndex(10)).toBeCloseTo(1.6, 5)
    expect(calculateStressIndex(9)).toBeCloseTo(1.2, 5)
    expect(calculateStressIndex(8)).toBeCloseTo(1, 5)
    expect(calculateStressIndex(7)).toBeCloseTo(0.8, 5)
    expect(calculateStressIndex(6)).toBeCloseTo(0.6, 5)
  })

  it('interpolates between chart points for a fractional RPE', () => {
    expect(calculateStressIndex(9.5)).toBeCloseTo(1.4, 5) // midpoint of 1.2 and 1.6
    expect(calculateStressIndex(8.5)).toBeCloseTo(1.1, 5) // midpoint of 1 and 1.2
  })

  it('clamps RPE outside the chart to its bounds', () => {
    expect(calculateStressIndex(11)).toBeCloseTo(1.6, 5)
    expect(calculateStressIndex(2)).toBeCloseTo(0.6, 5)
  })

  it('is fully replaceable without touching call sites', () => {
    setStressIndexFormula(() => 999)
    expect(calculateStressIndex(10)).toBe(999)
  })
})

describe('classifyStressLevel', () => {
  it('buckets a weekly total against the given thresholds', () => {
    expect(classifyStressLevel(10)).toBe('facil')
    expect(classifyStressLevel(20)).toBe('media')
    expect(classifyStressLevel(24)).toBe('dificil')
    expect(classifyStressLevel(30)).toBe('muyDificil')
  })
})
