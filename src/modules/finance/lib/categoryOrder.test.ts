import { describe, expect, it } from 'vitest'
import type { FinanceCategory, FinanceCategoryType } from '../domain/types'
import { sortCategoriesForGrid, totalMonthlyBudget } from './categoryOrder'

const cat = (
  name: string,
  type: FinanceCategoryType,
  monthlyBudget: number | null,
  order = 0,
): FinanceCategory => ({
  id: name,
  name,
  emoji: '',
  type,
  monthlyBudget,
  order,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
})

describe('sortCategoriesForGrid', () => {
  it('agrupa los gastos primero y los ingresos después', () => {
    const orden = sortCategoriesForGrid([
      cat('Streaming', 'expense', 75000),
      cat('Sueldo', 'income', null),
      cat('Vivienda', 'expense', 400000),
      cat('Otros', 'income', null, 1),
    ]).map((c) => c.name)
    expect(orden).toEqual(['Vivienda', 'Streaming', 'Sueldo', 'Otros'])
  })

  it('ordena los gastos de mayor a menor presupuesto', () => {
    const orden = sortCategoriesForGrid([
      cat('Streaming', 'expense', 75000),
      cat('Vivienda', 'expense', 400000),
      cat('Familia', 'expense', 120000),
    ]).map((c) => c.name)
    expect(orden).toEqual(['Vivienda', 'Familia', 'Streaming'])
  })

  it('deja al final los gastos sin presupuesto', () => {
    const orden = sortCategoriesForGrid([
      cat('Sin presupuesto', 'expense', null),
      cat('Vivienda', 'expense', 400000),
      cat('Otro sin presupuesto', 'expense', null),
    ]).map((c) => c.name)
    expect(orden).toEqual(['Vivienda', 'Otro sin presupuesto', 'Sin presupuesto'])
  })

  it('un presupuesto de 0 va antes que no tener presupuesto', () => {
    // Poner 0 es decir "no quiero gastar acá"; no ponerlo es no haberlo decidido.
    const orden = sortCategoriesForGrid([
      cat('Sin poner', 'expense', null),
      cat('En cero', 'expense', 0),
    ]).map((c) => c.name)
    expect(orden).toEqual(['En cero', 'Sin poner'])
  })

  it('con el mismo presupuesto, alfabético', () => {
    const orden = sortCategoriesForGrid([
      cat('Zapatos', 'expense', 50000),
      cat('Almuerzo', 'expense', 50000),
      cat('Ámbar', 'expense', 50000),
    ]).map((c) => c.name)
    expect(orden).toEqual(['Almuerzo', 'Ámbar', 'Zapatos'])
  })

  it('los ingresos conservan el orden que eligió la persona', () => {
    const orden = sortCategoriesForGrid([
      cat('Paula', 'income', null, 3),
      cat('Sueldo', 'income', null, 1),
      cat('Álvaro', 'income', null, 2),
    ]).map((c) => c.name)
    expect(orden).toEqual(['Sueldo', 'Álvaro', 'Paula'])
  })

  it('no toca el arreglo original', () => {
    const original = [cat('Streaming', 'expense', 75000), cat('Vivienda', 'expense', 400000)]
    sortCategoriesForGrid(original)
    expect(original.map((c) => c.name)).toEqual(['Streaming', 'Vivienda'])
  })

  it('sin categorías no falla', () => {
    expect(sortCategoriesForGrid([])).toEqual([])
  })
})

describe('totalMonthlyBudget', () => {
  it('suma el presupuesto de los gastos', () => {
    expect(
      totalMonthlyBudget([
        cat('Streaming', 'expense', 75000),
        cat('Vivienda', 'expense', 400000),
      ]),
    ).toBe(475000)
  })

  it('ignora los gastos sin presupuesto', () => {
    expect(
      totalMonthlyBudget([cat('Vivienda', 'expense', 400000), cat('Varios', 'expense', null)]),
    ).toBe(400000)
  })

  it('no cuenta los ingresos, que no tienen presupuesto', () => {
    expect(
      totalMonthlyBudget([
        cat('Vivienda', 'expense', 400000),
        // Un ingreso no debería traer presupuesto, pero si lo trajera tampoco
        // se suma: lo presupuestado es lo que se planea gastar.
        cat('Sueldo', 'income', 999999),
      ]),
    ).toBe(400000)
  })

  it('sin nada presupuestado da cero', () => {
    expect(totalMonthlyBudget([])).toBe(0)
    expect(totalMonthlyBudget([cat('Varios', 'expense', null)])).toBe(0)
  })
})
