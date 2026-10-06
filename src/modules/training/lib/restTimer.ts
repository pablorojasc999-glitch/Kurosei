/**
 * El descanso entre series, contado contra el reloj y no contra los tics.
 *
 * Contarlo restando uno cada segundo parece lo natural, pero en un teléfono es
 * justo lo que no funciona: al bloquear la pantalla o cambiar de app el
 * navegador frena o suspende los temporizadores, así que al volver el
 * cronómetro marca mucho menos de lo que de verdad pasó. Guardando *cuándo*
 * termina el descanso en vez de *cuánto* queda, lo que pase mientras tanto da
 * igual: al volver se resta y ya está.
 */
export type RestTimerState =
  | { status: 'running'; endsAt: number }
  | { status: 'paused'; remainingMs: number }

/** Arranca un descanso de `targetSeconds` a partir de `now` (ms de época). */
export function startRest(targetSeconds: number, now: number): RestTimerState {
  return { status: 'running', endsAt: now + targetSeconds * 1000 }
}

/**
 * Lo que queda, en segundos. Sigue en negativo cuando se pasa: haber descansado
 * de más es un dato útil, no un error que haya que esconder en cero.
 */
export function remainingSeconds(state: RestTimerState, now: number): number {
  const ms = state.status === 'running' ? state.endsAt - now : state.remainingMs
  return Math.round(ms / 1000)
}

export function pauseRest(state: RestTimerState, now: number): RestTimerState {
  if (state.status === 'paused') return state
  return { status: 'paused', remainingMs: state.endsAt - now }
}

export function resumeRest(state: RestTimerState, now: number): RestTimerState {
  if (state.status === 'running') return state
  return { status: 'running', endsAt: now + state.remainingMs }
}

/** Alarga el descanso en curso. No toca lo planificado: es "quiero 15 s más ahora", no "cambia mi plan". */
export function extendRest(
  state: RestTimerState,
  seconds: number,
  now: number,
): RestTimerState {
  const added = seconds * 1000
  if (state.status === 'paused') {
    return { status: 'paused', remainingMs: state.remainingMs + added }
  }
  // Desde `now` y no desde `endsAt`: si el descanso ya se pasó, "+15 s" tiene
  // que dar quince segundos de verdad, no acortar lo que ya se debe.
  const base = Math.max(state.endsAt, now)
  return { status: 'running', endsAt: base + added }
}

/** `2:05`, y `+0:12` cuando ya se pasó del descanso. */
export function formatRestClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '+' : ''
  const abs = Math.abs(totalSeconds)
  const minutes = Math.floor(abs / 60)
  const seconds = abs % 60
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * La clave de `localStorage` donde vive el descanso activo de un día — se
 * guarda ahí (no en Supabase) porque es puramente de esta pestaña: al
 * refrescar la página, en web, se perdía todo el estado de React y el
 * cronómetro arrancaba de cero aunque el descanso siguiera corriendo de
 * verdad. Guardando el mismo `RestTimerState` que ya se contaba contra el
 * reloj (ver arriba), reabrirlo no es distinto de haber cambiado de pantalla
 * y vuelto.
 */
export function restStorageKey(dayId: string): string {
  return `kurosei:rest:${dayId}`
}

/** El único descanso visible a la vez, con a qué ejercicio de la sesión pertenece. */
export interface PersistedRest {
  sessionExerciseId: string
  state: RestTimerState
}

function isRestTimerState(value: unknown): value is RestTimerState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.status === 'running') return typeof v.endsAt === 'number'
  if (v.status === 'paused') return typeof v.remainingMs === 'number'
  return false
}

/**
 * Valida lo que vino de `localStorage` antes de confiar en ello: puede estar
 * corrompido, vacío, o de una versión vieja de la app que guardaba otra
 * forma. `null` en cualquiera de esos casos es "no hay nada que restaurar",
 * no un error.
 */
export function parsePersistedRest(raw: string): PersistedRest | null {
  try {
    const parsed = JSON.parse(raw) as { sessionExerciseId?: unknown; state?: unknown }
    if (typeof parsed.sessionExerciseId !== 'string' || !isRestTimerState(parsed.state)) return null
    return { sessionExerciseId: parsed.sessionExerciseId, state: parsed.state }
  } catch {
    return null
  }
}
