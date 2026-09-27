import { describe, expect, it } from 'vitest'
import {
  buildDayCompletion,
  missingBitacoraFields,
  pendingModules,
  REQUIRED_BITACORA_FIELDS,
} from './dayCompletion'
import type { ClosableModule, ClosureKind, DayClosure } from '../domain/types'
import type { DailyLog } from '../../training/domain/types'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }

const cierre = (
  module: ClosableModule,
  kind: ClosureKind = 'done',
  over: Partial<DayClosure> = {},
): DayClosure => ({
  id: `${module}-${kind}`,
  date: '2026-09-27',
  module,
  kind,
  ...base,
  ...over,
})

const bitacoraLlena = (over: Partial<DailyLog> = {}): DailyLog => ({
  id: 'log',
  date: '2026-09-27',
  bodyWeightKg: 70,
  calories: null,
  carbsG: null,
  proteinG: null,
  fatG: null,
  sleepHours: 7,
  creatineTaken: true,
  omega3Taken: false,
  vitaminDTaken: false,
  waterLiters: null,
  stress: 2,
  stimulants: 1,
  fatigue: 3,
  steps: 8000,
  ...base,
  ...over,
})

const build = (over: Partial<Parameters<typeof buildDayCompletion>[0]> = {}) =>
  buildDayCompletion({
    date: '2026-09-27',
    closures: [],
    log: undefined,
    ...over,
  })

describe('missingBitacoraFields', () => {
  it('sin bitácora, faltan todos los campos', () => {
    expect(missingBitacoraFields(undefined)).toHaveLength(REQUIRED_BITACORA_FIELDS.length)
  })

  it('con todos los campos, no falta ninguno', () => {
    expect(missingBitacoraFields(bitacoraLlena())).toEqual([])
  })

  it('nombra los que faltan', () => {
    const faltan = missingBitacoraFields(bitacoraLlena({ steps: null, sleepHours: null }))
    expect(faltan.map((f) => f.label)).toEqual(['Sueño', 'Pasos'])
  })

  it('un cero es un dato, no un campo vacío', () => {
    // Cero pasos un día de reposo es una respuesta; null es no haber contestado.
    expect(missingBitacoraFields(bitacoraLlena({ steps: 0, stress: 0 }))).toEqual([])
  })

  it('los suplementos no cuentan: desmarcado no se distingue de no contestado', () => {
    const sinSuplementos = bitacoraLlena({
      creatineTaken: false,
      omega3Taken: false,
      vitaminDTaken: false,
    })
    expect(missingBitacoraFields(sinSuplementos)).toEqual([])
  })

  it('el agua y los macros no cuentan: se leen de Nutrición', () => {
    expect(missingBitacoraFields(bitacoraLlena({ waterLiters: null, calories: null }))).toEqual([])
  })
})

describe('buildDayCompletion', () => {
  it('un día sin nada está entero pendiente', () => {
    const dia = build()
    expect(dia).toMatchObject({
      training: 'pending',
      nutrition: 'pending',
      finance: 'pending',
      bitacora: 'pending',
      doneCount: 0,
      complete: false,
    })
  })

  it('cerrar un módulo lo marca hecho', () => {
    expect(build({ closures: [cierre('training')] })).toMatchObject({
      training: 'done',
      doneCount: 1,
      complete: false,
    })
  })

  it('cerrar diciendo que no hubo nada también cuenta como completo', () => {
    // Un día de descanso no es un día pendiente.
    const dia = build({ closures: [cierre('training', 'none')] })
    expect(dia.training).toBe('empty')
    expect(dia.doneCount).toBe(1)
    expect(pendingModules(dia)).not.toContain('training')
  })

  it('la bitácora se da por cerrada sola cuando está completa', () => {
    expect(build({ log: bitacoraLlena() })).toMatchObject({
      bitacora: 'done',
      doneCount: 1,
    })
  })

  it('con todo cerrado y la bitácora llena, el día está completo', () => {
    const dia = build({
      closures: [cierre('training'), cierre('nutrition'), cierre('finance', 'none')],
      log: bitacoraLlena(),
    })
    expect(dia.complete).toBe(true)
    expect(dia.doneCount).toBe(4)
    expect(pendingModules(dia)).toEqual([])
  })

  it('dice qué módulos faltan, en el orden en que se leen', () => {
    const dia = build({ closures: [cierre('nutrition')] })
    expect(pendingModules(dia)).toEqual(['training', 'finance', 'bitacora'])
  })

  it('ignora los cierres de otro día', () => {
    const dia = build({ closures: [cierre('training', 'done', { date: '2026-09-26' })] })
    expect(dia.training).toBe('pending')
  })

  it('con dos cierres del mismo módulo manda el último', () => {
    // Cerré como "no entrené" y después me corregí.
    const dia = build({
      closures: [
        cierre('training', 'none', { id: 'a', updatedAt: '2026-09-27T10:00:00.000Z' }),
        cierre('training', 'done', { id: 'b', updatedAt: '2026-09-27T20:00:00.000Z' }),
      ],
    })
    expect(dia.training).toBe('done')
  })
})
