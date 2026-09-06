import { describe, expect, it } from 'vitest'
import type { GroceryItem, PurchaseCadence } from '../domain/types'
import { daysSince, groupByCadence, isDue, lastBoughtLabel } from './groceryCadence'

function item(
  overrides: Partial<GroceryItem> & { cadence: PurchaseCadence },
): GroceryItem {
  return {
    id: overrides.name ?? 'id',
    name: 'Artículo',
    quantity: '',
    note: '',
    checked: false,
    lastBoughtAt: null,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('daysSince', () => {
  it('cuenta días completos entre dos fechas', () => {
    expect(daysSince('2026-03-01', '2026-03-15')).toBe(14)
    expect(daysSince('2026-03-01', '2026-03-01')).toBe(0)
  })

  it('cruza el cambio de mes y el de año', () => {
    expect(daysSince('2026-01-28', '2026-02-04')).toBe(7)
    expect(daysSince('2025-12-25', '2026-01-01')).toBe(7)
  })

  it('cruza el cambio de horario de verano sin desviarse', () => {
    // Chile mueve el reloj en septiembre; contando en días locales sigue dando 7.
    expect(daysSince('2026-09-03', '2026-09-10')).toBe(7)
  })
})

describe('isDue', () => {
  it('lo que nunca se compró toca, salvo lo esporádico', () => {
    expect(isDue(item({ cadence: 'quincenal' }), '2026-03-01')).toBe(true)
    expect(isDue(item({ cadence: 'mensual' }), '2026-03-01')).toBe(true)
    expect(isDue(item({ cadence: 'esporadico' }), '2026-03-01')).toBe(false)
  })

  it('lo quincenal toca justo a los 14 días', () => {
    const it13 = item({ cadence: 'quincenal', lastBoughtAt: '2026-03-01' })
    expect(isDue(it13, '2026-03-14')).toBe(false)
    expect(isDue(it13, '2026-03-15')).toBe(true)
    expect(isDue(it13, '2026-03-20')).toBe(true)
  })

  it('lo mensual toca justo a los 30 días', () => {
    const mensual = item({ cadence: 'mensual', lastBoughtAt: '2026-03-01' })
    expect(isDue(mensual, '2026-03-30')).toBe(false)
    expect(isDue(mensual, '2026-03-31')).toBe(true)
  })

  it('lo esporádico nunca toca solo, por más que pase el tiempo', () => {
    const esporadico = item({ cadence: 'esporadico', lastBoughtAt: '2020-01-01' })
    expect(isDue(esporadico, '2026-03-01')).toBe(false)
  })
})

describe('lastBoughtLabel', () => {
  it('avisa de lo que nunca se compró y sólo marca "toca" si tiene ciclo', () => {
    expect(lastBoughtLabel(item({ cadence: 'quincenal' }), '2026-03-01')).toBe(
      'Nunca comprado · toca',
    )
    expect(lastBoughtLabel(item({ cadence: 'esporadico' }), '2026-03-01')).toBe(
      'Nunca comprado',
    )
  })

  it('dice cuánto hace y si ya toca', () => {
    const i = (last: string) => item({ cadence: 'quincenal', lastBoughtAt: last })
    expect(lastBoughtLabel(i('2026-03-01'), '2026-03-01')).toBe('Comprado hoy')
    expect(lastBoughtLabel(i('2026-03-01'), '2026-03-02')).toBe('Hace 1 día')
    expect(lastBoughtLabel(i('2026-03-01'), '2026-03-10')).toBe('Hace 9 días')
    expect(lastBoughtLabel(i('2026-03-01'), '2026-03-16')).toBe('Hace 15 días · toca')
  })
})

describe('groupByCadence', () => {
  it('devuelve siempre los tres grupos, aunque estén vacíos', () => {
    expect(groupByCadence([], '2026-03-01').map((g) => g.cadence)).toEqual([
      'quincenal',
      'mensual',
      'esporadico',
    ])
  })

  it('reparte por cadencia, ordena por `order` y cuenta lo que toca', () => {
    const items = [
      item({ id: 'b', name: 'B', cadence: 'quincenal', order: 1, lastBoughtAt: '2026-03-01' }),
      item({ id: 'a', name: 'A', cadence: 'quincenal', order: 0 }),
      item({ id: 'c', name: 'C', cadence: 'mensual', order: 0, lastBoughtAt: '2026-03-10' }),
      item({ id: 'd', name: 'D', cadence: 'esporadico', order: 0 }),
    ]
    const [quincenal, mensual, esporadico] = groupByCadence(items, '2026-03-16')

    expect(quincenal.items.map((i) => i.name)).toEqual(['A', 'B'])
    // A nunca se compró y B lleva 15 días: los dos tocan.
    expect(quincenal.dueCount).toBe(2)
    expect(mensual.items.map((i) => i.name)).toEqual(['C'])
    expect(mensual.dueCount).toBe(0)
    expect(esporadico.items.map((i) => i.name)).toEqual(['D'])
    expect(esporadico.dueCount).toBe(0)
  })
})
