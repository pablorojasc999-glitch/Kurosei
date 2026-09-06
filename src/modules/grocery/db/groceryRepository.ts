import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { GroceryItem, PurchaseCadence } from '../domain/types'
import { todayKey } from '../lib/groceryCadence'

export async function listItems(): Promise<GroceryItem[]> {
  const items = await db.grocery_items.filter((i) => i.deletedAt === null).toArray()
  return items.sort((a, b) => a.order - b.order)
}

async function nextOrder(cadence: PurchaseCadence): Promise<number> {
  const siblings = (await listItems()).filter((i) => i.cadence === cadence)
  return siblings.length ? Math.max(...siblings.map((i) => i.order)) + 1 : 0
}

export interface CreateItemInput {
  name: string
  cadence: PurchaseCadence
  quantity?: string
  note?: string
}

export async function createItem(input: CreateItemInput): Promise<GroceryItem> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre no puede estar vacío.')

  // Dos filas con el mismo nombre en la misma lista sólo generan confusión al
  // marcar la compra, así que se rechaza igual que en la biblioteca.
  const duplicate = (await listItems()).find(
    (i) => i.cadence === input.cadence && i.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (duplicate) throw new Error(`"${name}" ya está en esa lista.`)

  const timestamp = nowIso()
  const item: GroceryItem = {
    id: generateId(),
    name,
    cadence: input.cadence,
    quantity: input.quantity?.trim() ?? '',
    note: input.note?.trim() ?? '',
    checked: false,
    lastBoughtAt: null,
    order: await nextOrder(input.cadence),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.grocery_items.add(item)
  return item
}

export interface UpdateItemInput {
  name?: string
  cadence?: PurchaseCadence
  quantity?: string
  note?: string
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<void> {
  const item = await db.grocery_items.get(id)
  if (!item) return
  const patch: Partial<GroceryItem> = { updatedAt: nowIso() }

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('El nombre no puede estar vacío.')
    patch.name = name
  }
  if (input.quantity !== undefined) {
    patch.quantity = input.quantity.trim()
    // Vaciar la cantidad es decir "ya lo tengo": dejarlo marcado para la compra
    // sería el estado contrario a la vez.
    if (patch.quantity === '') patch.checked = false
  }
  if (input.note !== undefined) patch.note = input.note.trim()
  // Reclasificar es mover de lista: el artículo se va al final de la nueva.
  if (input.cadence !== undefined && input.cadence !== item.cadence) {
    patch.cadence = input.cadence
    patch.order = await nextOrder(input.cadence)
  }

  await db.grocery_items.update(id, patch)
}

export async function toggleItemChecked(id: string): Promise<void> {
  const item = await db.grocery_items.get(id)
  if (!item) return
  await db.grocery_items.update(id, { checked: !item.checked, updatedAt: nowIso() })
}

/** Marca de golpe todo lo que ya toca reponer, para no ir uno por uno antes de salir. */
export async function checkAllDue(ids: string[]): Promise<void> {
  const timestamp = nowIso()
  await Promise.all(
    ids.map((id) => db.grocery_items.update(id, { checked: true, updatedAt: timestamp })),
  )
}

export async function clearChecked(): Promise<void> {
  const timestamp = nowIso()
  const checked = (await listItems()).filter((i) => i.checked)
  await Promise.all(
    checked.map((i) => db.grocery_items.update(i.id, { checked: false, updatedAt: timestamp })),
  )
}

/**
 * Cierra la compra: todo lo marcado pasa a comprado hoy y se desmarca, que es
 * lo que reinicia su ciclo. Devuelve cuántos artículos se llevó.
 */
export async function completeShoppingRun(today = todayKey()): Promise<number> {
  const timestamp = nowIso()
  const checked = (await listItems()).filter((i) => i.checked)
  await Promise.all(
    checked.map((i) =>
      db.grocery_items.update(i.id, {
        checked: false,
        lastBoughtAt: today,
        updatedAt: timestamp,
      }),
    ),
  )
  return checked.length
}

export async function softDeleteItem(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.grocery_items.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}
