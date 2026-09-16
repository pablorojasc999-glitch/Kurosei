import { describe, expect, it } from 'vitest'
import {
  intensifiedFactor,
  intensifierMultiplier,
  isIntensified,
} from './setIntensifiers'

describe('isIntensified', () => {
  it('cualquiera de las dos marcas cuenta', () => {
    expect(isIntensified({ dropSet: true, restPause: false })).toBe(true)
    expect(isIntensified({ dropSet: false, restPause: true })).toBe(true)
  })

  it('sin marcas, no', () => {
    expect(isIntensified({ dropSet: false, restPause: false })).toBe(false)
  })

  it('las series de antes del campo no cuentan como intensificadas', () => {
    expect(isIntensified({})).toBe(false)
    expect(isIntensified({ dropSet: undefined, restPause: undefined })).toBe(false)
  })
})

describe('intensifiedFactor', () => {
  it('un pecho al 0,8 pasa a 1,04', () => {
    expect(intensifiedFactor(0.8, { dropSet: true })).toBeCloseTo(1.04)
  })

  it('una serie normal no cambia', () => {
    expect(intensifiedFactor(0.8, { dropSet: false, restPause: false })).toBe(0.8)
    expect(intensifiedFactor(1, {})).toBe(1)
  })

  it('marcar las dos no encadena el bono', () => {
    expect(intensifiedFactor(1, { dropSet: true, restPause: true })).toBeCloseTo(1.3)
    expect(intensifierMultiplier({ dropSet: true, restPause: true })).toBeCloseTo(1.3)
  })

  it('un aporte de 0 sigue siendo 0', () => {
    expect(intensifiedFactor(0, { dropSet: true })).toBe(0)
  })
})
