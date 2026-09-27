import { describe, expect, it } from 'vitest'
import { ringArcs } from './completionRing'

describe('ringArcs', () => {
  const radius = 10
  const circumference = 2 * Math.PI * radius

  it('devuelve un arco por módulo', () => {
    expect(ringArcs(radius, 2)).toHaveLength(4)
  })

  it('los cuatro arcos miden lo mismo', () => {
    const largos = ringArcs(radius, 2).map((a) => Number(a.dashArray.split(' ')[0]))
    expect(new Set(largos.map((l) => l.toFixed(6))).size).toBe(1)
  })

  it('los arcos más los huecos dan la vuelta entera', () => {
    const gap = 2
    const [primero] = ringArcs(radius, gap)
    const arco = Number(primero.dashArray.split(' ')[0])
    expect(arco * 4 + gap * 4).toBeCloseTo(circumference, 6)
  })

  it('cada arco arranca un cuarto de vuelta después del anterior', () => {
    const arcos = ringArcs(radius, 2)
    const pasos = arcos.slice(1).map((a, i) => arcos[i].dashOffset - a.dashOffset)
    for (const paso of pasos) expect(paso).toBeCloseTo(circumference / 4, 6)
  })

  it('el primer arco empieza medio hueco después del inicio, para quedar centrado', () => {
    expect(ringArcs(radius, 2)[0].dashOffset).toBeCloseTo(-1, 6)
  })

  it('un hueco más grande que el arco no produce un largo negativo', () => {
    const [primero] = ringArcs(radius, circumference)
    expect(Number(primero.dashArray.split(' ')[0])).toBe(0)
  })
})
