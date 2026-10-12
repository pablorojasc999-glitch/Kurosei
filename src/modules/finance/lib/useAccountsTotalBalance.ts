import { useCallback } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { getAccountsTotalBalance } from '../db/financeRepository'

/**
 * `refreshKey` es para la única pantalla que puede cambiar el saldo mientras
 * está montada (Transacciones): al cambiar, vuelve a pedirlo. Las demás lo
 * dejan sin pasar — vuelve a pedirse solo al entrar a esa pantalla, que
 * alcanza porque nada ahí cambia transacciones.
 */
export function useAccountsTotalBalance(refreshKey?: unknown): number | undefined {
  // `refreshKey` no se lee adentro: está para forzar el refetch, no para
  // calcular nada — como la `key` de React Query.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const { data } = useRemoteQuery(useCallback(() => getAccountsTotalBalance(), [refreshKey]))
  return data
}
