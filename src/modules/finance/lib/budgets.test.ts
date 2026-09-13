import { describe, expect, it } from 'vitest'
import type { FinanceCategoryBudget } from '../domain/types'
import { budgetChangesAnything, budgetForMonth, budgetsForMonth } from './budgets'

const budget = (
  categoryId: string,
  effectiveFrom: string,
  amount: number,
): FinanceCategoryBudget => ({
  id: `${categoryId}-${effectiveFrom}`,
  categoryId,
  effectiveFrom,
  amount,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
})

describe('budgetForMonth', () => {
  const historial = [
    budget('vivienda', '2026-01', 400000),
    budget('vivienda', '2026-09', 450000),
    budget('mercado', '2026-03', 100000),
  ]

  it('usa la vigencia que estaba puesta en ese mes', () => {
    expect(budgetForMonth(historial, 'vivienda', '2026-01')).toBe(400000)
    expect(budgetForMonth(historial, 'vivienda', '2026-05')).toBe(400000)
  })

  it('un presupuesto rige desde su mes en adelante', () => {
    expect(budgetForMonth(historial, 'vivienda', '2026-09')).toBe(450000)
    expect(budgetForMonth(historial, 'vivienda', '2026-12')).toBe(450000)
    expect(budgetForMonth(historial, 'vivienda', '2027-06')).toBe(450000)
  })

  it('cambiarlo en septiembre no toca lo que regía en agosto', () => {
    // El punto de todo el modelo: el pasado no se reescribe.
    expect(budgetForMonth(historial, 'vivienda', '2026-08')).toBe(400000)
  })

  it('antes de la primera vigencia no hay presupuesto', () => {
    expect(budgetForMonth(historial, 'mercado', '2026-02')).toBeNull()
    expect(budgetForMonth(historial, 'vivienda', '2025-12')).toBeNull()
  })

  it('una categoría sin vigencias no tiene presupuesto', () => {
    expect(budgetForMonth(historial, 'streaming', '2026-05')).toBeNull()
  })

  it('no se confunde entre categorías', () => {
    expect(budgetForMonth(historial, 'mercado', '2026-09')).toBe(100000)
  })

  it('no depende del orden en que vengan las vigencias', () => {
    const desordenado = [
      budget('vivienda', '2026-09', 450000),
      budget('vivienda', '2026-01', 400000),
      budget('vivienda', '2026-05', 420000),
    ]
    expect(budgetForMonth(desordenado, 'vivienda', '2026-06')).toBe(420000)
  })

  it('un presupuesto de 0 es un presupuesto, no la ausencia de uno', () => {
    const conCero = [budget('ocio', '2026-01', 50000), budget('ocio', '2026-06', 0)]
    expect(budgetForMonth(conCero, 'ocio', '2026-07')).toBe(0)
  })

  it('sin historial no hay nada que buscar', () => {
    expect(budgetForMonth([], 'vivienda', '2026-01')).toBeNull()
  })
})

describe('budgetsForMonth', () => {
  it('devuelve la vigencia de cada categoría en ese mes', () => {
    const mapa = budgetsForMonth(
      [
        budget('vivienda', '2026-01', 400000),
        budget('vivienda', '2026-09', 450000),
        budget('mercado', '2026-03', 100000),
        budget('ocio', '2027-01', 30000),
      ],
      '2026-09',
    )
    expect([...mapa].sort()).toEqual([
      ['mercado', 100000],
      ['vivienda', 450000],
    ])
  })

  it('un mes sin ninguna vigencia todavía da un mapa vacío', () => {
    expect(budgetsForMonth([budget('vivienda', '2026-05', 400000)], '2026-04').size).toBe(0)
  })
})

describe('budgetChangesAnything', () => {
  const historial = [budget('vivienda', '2026-01', 400000)]

  it('guardar el mismo monto que ya regía no cambia nada', () => {
    expect(budgetChangesAnything(historial, 'vivienda', '2026-05', 400000)).toBe(false)
  })

  it('un monto distinto sí cambia', () => {
    expect(budgetChangesAnything(historial, 'vivienda', '2026-05', 450000)).toBe(true)
  })

  it('quitar el presupuesto donde había cambia', () => {
    expect(budgetChangesAnything(historial, 'vivienda', '2026-05', null)).toBe(true)
  })

  it('no poner presupuesto donde no había no cambia nada', () => {
    expect(budgetChangesAnything(historial, 'streaming', '2026-05', null)).toBe(false)
  })
})
