import { describe, expect, it } from 'vitest'
import type { Day } from '../domain/types'
import { arrangeDaysBySlot } from './daySlots'

function day(id: string, date: string, slotIndex?: number | null): Day {
  return {
    id,
    weekId: 'w',
    date,
    label: '',
    planClosedAt: null,
    ...(slotIndex !== undefined ? { slotIndex } : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

const ids = (days: (Day | undefined)[]) => days.map((d) => d?.id ?? null)

describe('arrangeDaysBySlot', () => {
  it('sin posiciones fijadas ordena por fecha', () => {
    const days = [day('c', '2026-10-16'), day('a', '2026-10-12'), day('b', '2026-10-13')]
    expect(ids(arrangeDaysBySlot(days))).toEqual(['a', 'b', 'c'])
  })

  it('un día con posición fijada deja libre la que se salta', () => {
    const days = [day('a', '2026-10-12'), day('b', '2026-10-13'), day('c', '2026-10-16', 3)]
    expect(ids(arrangeDaysBySlot(days))).toEqual(['a', 'b', null, 'c'])
  })

  it('los días sin fijar rellenan los huecos en orden de fecha', () => {
    const days = [day('a', '2026-10-12', 1), day('b', '2026-10-13'), day('c', '2026-10-16')]
    expect(ids(arrangeDaysBySlot(days))).toEqual(['b', 'a', 'c'])
  })

  it('dos días que piden la misma posición no se pisan', () => {
    const days = [day('a', '2026-10-12', 0), day('b', '2026-10-13', 0)]
    expect(ids(arrangeDaysBySlot(days))).toEqual(['a', 'b'])
  })

  it('null o una posición inválida cuentan como sin fijar', () => {
    const days = [day('a', '2026-10-12', null), day('b', '2026-10-13', -1), day('c', '2026-10-14', 1.5)]
    expect(ids(arrangeDaysBySlot(days))).toEqual(['a', 'b', 'c'])
  })

  it('una semana sin días da una lista vacía', () => {
    expect(arrangeDaysBySlot([])).toEqual([])
  })
})
