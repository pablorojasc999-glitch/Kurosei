import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateFatigueIndex,
  placeholderFatigueIndexFormula,
  setFatigueIndexFormula,
  type LoadSample,
} from './fatigueIndex'

const REFERENCE_DATE = '2026-08-22T00:00:00.000Z'

function daysBefore(days: number): string {
  const date = new Date(REFERENCE_DATE)
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

describe('fatigueIndex', () => {
  beforeEach(() => {
    setFatigueIndexFormula(placeholderFatigueIndexFormula)
  })

  it('returns zero stress with no history', () => {
    const result = calculateFatigueIndex([], REFERENCE_DATE)
    expect(result).toEqual({ central: 0, peripheral: 0, total: 0 })
  })

  it('flags rising stress when recent load spikes above the chronic baseline', () => {
    const history: LoadSample[] = [
      { performedAt: daysBefore(1), tonnageKg: 5000 },
      { performedAt: daysBefore(3), tonnageKg: 5000 },
      { performedAt: daysBefore(20), tonnageKg: 500 },
    ]
    const result = calculateFatigueIndex(history, REFERENCE_DATE)
    expect(result.total).toBeGreaterThan(1)
    expect(result.central).toBe(result.total)
    expect(result.peripheral).toBe(result.total)
  })

  it('is fully replaceable without touching call sites', () => {
    setFatigueIndexFormula(() => ({ central: 1, peripheral: 2, total: 3 }))
    expect(calculateFatigueIndex([], REFERENCE_DATE)).toEqual({
      central: 1,
      peripheral: 2,
      total: 3,
    })
  })
})
