import { describe, expect, it } from 'vitest'
import type { GroceryItem, PurchaseCadence } from '../domain/types'
import {
  daysSince,
  groupByCadence,
  hasQuantity,
  isDue,
  lastBoughtLabel,
  needsBuying,
  sortForDisplay,
} from './groceryCadence'

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

describe('hasQuantity', () => {
  it('la cantidad en blanco, o sólo espacios, es "ya lo tengo en casa"', () => {
    expect(hasQuantity(item({ cadence: 'quincenal', quantity: '2 L' }))).toBe(true)
    expect(hasQuantity(item({ cadence: 'quincenal', quantity: '' }))).toBe(false)
    expect(hasQuantity(item({ cadence: 'quincenal', quantity: '   ' }))).toBe(false)
  })
})

describe('needsBuying', () => {
  it('sin cantidad no hay que llevarlo, por mucho que le toque por ciclo', () => {
    const sinCantidad = item({ cadence: 'quincenal', lastBoughtAt: '2026-01-01' })
    expect(isDue(sinCantidad, '2026-03-01')).toBe(true)
    expect(needsBuying(sinCantidad, '2026-03-01')).toBe(false)
  })

  it('con cantidad, hay que llevarlo justo cuando le toca', () => {
    const conCantidad = item({
      cadence: 'quincenal',
      quantity: '2 L',
      lastBoughtAt: '2026-03-01',
    })
    expect(needsBuying(conCantidad, '2026-03-14')).toBe(false)
    expect(needsBuying(conCantidad, '2026-03-15')).toBe(true)
  })

  it('lo esporádico con cantidad tampoco toca solo: no tiene ciclo', () => {
    const esporadico = item({ cadence: 'esporadico', quantity: '1' })
    expect(needsBuying(esporadico, '2026-03-01')).toBe(false)
  })
})

describe('sortForDisplay', () => {
  it('primero lo que hay que comprar, luego lo que ya está en casa, alfabético en cada bloque', () => {
    const items = [
      item({ id: '1', name: 'Zanahoria', cadence: 'quincenal', quantity: '1 kg' }),
      item({ id: '2', name: 'Acelga', cadence: 'quincenal' }),
      item({ id: '3', name: 'Manzana', cadence: 'quincenal', quantity: '4' }),
      item({ id: '4', name: 'Betarraga', cadence: 'quincenal' }),
    ]
    expect(sortForDisplay(items).map((i) => i.name)).toEqual([
      'Manzana',
      'Zanahoria',
      'Acelga',
      'Betarraga',
    ])
  })

  it('ordena con reglas del español: acentos y ñ caen donde uno los busca', () => {
    const items = ['Ñoquis', 'Nuez', 'Ajo', 'Ácido', 'Zapallo'].map((name, index) =>
      item({ id: String(index), name, cadence: 'mensual', quantity: '1' }),
    )
    expect(sortForDisplay(items).map((i) => i.name)).toEqual([
      'Ácido',
      'Ajo',
      'Nuez',
      'Ñoquis',
      'Zapallo',
    ])
  })

  it('no muta la lista que recibe', () => {
    const items = [
      item({ id: '1', name: 'Zanahoria', cadence: 'quincenal', quantity: '1' }),
      item({ id: '2', name: 'Acelga', cadence: 'quincenal', quantity: '1' }),
    ]
    sortForDisplay(items)
    expect(items.map((i) => i.name)).toEqual(['Zanahoria', 'Acelga'])
  })
})

describe('lastBoughtLabel', () => {
  it('sólo marca "toca" lo que además hay que comprar', () => {
    expect(
      lastBoughtLabel(item({ cadence: 'quincenal', quantity: '2 L' }), '2026-03-01'),
    ).toBe('Nunca comprado · toca')
    // Sin cantidad está en casa: se informa la fecha, pero no se pide comprarlo.
    expect(lastBoughtLabel(item({ cadence: 'quincenal' }), '2026-03-01')).toBe(
      'Nunca comprado',
    )
    expect(lastBoughtLabel(item({ cadence: 'esporadico' }), '2026-03-01')).toBe(
      'Nunca comprado',
    )
  })

  it('dice cuánto hace y si ya toca', () => {
    const i = (last: string) =>
      item({ cadence: 'quincenal', quantity: '2 L', lastBoughtAt: last })
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

  it('reparte por cadencia, deja lo que hay que comprar arriba y cuenta ambos bloques', () => {
    const items = [
      // Sin cantidad: está en casa, así que baja aunque alfabéticamente vaya antes.
      item({ id: 'a', name: 'Acelga', cadence: 'quincenal' }),
      item({ id: 'z', name: 'Zanahoria', cadence: 'quincenal', quantity: '1 kg' }),
      item({ id: 'm', name: 'Manzana', cadence: 'quincenal', quantity: '4' }),
      item({ id: 'c', name: 'Arroz', cadence: 'mensual', quantity: '2 kg', lastBoughtAt: '2026-03-10' }),
      item({ id: 'd', name: 'Ampolletas', cadence: 'esporadico', quantity: '4' }),
    ]
    const [quincenal, mensual, esporadico] = groupByCadence(items, '2026-03-16')

    expect(quincenal.items.map((i) => i.name)).toEqual(['Manzana', 'Zanahoria', 'Acelga'])
    // Manzana y Zanahoria nunca se compraron y llevan cantidad; Acelga está en casa.
    expect(quincenal.dueCount).toBe(2)
    expect(quincenal.stockedCount).toBe(1)

    // Arroz lleva 6 días de 30: todavía no toca.
    expect(mensual.dueCount).toBe(0)
    expect(mensual.stockedCount).toBe(0)

    // Lo esporádico nunca toca solo, tenga cantidad o no.
    expect(esporadico.dueCount).toBe(0)
  })
})
