import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthStateChange } from '../../modules/sync/lib/auth'

/**
 * La sesión de Supabase, actualizada en vivo. `undefined` mientras se
 * consulta por primera vez — distinto de `null` (ya se consultó: no hay
 * sesión), para no mostrar "iniciá sesión" por un instante en cada carga.
 */
export function useSupabaseSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    getSession().then(setSession)
    return onAuthStateChange(setSession)
  }, [])

  return session
}
