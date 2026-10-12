import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { GroceryItem, PurchaseCadence } from '../domain/types'
import { todayKey } from '../lib/groceryCadence'

/**
 * Este módulo ya no pasa por Dexie: habla directo con Supabase, como
 * cualquier pantalla de una app en línea — se pide, se escribe, se vuelve a
 * pedir. Sin conexión no hay lista que mostrar ni cambio que guardar.
 */
function client() {
  if (!supabase) throw new Error('El súper necesita conexión para funcionar.')
  return supabase
}

export async function listItems(): Promise<GroceryItem[]> {
  const { data, error } = await client()
    .from('grocery_items')
    .select('*')
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as GroceryItem[]).sort((a, b) => a.order - b.order)
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

  const userId = await requireUserId()
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
  const { error } = await client()
    .from('grocery_items')
    .insert({ ...item, userId })
  if (error) throw new Error(error.message)
  return item
}

export interface UpdateItemInput {
  name?: string
  cadence?: PurchaseCadence
  quantity?: string
  note?: string
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<void> {
  const { data: item, error: getError } = await client()
    .from('grocery_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (getError) throw new Error(getError.message)
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
  if (input.cadence !== undefined && input.cadence !== (item as GroceryItem).cadence) {
    patch.cadence = input.cadence
    patch.order = await nextOrder(input.cadence)
  }

  const { error } = await client().from('grocery_items').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function toggleItemChecked(id: string): Promise<void> {
  const { data: item, error: getError } = await client()
    .from('grocery_items')
    .select('checked')
    .eq('id', id)
    .maybeSingle()
  if (getError) throw new Error(getError.message)
  if (!item) return
  const { error } = await client()
    .from('grocery_items')
    .update({ checked: !(item as { checked: boolean }).checked, updatedAt: nowIso() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Marca de golpe todo lo que ya toca reponer, para no ir uno por uno antes de salir. */
export async function checkAllDue(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await client()
    .from('grocery_items')
    .update({ checked: true, updatedAt: nowIso() })
    .in('id', ids)
  if (error) throw new Error(error.message)
}

export async function clearChecked(): Promise<void> {
  const checkedIds = (await listItems()).filter((i) => i.checked).map((i) => i.id)
  if (checkedIds.length === 0) return
  const { error } = await client()
    .from('grocery_items')
    .update({ checked: false, updatedAt: nowIso() })
    .in('id', checkedIds)
  if (error) throw new Error(error.message)
}

/**
 * Cierra la compra: todo lo marcado pasa a comprado hoy, se desmarca y pierde
 * la cantidad. Devuelve cuántos artículos se llevó.
 *
 * La cantidad también se borra porque era la nota de cuánto había que comprar,
 * y ya se compró. Dejándola, el artículo seguía arriba de la lista con su "2 kg"
 * el día después de haberlo traído, como si todavía hiciera falta.
 */
export async function completeShoppingRun(today = todayKey()): Promise<number> {
  const checkedIds = (await listItems()).filter((i) => i.checked).map((i) => i.id)
  if (checkedIds.length === 0) return 0
  const { error } = await client()
    .from('grocery_items')
    .update({ checked: false, quantity: '', lastBoughtAt: today, updatedAt: nowIso() })
    .in('id', checkedIds)
  if (error) throw new Error(error.message)
  return checkedIds.length
}

export async function softDeleteItem(id: string): Promise<void> {
  const timestamp = nowIso()
  const { error } = await client()
    .from('grocery_items')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
