import { describe, expect, it } from 'vitest'
import { parseReps } from './reps'

describe('parseReps', () => {
  it('un entero se queda como está', () => {
    expect(parseReps('5')).toBe(5)
  })

  it('redondea el decimal que se coló', () => {
    expect(parseReps('5.4')).toBe(5)
    expect(parseReps('5.6')).toBe(6)
  })

  it('ignora los espacios de alrededor', () => {
    expect(parseReps(' 8 ')).toBe(8)
  })

  it('lo que no es número sigue sin serlo, y lo atajan los formularios', () => {
    expect(Number.isNaN(parseReps('abc'))).toBe(true)
  })
})
