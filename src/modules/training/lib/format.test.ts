import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatDate, formatDateWithWeekday } from './format'

// This app's tsconfig only pulls in browser globals; the vitest process
// (Node) still has `process.env` at runtime, so declare just enough of it
// to set TZ for this file's timezone regression test.
declare const process: { env: Record<string, string | undefined> }

describe('formatDate', () => {
  let originalTz: string | undefined

  beforeAll(() => {
    originalTz = process.env.TZ
    // A timezone behind UTC (Chile) reproduces the bug this guards against:
    // `new Date('2026-08-22')` parses as UTC midnight, which is still
    // 2026-08-21 evening in a UTC-behind zone — one calendar day early.
    process.env.TZ = 'America/Santiago'
  })

  afterAll(() => {
    process.env.TZ = originalTz
  })

  it('formats a bare YYYY-MM-DD date key as that same local day', () => {
    expect(formatDate('2026-08-22')).toBe('22/08/2026')
  })

  it('still formats a full ISO instant correctly', () => {
    expect(formatDate('2026-08-01T04:00:00.000Z')).toBe('01/08/2026')
  })
})

describe('formatDateWithWeekday', () => {
  it('prefixes the date with its short weekday name', () => {
    // 2026-08-29 is a Saturday.
    expect(formatDateWithWeekday('2026-08-29')).toBe('sáb 29/08/2026')
  })
})
