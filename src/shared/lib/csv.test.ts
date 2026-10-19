import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

const BOM = '﻿'

describe('toCsv', () => {
  it('separa con punto y coma y cierra cada fila con CRLF', () => {
    expect(toCsv(['A', 'B'], [['x', 'y']])).toBe(`${BOM}A;B\r\nx;y\r\n`)
  })

  it('escribe los decimales con coma', () => {
    expect(toCsv(['Peso'], [[102.5]])).toBe(`${BOM}Peso\r\n102,5\r\n`)
  })

  it('no arrastra ruido de coma flotante', () => {
    expect(toCsv(['n'], [[0.1 + 0.2]])).toBe(`${BOM}n\r\n0,3\r\n`)
  })

  it('deja vacíos null, undefined y números no finitos', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, Number.NaN]])).toBe(`${BOM}a;b;c\r\n;;\r\n`)
  })

  it('un cero es un dato, no una celda vacía', () => {
    expect(toCsv(['n'], [[0]])).toBe(`${BOM}n\r\n0\r\n`)
  })

  it('escribe los booleanos en español', () => {
    expect(toCsv(['ok'], [[true], [false]])).toBe(`${BOM}ok\r\nSí\r\nNo\r\n`)
  })

  it('entrecomilla lo que trae el separador, comillas o saltos de línea', () => {
    expect(toCsv(['t'], [['a;b'], ['dijo "hola"'], ['dos\nlíneas']])).toBe(
      `${BOM}t\r\n"a;b"\r\n"dijo ""hola"""\r\n"dos\nlíneas"\r\n`,
    )
  })

  it('una coma en un texto no necesita comillas', () => {
    expect(toCsv(['t'], [['pan, queso']])).toBe(`${BOM}t\r\npan, queso\r\n`)
  })
})
