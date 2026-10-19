import { describe, expect, it } from 'vitest'
import type { FinanceAccount, FinanceCategory, FinanceTransaction } from '../domain/types'
import { buildTransactionsCsv } from './financeCsv'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }
const account = { id: 'a1', name: 'Cuenta RUT', emoji: '', kind: 'account', debtDirection: null, debtAmount: null, categoryId: null, revolving: false, order: 0, ...base } as FinanceAccount
const category = { id: 'c1', name: 'Comida', emoji: '', type: 'expense', order: 0, ...base } as FinanceCategory
const tx = (over: Partial<FinanceTransaction>): FinanceTransaction => ({
  id: 't',
  accountId: 'a1',
  categoryId: 'c1',
  type: 'expense',
  amount: 1000,
  date: '2026-08-10',
  financialMonth: '2026-08',
  notes: '',
  ...base,
  ...over,
})

const lines = (csv: string) => csv.replace('﻿', '').trimEnd().split('\r\n')

describe('buildTransactionsCsv', () => {
  it('usa los nombres de la cuenta y la categoría', () => {
    expect(lines(buildTransactionsCsv([tx({ notes: 'almuerzo' })], [account], [category]))).toEqual([
      'FECHA;MES FINANCIERO;TIPO;CUENTA;CATEGORÍA;MONTO;NOTAS',
      '2026-08-10;2026-08;Gasto;Cuenta RUT;Comida;1000;almuerzo',
    ])
  })

  it('ordena del más nuevo al más viejo', () => {
    const csv = buildTransactionsCsv(
      [tx({ id: 'a', date: '2026-08-01' }), tx({ id: 'b', date: '2026-08-20' })],
      [account],
      [category],
    )
    expect(lines(csv).slice(1).map((l) => l.split(';')[0])).toEqual(['2026-08-20', '2026-08-01'])
  })

  it('marca la cuenta o categoría borrada en vez de dejarla vacía', () => {
    const csv = buildTransactionsCsv([tx({ accountId: 'x', categoryId: 'y', type: 'income' })], [], [])
    expect(lines(csv)[1]).toBe('2026-08-10;2026-08;Ingreso;(cuenta eliminada);(categoría eliminada);1000;')
  })

  it('entrecomilla las notas con punto y coma', () => {
    const csv = buildTransactionsCsv([tx({ notes: 'pan; leche' })], [account], [category])
    expect(lines(csv)[1].endsWith(';"pan; leche"')).toBe(true)
  })
})
