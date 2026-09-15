import { describe, expect, it } from 'vitest'
import {
  endIsoFromTime,
  formatSessionDuration,
  sessionDurationMinutes,
  toTimeInput,
  withTimeOfDay,
} from './sessionTimes'

/** Un instante cualquiera; lo que importa es la hora local, no la zona del equipo. */
const inicio = new Date(2026, 8, 14, 18, 5).toISOString()

describe('toTimeInput / withTimeOfDay', () => {
  it('ida y vuelta: lo que se escribe es lo que se lee', () => {
    expect(toTimeInput(withTimeOfDay(inicio, '07:30') as string)).toBe('07:30')
    expect(toTimeInput(withTimeOfDay(inicio, '23:59') as string)).toBe('23:59')
    expect(toTimeInput(withTimeOfDay(inicio, '00:00') as string)).toBe('00:00')
  })

  it('conserva la fecha de la sesión', () => {
    const cambiado = new Date(withTimeOfDay(inicio, '06:00') as string)
    expect(cambiado.getFullYear()).toBe(2026)
    expect(cambiado.getMonth()).toBe(8)
    expect(cambiado.getDate()).toBe(14)
  })

  it('rechaza una hora que no existe', () => {
    for (const malo of ['24:00', '12:60', '7:30', '', 'ab:cd', '12:5']) {
      expect(withTimeOfDay(inicio, malo)).toBeNull()
    }
  })

  it('una fecha inválida no revienta', () => {
    expect(toTimeInput('no es fecha')).toBe('')
    expect(withTimeOfDay('no es fecha', '10:00')).toBeNull()
  })
})

describe('endIsoFromTime', () => {
  it('el término del mismo día queda en el mismo día', () => {
    const fin = endIsoFromTime(inicio, '19:30') as string
    expect(sessionDurationMinutes(inicio, fin)).toBe(85)
  })

  it('terminar antes de empezar se entiende como cruzar la medianoche', () => {
    const nocturno = new Date(2026, 8, 14, 23, 30).toISOString()
    const fin = endIsoFromTime(nocturno, '00:45') as string
    expect(sessionDurationMinutes(nocturno, fin)).toBe(75)
    expect(new Date(fin).getDate()).toBe(15)
  })

  it('terminar a la misma hora que se empezó dura cero, no un día', () => {
    const fin = endIsoFromTime(inicio, '18:05') as string
    expect(sessionDurationMinutes(inicio, fin)).toBe(0)
  })
})

describe('sessionDurationMinutes', () => {
  it('sin término todavía no hay duración', () => {
    expect(sessionDurationMinutes(inicio, null)).toBeNull()
  })

  it('nunca da negativo', () => {
    const antes = new Date(2026, 8, 14, 17, 0).toISOString()
    expect(sessionDurationMinutes(inicio, antes)).toBe(0)
  })
})

describe('formatSessionDuration', () => {
  it('se lee como se dice', () => {
    expect(formatSessionDuration(0)).toBe('0 min')
    expect(formatSessionDuration(45)).toBe('45 min')
    expect(formatSessionDuration(60)).toBe('1 h')
    expect(formatSessionDuration(85)).toBe('1 h 25 min')
    expect(formatSessionDuration(125)).toBe('2 h 5 min')
  })
})
