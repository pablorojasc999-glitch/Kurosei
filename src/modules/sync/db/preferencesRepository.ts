import { requireUserId } from '../lib/auth'
import { supabase } from '../../../shared/supabase/client'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'

/** Ya no pasa por Dexie: habla directo con Supabase. */
function client() {
  if (!supabase) throw new Error('Las preferencias necesitan conexión para funcionar.')
  return supabase
}

/** Las cinco pestañas de Registro — la única pantalla que puede ser "inicio". */
export type HomeTab = 'constancia' | 'entrenamiento' | 'nutricion' | 'finanzas' | 'supermercado'

export interface AppPreferences {
  id: string
  homeTab: HomeTab
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * La fila única de preferencias de la cuenta — misma idea que
 * `training_user_profile`: una fila por cuenta, nunca una copia local. Si hay
 * más de una (dos pestañas escribiendo casi a la vez, antes de que
 * `setHomeTab` llegara a borrar el duplicado) gana la más nueva.
 */
export async function getPreferences(): Promise<AppPreferences | null> {
  const { data, error } = await client().from('app_preferences').select('*').is('deletedAt', null)
  if (error) throw new Error(error.message)
  const rows = data as AppPreferences[]
  if (rows.length === 0) return null
  return rows.reduce((latest, p) => (p.updatedAt > latest.updatedAt ? p : latest))
}

/** Crea la fila de preferencias en el primer guardado, la edita en el lugar después. */
export async function setHomeTab(homeTab: HomeTab): Promise<AppPreferences> {
  const existing = await getPreferences()
  const timestamp = nowIso()
  if (existing) {
    const { error } = await client()
      .from('app_preferences')
      .update({ homeTab, updatedAt: timestamp })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    await deleteDuplicatePreferences(existing.id, timestamp)
    return { ...existing, homeTab, updatedAt: timestamp }
  }
  const row: AppPreferences = {
    id: generateId(),
    homeTab,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const userId = await requireUserId()
  const { error } = await client().from('app_preferences').insert({ ...row, userId })
  if (error) throw new Error(error.message)
  return row
}

/** Soft-deletes every preferences row except `keepId` (see `getPreferences`). */
async function deleteDuplicatePreferences(keepId: string, timestamp: string): Promise<void> {
  const { data, error } = await client().from('app_preferences').select('id').is('deletedAt', null)
  if (error) throw new Error(error.message)
  const others = (data as Array<{ id: string }>).filter((p) => p.id !== keepId)
  for (const { id } of others) {
    const { error: updateError } = await client()
      .from('app_preferences')
      .update({ deletedAt: timestamp, updatedAt: timestamp })
      .eq('id', id)
    if (updateError) throw new Error(updateError.message)
  }
}
