import { e1rmForSet } from './e1rm'

/** Cómo se ordena el historial de un ejercicio a un número de reps dado. */
export type RepHistoryMode = 'recientes' | 'e1rm'

export const REP_HISTORY_MODE_LABELS: Record<RepHistoryMode, string> = {
  recientes: 'Recientes',
  e1rm: 'Mayor e1RM',
}

/**
 * Cuántas series se muestran. Suficiente para ver la tendencia de las últimas
 * semanas sin que el historial tape el registro de la serie que se está
 * haciendo, que es lo que se tiene delante en ese momento.
 */
export const REP_HISTORY_LIMIT = 7

export interface RepHistorySet {
  performedAt: string
  weightKg: number | null
  reps: number
  rpe: number | null
}

/** Null cuando la serie no tiene peso anotado: no hay 1RM que estimar. */
export function e1rmOfSet(set: RepHistorySet): number | null {
  return e1rmForSet(set)
}

/**
 * Las mejores `limit` series del historial, según lo que se quiera mirar:
 * las últimas que se hicieron, o las más pesadas en e1RM.
 *
 * Las dos desempatan por fecha descendente: entre dos series equivalentes,
 * la de hace una semana dice más que la de hace ocho meses.
 */
export function rankRepHistory<T extends RepHistorySet>(
  sets: T[],
  mode: RepHistoryMode,
  limit: number = REP_HISTORY_LIMIT,
): T[] {
  const byDateDesc = (a: T, b: T) =>
    new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
  // Las series sin peso no tienen e1RM, así que en ese orden van al final en
  // vez de competir con un cero que no significa nada.
  const byE1rmDesc = (a: T, b: T) => {
    const ea = e1rmOfSet(a)
    const eb = e1rmOfSet(b)
    if (ea === null && eb === null) return byDateDesc(a, b)
    if (ea === null) return 1
    if (eb === null) return -1
    return eb - ea || byDateDesc(a, b)
  }
  const sorted = [...sets].sort(mode === 'e1rm' ? byE1rmDesc : byDateDesc)
  return sorted.slice(0, Math.max(0, limit))
}
