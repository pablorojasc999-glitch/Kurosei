import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * True once VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are set. Ya no es
 * opcional: cada módulo habla directo con Supabase, así que sin esto la
 * app no tiene nada que mostrar — sólo queda oculto el panel de cuenta.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null
