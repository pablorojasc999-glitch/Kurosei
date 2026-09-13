import { describe, expect, it } from 'vitest'
import {
  addMonths,
  financialMonthOptions,
  formatMonthKey,
  monthKeyOfDate,
  toMonthKey,
  yearOfMonthKey,
} from './month'

describe('toMonthKey y monthKeyOfDate', () => {
  it('saca el YYYY-MM de una fecha', () => {
    expect(toMonthKey(new Date(2026, 8, 13))).toBe('2026-09')
    expect(monthKeyOfDate('2026-09-13')).toBe('2026-09')
  })

  it('rellena el mes con cero', () => {
    expect(toMonthKey(new Date(2026, 0, 5))).toBe('2026-01')
  })
})

describe('addMonths', () => {
  it('avanza y retrocede dentro del año', () => {
    expect(addMonths('2026-05', 1)).toBe('2026-06')
    expect(addMonths('2026-05', -1)).toBe('2026-04')
    expect(addMonths('2026-05', 0)).toBe('2026-05')
  })

  it('cruza el fin de año en los dos sentidos', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('salta más de un año', () => {
    expect(addMonths('2026-05', 14)).toBe('2027-07')
    expect(addMonths('2026-05', -17)).toBe('2024-12')
  })

  it('desde un mes corto no se salta ninguno', () => {
    // Con aritmética de Date, 31 de enero + 1 mes cae en marzo.
    expect(addMonths('2026-01', 1)).toBe('2026-02')
    expect(addMonths('2026-03', -1)).toBe('2026-02')
  })
})

describe('financialMonthOptions', () => {
  it('ofrece dos meses antes y dos después del de la fecha', () => {
    expect(financialMonthOptions('2026-09-13')).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ])
  })

  it('cruza el año sin romperse', () => {
    expect(financialMonthOptions('2026-01-05')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('incluye el mes ya elegido aunque quede fuera de la ventana', () => {
    // Si no, editar la transacción perdería en silencio su imputación.
    const opciones = financialMonthOptions('2026-09-13', '2027-03')
    expect(opciones).toContain('2027-03')
    expect(opciones).toHaveLength(6)
  })

  it('no repite el mes elegido si ya estaba', () => {
    expect(financialMonthOptions('2026-09-13', '2026-10')).toHaveLength(5)
  })

  it('siempre vienen ordenados', () => {
    const opciones = financialMonthOptions('2026-09-13', '2024-01')
    expect([...opciones].sort()).toEqual(opciones)
  })
})

describe('formatMonthKey y yearOfMonthKey', () => {
  it('se lee como mes y año', () => {
    expect(formatMonthKey('2026-09')).toContain('2026')
    expect(formatMonthKey('2026-09').toLowerCase()).toContain('septiembre')
  })

  it('saca el año', () => {
    expect(yearOfMonthKey('2026-09')).toBe(2026)
  })
})
