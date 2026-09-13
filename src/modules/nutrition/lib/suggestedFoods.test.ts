import { describe, expect, it } from 'vitest'
import type { FoodItem, NutritionEntry } from '../domain/types'
import { suggestedFoods } from './suggestedFoods'

const food = (id: string, name: string, servingAmount = 100): FoodItem =>
  ({
    id,
    name,
    brand: '',
    emoji: '',
    servingAmount,
    servingUnit: 'g',
    order: 0,
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }) as FoodItem

/** Un registro de alimento. `seq` ordena dentro de un mismo día. */
const logged = (foodId: string, date: string, quantity = 100, seq = 0): NutritionEntry =>
  ({
    id: `${foodId}-${date}-${seq}`,
    date,
    sectionId: 's1',
    order: 0,
    kind: 'food',
    foodId,
    quantity,
    manualName: '',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    createdAt: `${date}T0${seq}:00:00.000Z`,
    updatedAt: `${date}T0${seq}:00:00.000Z`,
    deletedAt: null,
  }) as NutritionEntry

const manual = (date: string): NutritionEntry =>
  ({ ...logged('x', date), id: `m-${date}`, kind: 'manual', foodId: null, quantity: null }) as NutritionEntry

const AYER = '2026-09-12'
const names = (list: Array<{ food: FoodItem }>) => list.map((s) => s.food.name)

describe('suggestedFoods', () => {
  it('propone lo registrado desde recentSince, lo último primero', () => {
    const { recent } = suggestedFoods(
      [food('a', 'Acelga'), food('b', 'Pollo')],
      [logged('a', '2026-09-12'), logged('b', '2026-09-13')],
      { recentSince: AYER },
    )
    expect(names(recent)).toEqual(['Pollo', 'Acelga'])
  })

  it('deja fuera de recientes lo anterior a recentSince', () => {
    const { recent } = suggestedFoods(
      [food('a', 'Acelga'), food('b', 'Pollo')],
      [logged('a', '2026-09-01'), logged('b', '2026-09-13')],
      { recentSince: AYER },
    )
    expect(names(recent)).toEqual(['Pollo'])
  })

  it('ordena los frecuentes por veces registrado', () => {
    const { frequent } = suggestedFoods(
      [food('a', 'Acelga'), food('b', 'Pollo'), food('c', 'Arroz')],
      [
        logged('a', '2026-09-01'),
        logged('b', '2026-09-01', 100, 1),
        logged('b', '2026-09-02'),
        logged('b', '2026-09-03'),
        logged('c', '2026-09-02', 100, 1),
        logged('c', '2026-09-03', 100, 1),
      ],
      { recentSince: AYER },
    )
    expect(names(frequent)).toEqual(['Pollo', 'Arroz', 'Acelga'])
  })

  it('no repite en frecuentes lo que ya salió en recientes', () => {
    const { recent, frequent } = suggestedFoods(
      [food('a', 'Acelga'), food('b', 'Pollo')],
      [
        logged('a', '2026-09-01'),
        logged('a', '2026-09-02'),
        logged('a', '2026-09-13'),
        logged('b', '2026-09-01'),
      ],
      { recentSince: AYER },
    )
    expect(names(recent)).toEqual(['Acelga'])
    expect(names(frequent)).toEqual(['Pollo'])
  })

  it('con las mismas veces, alfabético', () => {
    const { frequent } = suggestedFoods(
      [food('a', 'Zapallo'), food('b', 'Almendra'), food('c', 'Ámbar')],
      [logged('a', '2026-09-01'), logged('b', '2026-09-01', 100, 1), logged('c', '2026-09-01', 100, 2)],
      { recentSince: AYER },
    )
    expect(names(frequent)).toEqual(['Almendra', 'Ámbar', 'Zapallo'])
  })

  it('propone la última cantidad usada, no la porción de la biblioteca', () => {
    const { recent } = suggestedFoods(
      [food('a', 'Pollo', 100)],
      [logged('a', '2026-09-01', 80), logged('a', '2026-09-13', 150)],
      { recentSince: AYER },
    )
    expect(recent[0].quantity).toBe(150)
  })

  it('ignora los registros manuales, que no tienen alimento que repetir', () => {
    const { recent, frequent } = suggestedFoods([food('a', 'Acelga')], [manual('2026-09-13')], {
      recentSince: AYER,
    })
    expect(recent).toEqual([])
    expect(frequent).toEqual([])
  })

  it('ignora lo que apunta a un alimento que ya no está en la biblioteca', () => {
    const { recent } = suggestedFoods([food('a', 'Acelga')], [logged('borrado', '2026-09-13')], {
      recentSince: AYER,
    })
    expect(recent).toEqual([])
  })

  it('recorta cada grupo al límite pedido', () => {
    const foods = ['a', 'b', 'c', 'd'].map((id) => food(id, id.toUpperCase()))
    const { recent } = suggestedFoods(
      foods,
      foods.map((f, i) => logged(f.id, '2026-09-13', 100, i)),
      { recentSince: AYER, limit: 2 },
    )
    expect(recent).toHaveLength(2)
  })

  it('sin registros no propone nada', () => {
    expect(suggestedFoods([food('a', 'Acelga')], [], { recentSince: AYER })).toEqual({
      recent: [],
      frequent: [],
    })
  })
})
