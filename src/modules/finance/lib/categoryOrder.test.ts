import { describe, expect, it } from 'vitest'
import type { FinanceCategory, FinanceCategoryType } from '../domain/types'
import { sortCategoriesForGrid, totalMonthlyBudget } from './categoryOrder'

/** Una categoría, con el presupuesto que rige en el mes que se está mirando. */
interface Fixture {
  category: FinanceCategory
  budget: number | null
}

const cat = (
  name: string,
  type: FinanceCategoryType,
  budget: number | null,
  order = 0,
): Fixture => ({
  category: {
    id: name,
    name,
    emoji: '',
    type,
    order,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    deletedAt: null,
  },
  budget,
})

const categories = (fixtures: Fixture[]) => fixtures.map((f) => f.category)

/** El mapa del mes, como el que arma la página desde las vigencias. */
const budgets = (fixtures: Fixture[]) =>
  new Map(
    fixtures.filter((f) => f.budget !== null).map((f) => [f.category.id, f.budget as number]),
  )

const orderOf = (fixtures: Fixture[]) =>
  sortCategoriesForGrid(categories(fixtures), budgets(fixtures)).map((c) => c.name)

const sumOf = (fixtures: Fixture[]) => totalMonthlyBudget(categories(fixtures), budgets(fixtures))

describe('sortCategoriesForGrid', () => {
  it('agrupa los gastos primero y los ingresos después', () => {
    expect(
      orderOf([
        cat('Streaming', 'expense', 75000),
        cat('Sueldo', 'income', null),
        cat('Vivienda', 'expense', 400000),
        cat('Otros', 'income', null, 1),
      ]),
    ).toEqual(['Vivienda', 'Streaming', 'Sueldo', 'Otros'])
  })

  it('ordena los gastos de mayor a menor presupuesto', () => {
    expect(
      orderOf([
        cat('Streaming', 'expense', 75000),
        cat('Vivienda', 'expense', 400000),
        cat('Familia', 'expense', 120000),
      ]),
    ).toEqual(['Vivienda', 'Familia', 'Streaming'])
  })

  it('deja al final los gastos sin presupuesto', () => {
    expect(
      orderOf([
        cat('Sin presupuesto', 'expense', null),
        cat('Vivienda', 'expense', 400000),
        cat('Otro sin presupuesto', 'expense', null),
      ]),
    ).toEqual(['Vivienda', 'Otro sin presupuesto', 'Sin presupuesto'])
  })

  it('un presupuesto de 0 va antes que no tener presupuesto', () => {
    // Poner 0 es decir "no quiero gastar acá"; no ponerlo es no haberlo decidido.
    expect(orderOf([cat('Sin poner', 'expense', null), cat('En cero', 'expense', 0)])).toEqual([
      'En cero',
      'Sin poner',
    ])
  })

  it('con el mismo presupuesto, alfabético', () => {
    expect(
      orderOf([
        cat('Zapatos', 'expense', 50000),
        cat('Almuerzo', 'expense', 50000),
        cat('Ámbar', 'expense', 50000),
      ]),
    ).toEqual(['Almuerzo', 'Ámbar', 'Zapatos'])
  })

  it('los ingresos conservan el orden que eligió la persona', () => {
    expect(
      orderOf([
        cat('Paula', 'income', null, 3),
        cat('Sueldo', 'income', null, 1),
        cat('Álvaro', 'income', null, 2),
      ]),
    ).toEqual(['Sueldo', 'Álvaro', 'Paula'])
  })

  it('el orden puede cambiar de un mes a otro, porque el presupuesto cambia', () => {
    const enAgosto = [cat('Vivienda', 'expense', 400000), cat('Mercado', 'expense', 100000)]
    const enSeptiembre = [cat('Vivienda', 'expense', 400000), cat('Mercado', 'expense', 500000)]
    expect(orderOf(enAgosto)).toEqual(['Vivienda', 'Mercado'])
    expect(orderOf(enSeptiembre)).toEqual(['Mercado', 'Vivienda'])
  })

  it('no toca el arreglo original', () => {
    const fixtures = [cat('Streaming', 'expense', 75000), cat('Vivienda', 'expense', 400000)]
    const original = categories(fixtures)
    sortCategoriesForGrid(original, budgets(fixtures))
    expect(original.map((c) => c.name)).toEqual(['Streaming', 'Vivienda'])
  })

  it('sin categorías no falla', () => {
    expect(sortCategoriesForGrid([], new Map())).toEqual([])
  })
})

describe('totalMonthlyBudget', () => {
  it('suma el presupuesto de los gastos', () => {
    expect(sumOf([cat('Streaming', 'expense', 75000), cat('Vivienda', 'expense', 400000)])).toBe(
      475000,
    )
  })

  it('ignora los gastos sin presupuesto', () => {
    expect(sumOf([cat('Vivienda', 'expense', 400000), cat('Varios', 'expense', null)])).toBe(
      400000,
    )
  })

  it('no cuenta los ingresos, que no tienen presupuesto', () => {
    expect(
      sumOf([
        cat('Vivienda', 'expense', 400000),
        // Un ingreso no debería traer presupuesto, pero si lo trajera tampoco
        // se suma: lo presupuestado es lo que se planea gastar.
        cat('Sueldo', 'income', 999999),
      ]),
    ).toBe(400000)
  })

  it('sin nada presupuestado da cero', () => {
    expect(totalMonthlyBudget([], new Map())).toBe(0)
    expect(sumOf([cat('Varios', 'expense', null)])).toBe(0)
  })
})
