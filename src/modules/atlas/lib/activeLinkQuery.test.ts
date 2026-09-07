import { describe, expect, it } from 'vitest'
import { activeLinkQuery } from './atlasLinks'

describe('activeLinkQuery', () => {
  const at = (body: string) => activeLinkQuery(body, body.length)

  it('devuelve lo escrito tras un [[ abierto', () => {
    expect(at('Trabajar la [[sen')).toBe('sen')
    expect(at('Trabajar la [[')).toBe('')
  })

  it('no dispara si no hay [[', () => {
    expect(at('Trabajar la sentadilla')).toBeNull()
  })

  it('no dispara si el enlace ya está cerrado', () => {
    expect(at('Ver [[Técnica]] y seguir')).toBeNull()
  })

  it('no cruza un salto de línea', () => {
    expect(at('Ver [[\nsentadilla')).toBeNull()
  })

  it('usa el último [[ abierto, no el primero', () => {
    expect(at('Ver [[Técnica]] y [[pes')).toBe('pes')
  })

  it('mira sólo lo que hay antes del cursor', () => {
    const body = 'Ver [[sen]] después'
    expect(activeLinkQuery(body, 9)).toBe('sen')
    expect(activeLinkQuery(body, 8)).toBe('se')
    expect(activeLinkQuery(body, 4)).toBeNull()
  })
})
