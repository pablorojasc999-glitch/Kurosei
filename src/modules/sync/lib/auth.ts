import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../shared/supabase/client'

const NOT_CONFIGURED_ERROR = 'La sincronización no está configurada.'

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<void> {
  if (!supabase) throw new Error(NOT_CONFIGURED_ERROR)
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<void> {
  if (!supabase) throw new Error(NOT_CONFIGURED_ERROR)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** El `userId` de la sesión activa, para estampar filas nuevas antes de guardarlas. */
export async function requireUserId(): Promise<string> {
  const session = await getSession()
  if (!session) throw new Error('Iniciá sesión para guardar cambios.')
  return session.user.id
}

/** Subscribes to auth state changes; returns an unsubscribe function. */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
