import { describe, expect, it } from 'vitest'
import type { AtlasNote } from '../domain/types'
import { buildIndex } from './atlasLinks'
import { buildGraph, nodeRadius } from './atlasGraph'

const note = (id: string, title: string, body = ''): AtlasNote => ({
  id,
  title,
  body,
  level: 'desarrollo',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
})

const graphOf = (notes: AtlasNote[], w = 360, h = 480) =>
  buildGraph(notes, buildIndex(notes), w, h)

describe('buildGraph', () => {
  it('sin notas no hay grafo', () => {
    expect(graphOf([])).toEqual({ nodes: [], edges: [], width: 360, height: 480, maxDegree: 0 })
  })

  it('una arista por enlace, sin duplicar cuando las dos notas se citan', () => {
    const notes = [note('a', 'A', '[[B]]'), note('b', 'B', '[[A]]')]
    expect(graphOf(notes).edges).toHaveLength(1)
  })

  it('el grado cuenta ida y vuelta', () => {
    const notes = [
      note('hub', 'Hub', '[[A]] [[B]] [[C]]'),
      note('a', 'A'),
      note('b', 'B'),
      note('c', 'C'),
    ]
    const graph = graphOf(notes)
    expect(graph.nodes.find((n) => n.id === 'hub')?.degree).toBe(3)
    expect(graph.nodes.find((n) => n.id === 'a')?.degree).toBe(1)
    expect(graph.maxDegree).toBe(3)
  })

  it('es determinista: dos ejecuciones dan exactamente lo mismo', () => {
    const notes = [
      note('a', 'A', '[[B]] [[C]]'),
      note('b', 'B', '[[C]]'),
      note('c', 'C'),
      note('d', 'D'),
    ]
    expect(graphOf(notes).nodes).toEqual(graphOf(notes).nodes)
  })

  it('todo cabe dentro del lienzo', () => {
    const notes = Array.from({ length: 25 }, (_, i) =>
      note(`n${i}`, `Nota ${i}`, i > 0 ? `[[Nota ${i - 1}]]` : ''),
    )
    const graph = graphOf(notes, 360, 480)
    for (const n of graph.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(360)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(480)
    }
  })

  it('ninguna posición sale NaN, ni con notas sueltas ni con muchas', () => {
    const notes = Array.from({ length: 40 }, (_, i) => note(`n${i}`, `Nota ${i}`))
    for (const n of graphOf(notes).nodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })

  it('lo enlazado queda más junto que lo suelto', () => {
    const notes = [
      note('a', 'A', '[[B]]'),
      note('b', 'B'),
      note('solo', 'Suelta'),
    ]
    const graph = graphOf(notes)
    const at = (id: string) => graph.nodes.find((n) => n.id === id)!
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y)
    expect(dist(at('a'), at('b'))).toBeLessThan(dist(at('a'), at('solo')))
  })

  it('un enlace roto no crea nodo ni arista', () => {
    const graph = graphOf([note('a', 'A', '[[No existe]]')])
    expect(graph.nodes).toHaveLength(1)
    expect(graph.edges).toEqual([])
  })
})

describe('nodeRadius', () => {
  it('sin enlaces todos los puntos son del tamaño mínimo', () => {
    expect(nodeRadius(0, 0)).toBe(5)
  })

  it('crece con el grado y se corta en el máximo', () => {
    expect(nodeRadius(0, 10)).toBe(5)
    expect(nodeRadius(10, 10)).toBe(15)
    expect(nodeRadius(5, 10)).toBeGreaterThan(5)
    expect(nodeRadius(5, 10)).toBeLessThan(15)
    // Un grado por encima del máximo no dispara el radio.
    expect(nodeRadius(20, 10)).toBe(15)
  })
})
