import { describe, expect, it } from 'vitest'
import type { Week } from '../domain/types'
import { parseDateInput } from './calendarGrid'
import {
  compareWeeks,
  formatWeekRange,
  isCurrentWeek,
  isValidWeekRange,
  mesocycleIndexInMacro,
  suggestNextDayDate,
  suggestNextWeekRange,
  weekContains,
} from './weeks'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }
const week = (id: string, startDate: string, endDate: string, order = 0): Week => ({
  id,
  mesocycleId: null,
  order,
  startDate,
  endDate,
  ...base,
})

describe('compareWeeks', () => {
  it('ordena por fecha de inicio, no por el orden guardado', () => {
    const later = week('later', '2026-10-26', '2026-11-01', 0)
    const earlier = week('earlier', '2026-10-19', '2026-10-25', 5)
    expect([later, earlier].sort(compareWeeks).map((w) => w.id)).toEqual(['earlier', 'later'])
  })

  it('compara la fecha aunque venga como ISO completo', () => {
    const a = week('a', '2026-10-19T03:00:00.000Z', '2026-10-25T03:00:00.000Z')
    const b = week('b', '2026-10-12', '2026-10-18')
    expect([a, b].sort(compareWeeks).map((w) => w.id)).toEqual(['b', 'a'])
  })

  it('desempata por order cuando empiezan el mismo día', () => {
    const a = week('a', '2026-10-19', '2026-10-25', 1)
    const b = week('b', '2026-10-19', '2026-10-25', 0)
    expect([a, b].sort(compareWeeks).map((w) => w.id)).toEqual(['b', 'a'])
  })
})

describe('weekContains', () => {
  // Una semana de domingo a domingo: ocho días, ambos extremos incluidos.
  const w = week('w', '2026-10-18', '2026-10-25')

  it('incluye el primer y el último día', () => {
    expect(weekContains(w, '2026-10-18')).toBe(true)
    expect(weekContains(w, '2026-10-25')).toBe(true)
  })

  it('deja fuera lo anterior y lo posterior', () => {
    expect(weekContains(w, '2026-10-17')).toBe(false)
    expect(weekContains(w, '2026-10-26')).toBe(false)
  })
})

describe('formatWeekRange', () => {
  it('escribe día y mes abreviado', () => {
    expect(formatWeekRange({ startDate: '2026-10-19', endDate: '2026-10-25' })).toBe('19 oct – 25 oct')
  })

  it('cruza de mes sin confundirse', () => {
    expect(formatWeekRange({ startDate: '2026-10-26', endDate: '2026-11-01' })).toBe('26 oct – 1 nov')
  })
})

describe('suggestNextWeekRange', () => {
  it('sin semanas propone siete días desde hoy', () => {
    expect(suggestNextWeekRange([], parseDateInput('2026-10-19'))).toEqual({
      startDate: '2026-10-19',
      endDate: '2026-10-25',
    })
  })

  it('arranca el día siguiente a la última semana, aunque no termine en domingo', () => {
    const weeks = [week('a', '2026-10-12', '2026-10-18'), week('b', '2026-10-18', '2026-10-25')]
    expect(suggestNextWeekRange(weeks, parseDateInput('2026-01-01'))).toEqual({
      startDate: '2026-10-26',
      endDate: '2026-11-01',
    })
  })
})

describe('isValidWeekRange', () => {
  it('acepta un solo día y rechaza un fin anterior al inicio', () => {
    expect(isValidWeekRange('2026-10-19', '2026-10-19')).toBe(true)
    expect(isValidWeekRange('2026-10-19', '2026-10-18')).toBe(false)
    expect(isValidWeekRange('', '2026-10-18')).toBe(false)
  })
})

describe('suggestNextDayDate', () => {
  const w = week('w', '2026-10-19', '2026-10-25')

  it('sin días propone el primero de la semana', () => {
    expect(suggestNextDayDate(w, [])).toBe('2026-10-19')
  })

  it('propone el día siguiente al último que ya hay', () => {
    expect(suggestNextDayDate(w, ['2026-10-19T03:00:00.000Z', '2026-10-21T03:00:00.000Z'])).toBe('2026-10-22')
  })

  it('no se pasa del final de la semana', () => {
    expect(suggestNextDayDate(w, ['2026-10-25T03:00:00.000Z'])).toBe('2026-10-25')
  })
})

describe('isCurrentWeek', () => {
  it('es la que contiene hoy', () => {
    const w = week('w', '2026-10-18', '2026-10-25')
    expect(isCurrentWeek(w, '2026-10-19')).toBe(true)
    expect(isCurrentWeek(w, '2026-10-26')).toBe(false)
  })
})

describe('mesocycleIndexInMacro', () => {
  const all = [
    { id: 'b', macrocycleId: 'm1', order: 1 },
    { id: 'a', macrocycleId: 'm1', order: 0 },
    { id: 'x', macrocycleId: 'm2', order: 0 },
  ]

  it('cuenta por order dentro de su propio macrociclo', () => {
    expect(mesocycleIndexInMacro(all[0], all)).toBe(1)
    expect(mesocycleIndexInMacro(all[1], all)).toBe(0)
    expect(mesocycleIndexInMacro(all[2], all)).toBe(0)
  })
})
