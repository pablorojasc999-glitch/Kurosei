/**
 * Live session-duration timer that freezes during idle stretches, instead
 * of always reading straight off `Date.now() - session.startedAt`. Reopening
 * the app hours after walking away from a session used to make the clock
 * jump by all those hours; this tracks accumulated *active* seconds plus the
 * last detected user activity, persisted in localStorage so it survives a
 * reload, and simply stops accumulating once idle for too long.
 */
export const SESSION_TIMER_IDLE_MS = 10 * 60 * 1000

export interface SessionTimerState {
  activeSeconds: number
  lastActivityAt: number
}

export function sessionTimerStorageKey(sessionId: string): string {
  return `kurosei_session_timer_${sessionId}`
}

export function loadSessionTimerState(sessionId: string): SessionTimerState | null {
  try {
    const raw = localStorage.getItem(sessionTimerStorageKey(sessionId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SessionTimerState).activeSeconds === 'number' &&
      typeof (parsed as SessionTimerState).lastActivityAt === 'number'
    ) {
      return parsed as SessionTimerState
    }
  } catch {
    // malformed JSON or storage unavailable (private mode) — start fresh
  }
  return null
}

export function saveSessionTimerState(sessionId: string, state: SessionTimerState): void {
  try {
    localStorage.setItem(sessionTimerStorageKey(sessionId), JSON.stringify(state))
  } catch {
    // storage unavailable — the timer just won't survive a reload
  }
}

export function clearSessionTimerState(sessionId: string): void {
  try {
    localStorage.removeItem(sessionTimerStorageKey(sessionId))
  } catch {
    // storage unavailable — nothing to clear
  }
}

/** One second of wall-clock time passing: advances only while under the idle threshold. */
export function tickSessionTimer(state: SessionTimerState, now: number): SessionTimerState {
  if (now - state.lastActivityAt > SESSION_TIMER_IDLE_MS) return state
  return { ...state, activeSeconds: state.activeSeconds + 1 }
}
