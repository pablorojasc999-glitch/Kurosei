import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  checkAllDue,
  clearChecked,
  completeShoppingRun,
  createItem,
  listItems,
  softDeleteItem,
  toggleItemChecked,
  updateItem,
} from './groceryRepository'

beforeEach(async () => {
  await db.grocery_items.clear()
})

const names = (items: Awaited<ReturnType<typeof listItems>>) => items.map((i) => i.name)

describe('crear', () => {
  it('nace desmarcado, sin comprar y con los textos recortados', async () => {
    const item = await createItem({
      name: '  Leche  ',
      cadence: 'quincenal',
      quantity: '  2 L ',
      note: '  descremada ',
    })
    expect(item).toMatchObject({
      name: 'Leche',
      quantity: '2 L',
      note: 'descremada',
      checked: false,
      lastBoughtAt: null,
      order: 0,
    })
  })

  it('rechaza el nombre vacío', async () => {
    await expect(createItem({ name: '   ', cadence: 'mensual' })).rejects.toThrow(
      'El nombre no puede estar vacío.',
    )
  })

  it('rechaza el duplicado dentro de la misma lista, sin importar mayúsculas', async () => {
    await createItem({ name: 'Arroz', cadence: 'mensual' })
    await expect(createItem({ name: '  arroz ', cadence: 'mensual' })).rejects.toThrow(
      '"arroz" ya está en esa lista.',
    )
  })

  it('permite el mismo nombre en otra lista — comprar arroz al mes y a la quincena es distinto', async () => {
    await createItem({ name: 'Arroz', cadence: 'mensual' })
    await expect(createItem({ name: 'Arroz', cadence: 'quincenal' })).resolves.toBeDefined()
  })

  it('numera cada lista por separado', async () => {
    const a = await createItem({ name: 'A', cadence: 'quincenal' })
    const b = await createItem({ name: 'B', cadence: 'quincenal' })
    const c = await createItem({ name: 'C', cadence: 'mensual' })
    expect([a.order, b.order, c.order]).toEqual([0, 1, 0])
  })
})

describe('editar', () => {
  it('cambia nombre, cantidad y nota', async () => {
    const item = await createItem({ name: 'Leche', cadence: 'quincenal' })
    await updateItem(item.id, { name: 'Leche sin lactosa', quantity: '1 L', note: 'la azul' })
    expect((await listItems())[0]).toMatchObject({
      name: 'Leche sin lactosa',
      quantity: '1 L',
      note: 'la azul',
    })
  })

  it('reclasificar manda el artículo al final de la lista nueva', async () => {
    await createItem({ name: 'Ya estaba', cadence: 'mensual' })
    const item = await createItem({ name: 'Leche', cadence: 'quincenal' })
    await updateItem(item.id, { cadence: 'mensual' })
    const movido = (await listItems()).find((i) => i.id === item.id)
    expect(movido).toMatchObject({ cadence: 'mensual', order: 1 })
  })

  it('no toca el orden si la cadencia no cambia', async () => {
    await createItem({ name: 'Primero', cadence: 'mensual' })
    const item = await createItem({ name: 'Segundo', cadence: 'mensual' })
    await updateItem(item.id, { cadence: 'mensual', name: 'Segundo bis' })
    expect((await listItems()).find((i) => i.id === item.id)?.order).toBe(1)
  })

  it('vaciar la cantidad desmarca: "ya lo tengo" y "lo llevo" no conviven', async () => {
    const item = await createItem({ name: 'Manzana', cadence: 'quincenal', quantity: '4' })
    await toggleItemChecked(item.id)
    expect((await listItems())[0].checked).toBe(true)

    await updateItem(item.id, { quantity: '   ' })
    expect((await listItems())[0]).toMatchObject({ quantity: '', checked: false })
  })

  it('editar otra cosa no desmarca lo que ya estaba marcado', async () => {
    const item = await createItem({ name: 'Manzana', cadence: 'quincenal', quantity: '4' })
    await toggleItemChecked(item.id)
    await updateItem(item.id, { note: 'las rojas' })
    expect((await listItems())[0].checked).toBe(true)
  })

  it('rechaza dejar el nombre vacío', async () => {
    const item = await createItem({ name: 'Leche', cadence: 'quincenal' })
    await expect(updateItem(item.id, { name: '  ' })).rejects.toThrow(
      'El nombre no puede estar vacío.',
    )
  })
})

describe('marcar y cerrar la compra', () => {
  it('el check va y viene', async () => {
    const item = await createItem({ name: 'Leche', cadence: 'quincenal' })
    await toggleItemChecked(item.id)
    expect((await listItems())[0].checked).toBe(true)
    await toggleItemChecked(item.id)
    expect((await listItems())[0].checked).toBe(false)
  })

  it('cerrar la compra sella la fecha de lo marcado y lo desmarca', async () => {
    const marcado = await createItem({ name: 'Leche', cadence: 'quincenal' })
    await createItem({ name: 'Sal', cadence: 'esporadico' })
    await toggleItemChecked(marcado.id)

    expect(await completeShoppingRun('2026-03-16')).toBe(1)
    const items = await listItems()
    expect(items.find((i) => i.id === marcado.id)).toMatchObject({
      checked: false,
      lastBoughtAt: '2026-03-16',
    })
    // Lo que no estaba marcado no se compró: su ciclo sigue igual.
    expect(items.find((i) => i.name === 'Sal')?.lastBoughtAt).toBeNull()
  })

  it('cerrar sin nada marcado no cambia nada', async () => {
    await createItem({ name: 'Leche', cadence: 'quincenal' })
    expect(await completeShoppingRun('2026-03-16')).toBe(0)
    expect((await listItems())[0].lastBoughtAt).toBeNull()
  })

  it('marcar todo lo que toca, y vaciar la selección sin comprar', async () => {
    const a = await createItem({ name: 'A', cadence: 'quincenal' })
    const b = await createItem({ name: 'B', cadence: 'mensual' })
    await checkAllDue([a.id, b.id])
    expect((await listItems()).every((i) => i.checked)).toBe(true)

    await clearChecked()
    const items = await listItems()
    expect(items.every((i) => !i.checked)).toBe(true)
    // Vaciar no es comprar: nadie estrena fecha.
    expect(items.every((i) => i.lastBoughtAt === null)).toBe(true)
  })
})

describe('borrar', () => {
  it('lo saca de la lista sin tocar al resto', async () => {
    const a = await createItem({ name: 'A', cadence: 'quincenal' })
    await createItem({ name: 'B', cadence: 'quincenal' })
    await softDeleteItem(a.id)
    expect(names(await listItems())).toEqual(['B'])
  })

  it('el nombre borrado se puede volver a usar', async () => {
    const a = await createItem({ name: 'Leche', cadence: 'quincenal' })
    await softDeleteItem(a.id)
    await expect(createItem({ name: 'Leche', cadence: 'quincenal' })).resolves.toBeDefined()
  })
})
