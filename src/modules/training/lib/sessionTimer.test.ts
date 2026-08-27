import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSessionTimerState,
  loadSessionTimerState,
  saveSessionTimerState,
  SESSION_TIMER_IDLE_MS,
  tickSessionTimer,
} from './sessionTimer'

beforeEach(() => {
  localStorage.clear()
})

describe('tickSessionTimer', () => {
  it('advances by one second when under the idle threshold', () => {
    const state = { activeSeconds: 10, lastActivityAt: 1000 }
    const next = tickSessionTimer(state, 1000 + SESSION_TIMER_IDLE_MS - 1)
    expect(next.activeSeconds).toBe(11)
  })

  it('freezes once idle past the threshold, without losing lastActivityAt', () => {
    const state = { activeSeconds: 10, lastActivityAt: 1000 }
    const next = tickSessionTimer(state, 1000 + SESSION_TIMER_IDLE_MS + 1)
    expect(next).toEqual(state)
  })

  it('reopening after hours of inactivity does not add that gap once activity resumes', () => {
    let state = { activeSeconds: 100, lastActivityAt: 0 }
    // idle for 3 hours: every tick past the 10-minute threshold is a no-op
    state = tickSessionTimer(state, 3 * 60 * 60 * 1000)
    expect(state.activeSeconds).toBe(100)

    // user interacts again, resetting lastActivityAt (done by the caller,
    // not tickSessionTimer itself) — subsequent ticks resume normally
    state = { ...state, lastActivityAt: 3 * 60 * 60 * 1000 }
    state = tickSessionTimer(state, 3 * 60 * 60 * 1000 + 1000)
    expect(state.activeSeconds).toBe(101)
  })
})

describe('load/save/clearSessionTimerState', () => {
  it('round-trips through localStorage', () => {
    saveSessionTimerState('abc', { activeSeconds: 42, lastActivityAt: 123 })
    expect(loadSessionTimerState('abc')).toEqual({ activeSeconds: 42, lastActivityAt: 123 })
  })

  it('returns null when nothing is stored', () => {
    expect(loadSessionTimerState('missing')).toBeNull()
  })

  it('returns null for malformed data instead of throwing', () => {
    localStorage.setItem('kurosei_session_timer_bad', 'not json')
    expect(loadSessionTimerState('bad')).toBeNull()
  })

  it('clears the stored state', () => {
    saveSessionTimerState('abc', { activeSeconds: 42, lastActivityAt: 123 })
    clearSessionTimerState('abc')
    expect(loadSessionTimerState('abc')).toBeNull()
  })
})
