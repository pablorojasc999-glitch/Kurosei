import { describe, expect, it } from 'vitest'
import { countTrainingDays, type TrainingDayMark } from './trainingDayCounts'

const dia = (date: string, strength: boolean, cardio: boolean): TrainingDayMark => ({
  date,
  strength,
  cardio,
})

const SEPTIEMBRE: TrainingDayMark[] = [
  dia('2026-09-01', true, true),
  dia('2026-09-02', true, true),
  dia('2026-09-05', false, true),
  dia('2026-09-06', true, true),
  dia('2026-09-09', true, true),
  dia('2026-09-10', false, true),
  dia('2026-08-28', true, false),
  dia('2025-09-15', true, true),
]

describe('countTrainingDays', () => {
  it('cuenta los días de fuerza y de cardio del mes', () => {
    expect(countTrainingDays(SEPTIEMBRE, '2026-09')).toEqual({ strength: 4, cardio: 6 })
  })

  it('con el prefijo del año cuenta el año entero', () => {
    // Agosto entra; el septiembre del año pasado, no.
    expect(countTrainingDays(SEPTIEMBRE, '2026')).toEqual({ strength: 5, cardio: 6 })
  })

  it('deja fuera los meses que no son el pedido', () => {
    expect(countTrainingDays(SEPTIEMBRE, '2026-08')).toEqual({ strength: 1, cardio: 0 })
  })

  it('un día con las dos cosas cuenta en las dos', () => {
    expect(countTrainingDays([dia('2026-09-01', true, true)], '2026-09')).toEqual({
      strength: 1,
      cardio: 1,
    })
  })

  it('un día planificado pero sin entrenar no cuenta', () => {
    expect(countTrainingDays([dia('2026-09-04', false, false)], '2026-09')).toEqual({
      strength: 0,
      cardio: 0,
    })
  })

  it('no cuenta dos veces el mismo día', () => {
    // Dos registros para la misma fecha: sigue siendo un día entrenado.
    expect(
      countTrainingDays([dia('2026-09-01', true, false), dia('2026-09-01', true, false)], '2026-09'),
    ).toEqual({ strength: 1, cardio: 0 })
  })

  it('un mes sin nada da cero', () => {
    expect(countTrainingDays(SEPTIEMBRE, '2026-12')).toEqual({ strength: 0, cardio: 0 })
  })

  it('sin días no falla', () => {
    expect(countTrainingDays([], '2026-09')).toEqual({ strength: 0, cardio: 0 })
  })
})
