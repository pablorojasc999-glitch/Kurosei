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
 *
 * `setOptimistic` es la salida de emergencia para que una pantalla muestre el
 * resultado de un alta/edición al toque, antes de que el servidor confirme
 * nada: el llamador construye el valor que va a quedar y lo escribe acá
 * directo. `refresh()` sigue siendo la fuente de verdad — al llamarla
 * después de escribir, lo que puso `setOptimistic` queda pisado por la
 * respuesta real del servidor (que es casi siempre idéntica) o corregido si
 * la escritura falló.
 */
export function useRemoteQuery<T>(
  queryFn: () => Promise<T>,
): {
  data: T | undefined
  error: Error | null
  refresh: () => Promise<void>
  setOptimistic: (updater: T | ((current: T | undefined) => T)) => void
} {
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

  const setOptimistic = useCallback((updater: T | ((current: T | undefined) => T)) => {
    setData((current) =>
      typeof updater === 'function' ? (updater as (current: T | undefined) => T)(current) : updater,
    )
  }, [])

  useEffect(() => {
    // Pedir al servidor al montar es justo el caso que un efecto cubre:
    // sincronizar con un sistema externo, no derivar un valor del render.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  return { data, error, refresh, setOptimistic }
}
