import { describe, expect, it } from 'vitest'
import { describePreviousWeekCopy } from './copyWeekNotice'

describe('describePreviousWeekCopy', () => {
  it('cuenta lo que se trajo', () => {
    expect(describePreviousWeekCopy({ copied: 6, kept: 0, skippedDays: 0 }, 2)).toBe(
      'Se trajeron 6 ejercicios de la Semana 2.',
    )
  })

  it('concuerda el singular', () => {
    expect(describePreviousWeekCopy({ copied: 1, kept: 1, skippedDays: 1 }, 1)).toBe(
      'Se trajo 1 ejercicio de la Semana 1. 1 ejercicio ya estaba planificado y quedó como estaba. 1 día quedó afuera: la semana no lo tiene, o ya se entrenó.',
    )
  })

  it('explica por qué vinieron menos de los esperados', () => {
    expect(describePreviousWeekCopy({ copied: 2, kept: 3, skippedDays: 0 }, 3)).toBe(
      'Se trajeron 2 ejercicios de la Semana 3. 3 ejercicios ya estaban planificados y quedaron como estaban.',
    )
  })

  it('dice que no se tocó nada cuando ya estaba todo', () => {
    expect(describePreviousWeekCopy({ copied: 0, kept: 4, skippedDays: 0 }, 2)).toBe(
      'No se trajo nada: ya estaba todo planificado.',
    )
  })

  it('avisa cuando la semana de origen está vacía', () => {
    expect(describePreviousWeekCopy({ copied: 0, kept: 0, skippedDays: 0 }, 2)).toBe(
      'La Semana 2 no tiene nada planificado.',
    )
  })

  it('no dice que el origen está vacío si lo que pasó es que se saltaron días', () => {
    expect(describePreviousWeekCopy({ copied: 0, kept: 0, skippedDays: 2 }, 1)).toBe(
      '2 días quedaron afuera: la semana no los tiene, o ya se entrenaron.',
    )
  })
})
