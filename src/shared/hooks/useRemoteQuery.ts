import { useCallback, useEffect, useState } from 'react'

/**
 * Pide datos directo al servidor al montar, y expone `refresh` para volver a
 * pedirlos después de escribir — igual que una app "en línea": se pide, se
 * escribe, se vuelve a pedir. No hay copia local que mezclar ni versión
 * vieja que pisar: lo que muestra es siempre la última respuesta del
 * servidor.
 *
 * `queryFn` tiene que llegar ya memoizado con `useCallback` (con sus propias
 * dependencias) — así vuelve a pedir cuando cambia de qué depende la
 * consulta, sin que este hook necesite su propio array de dependencias.
 *
 * `data` queda en `undefined` mientras se resuelve el primer pedido, así las
 * pantallas pueden distinguir "todavía cargando" de "la lista vino vacía".
 */
export function useRemoteQuery<T>(
  queryFn: () => Promise<T>,
): { data: T | undefined; error: Error | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await queryFn()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'))
    }
  }, [queryFn])

  useEffect(() => {
    // Pedir al servidor al montar es justo el caso que un efecto cubre:
    // sincronizar con un sistema externo, no derivar un valor del render.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  return { data, error, refresh }
}
