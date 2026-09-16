import { describe, expect, it } from 'vitest'
import { rankRepHistory, REP_HISTORY_LIMIT } from './repHistory'

const serie = (performedAt: string, weightKg: number, rpe: number | null = 8) => ({
  performedAt,
  weightKg,
  reps: 5,
  rpe,
})

describe('rankRepHistory', () => {
  it('"Recientes" ordena de la última hacia atrás', () => {
    const r = rankRepHistory(
      [serie('2026-01-05', 100), serie('2026-03-01', 90), serie('2026-02-01', 110)],
      'recientes',
    )
    expect(r.map((s) => s.performedAt)).toEqual(['2026-03-01', '2026-02-01', '2026-01-05'])
  })

  it('"Mayor e1RM" ordena por el estimado, no por la fecha', () => {
    const r = rankRepHistory(
      [serie('2026-03-01', 90), serie('2026-01-05', 110), serie('2026-02-01', 100)],
      'e1rm',
    )
    expect(r.map((s) => s.weightKg)).toEqual([110, 100, 90])
  })

  it('a igual e1RM gana la más reciente', () => {
    const r = rankRepHistory([serie('2026-01-05', 100), serie('2026-03-01', 100)], 'e1rm')
    expect(r[0].performedAt).toBe('2026-03-01')
  })

  it('el RPE pesa: la misma carga a RPE menor vale más', () => {
    const r = rankRepHistory([serie('2026-01-05', 100, 9), serie('2026-01-06', 100, 7)], 'e1rm')
    expect(r[0].rpe).toBe(7)
  })

  it('corta en siete', () => {
    const muchas = Array.from({ length: 20 }, (_, i) =>
      serie(`2026-01-${String(i + 1).padStart(2, '0')}`, 100 + i),
    )
    expect(rankRepHistory(muchas, 'recientes')).toHaveLength(REP_HISTORY_LIMIT)
    expect(rankRepHistory(muchas, 'e1rm')).toHaveLength(REP_HISTORY_LIMIT)
  })

  it('con menos de siete las muestra todas', () => {
    expect(rankRepHistory([serie('2026-01-05', 100)], 'recientes')).toHaveLength(1)
  })

  it('no toca el arreglo que recibe', () => {
    const original = [serie('2026-01-05', 100), serie('2026-03-01', 90)]
    const copia = [...original]
    rankRepHistory(original, 'e1rm')
    expect(original).toEqual(copia)
  })

  it('una serie sin peso no rompe el orden', () => {
    const r = rankRepHistory(
      [{ performedAt: '2026-01-05', weightKg: null, reps: 5, rpe: 8 }, serie('2026-01-06', 100)],
      'e1rm',
    )
    expect(r[0].weightKg).toBe(100)
  })

  it('sin historial no devuelve nada', () => {
    expect(rankRepHistory([], 'recientes')).toEqual([])
  })
})

describe('rankRepHistory con series sin peso', () => {
  const sinPeso = (performedAt: string) => ({ performedAt, weightKg: null, reps: 5, rpe: 8 })

  it('en "Mayor e1RM" las series sin peso van al final, no compiten con un cero', () => {
    const r = rankRepHistory(
      [sinPeso('2026-03-01'), serie('2026-01-05', 100), sinPeso('2026-02-01')],
      'e1rm',
    )
    expect(r[0].weightKg).toBe(100)
    expect(r.slice(1).every((s) => s.weightKg === null)).toBe(true)
  })

  it('entre dos sin peso manda la fecha', () => {
    const r = rankRepHistory([sinPeso('2026-01-05'), sinPeso('2026-03-01')], 'e1rm')
    expect(r[0].performedAt).toBe('2026-03-01')
  })

  it('"Recientes" no las trata distinto', () => {
    const r = rankRepHistory([serie('2026-01-05', 100), sinPeso('2026-03-01')], 'recientes')
    expect(r[0].performedAt).toBe('2026-03-01')
  })
})
