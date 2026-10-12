import { requireUserId } from '../../sync/lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { ClosableModule, ClosureKind, DayClosure } from '../domain/types'

/**
 * Ya no pasa por Dexie: habla directo con Supabase. Sin conexión no hay
 * cierres que leer ni que guardar.
 */
function client() {
  if (!supabase) throw new Error('Los cierres de día necesitan conexión para funcionar.')
  return supabase
}

/** Los cierres de un rango de fechas, ambas incluidas. */
export async function listClosuresInRange(from: string, to: string): Promise<DayClosure[]> {
  const { data, error } = await client()
    .from('day_closures')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return (data as DayClosure[]).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * El primer día que se cerró algo, o null si nunca.
 *
 * Es desde cuándo tiene sentido hablar de días pendientes: lo de antes no es
 * un día a medias, es un día de cuando esto no existía. Sin este piso, la
 * lista arranca con un mes de días vacíos y deja de servir el primer día.
 */
export async function firstClosureDate(): Promise<string | null> {
  const { data, error } = await client().from('day_closures').select('date').is('deletedAt', null)
  if (error) throw new Error(error.message)
  const dates = (data as Array<{ date: string }>).map((d) => d.date)
  if (dates.length === 0) return null
  return dates.sort()[0]
}

export async function listClosuresForDate(date: string): Promise<DayClosure[]> {
  const { data, error } = await client()
    .from('day_closures')
    .select('*')
    .eq('date', date)
    .is('deletedAt', null)
  if (error) throw new Error(error.message)
  return data as DayClosure[]
}

/**
 * Cierra un módulo en un día, o cambia cómo estaba cerrado.
 *
 * Reutiliza la fila que ya exista en vez de agregar otra: hay como mucho un
 * cierre por (fecha, módulo), y así corregir un "no entrené" por un "sí
 * entrené" se guarda como una edición y no como un alta más un borrado.
 */
export async function closeDay(
  date: string,
  module: ClosableModule,
  kind: ClosureKind,
): Promise<DayClosure> {
  const timestamp = nowIso()
  const existing = (await listClosuresForDate(date)).find((c) => c.module === module)

  if (existing) {
    const { error } = await client()
      .from('day_closures')
      .update({ kind, updatedAt: timestamp })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return { ...existing, kind, updatedAt: timestamp }
  }

  const closure: DayClosure = {
    id: generateId(),
    date,
    module,
    kind,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('day_closures').insert({ ...closure, userId })
  if (error) throw new Error(error.message)
  return closure
}

/** Deshace el cierre: el día vuelve a contar como pendiente en ese módulo. */
export async function reopenDay(date: string, module: ClosableModule): Promise<void> {
  const timestamp = nowIso()
  const existing = (await listClosuresForDate(date)).find((c) => c.module === module)
  if (!existing) return
  const { error } = await client()
    .from('day_closures')
    .update({ deletedAt: timestamp, updatedAt: timestamp })
    .eq('id', existing.id)
  if (error) throw new Error(error.message)
}
