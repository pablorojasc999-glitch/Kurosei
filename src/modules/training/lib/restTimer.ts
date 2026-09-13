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
