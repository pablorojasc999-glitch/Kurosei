import { describe, expect, it } from 'vitest'
import { formatMoney, formatSignedMoney } from './money'

describe('formatMoney', () => {
  it('formats with dot thousands separator, no decimals, trailing $', () => {
    expect(formatMoney(102421)).toBe('102.421 $')
    expect(formatMoney(0)).toBe('0 $')
  })

  it('rounds fractional amounts', () => {
    expect(formatMoney(1999.6)).toBe('2.000 $')
  })
})

describe('formatSignedMoney', () => {
  it('prefixes with + or -', () => {
    expect(formatSignedMoney(19990, 1)).toBe('+19.990 $')
    expect(formatSignedMoney(19990, -1)).toBe('-19.990 $')
  })
})
