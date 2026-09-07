import type { AtlasNote } from '../domain/types'
import type { NoteIndex } from './atlasLinks'

/**
 * Grafo de fuerzas, escrito a mano en vez de traer d3: repulsión entre todos,
 * resorte por cada enlace y un tirón suave al centro.
 *
 * Es determinista a propósito — las posiciones de partida salen del id de cada
 * nota, no de `Math.random()`. Así el mismo mapa se ve igual cada vez que lo
 * abres, y el layout se puede probar con tests.
 */

export interface GraphNode {
  id: string
  title: string
  x: number
  y: number
  /** Cuántos enlaces toca, sumando ida y vuelta: decide el tamaño del punto. */
  degree: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width: number
  height: number
  /** El grado más alto del mapa: es la referencia para escalar los radios. */
  maxDegree: number
}

const SETTINGS = {
  iterations: 260,
  repulsion: 5200,
  springLength: 74,
  springStrength: 0.035,
  centerPull: 0.012,
  damping: 0.86,
  /** Ninguna fuerza puede mover un nodo más que esto en un paso: evita explosiones. */
  maxStep: 22,
  padding: 34,
  minRadius: 5,
  maxRadius: 15,
}

/** Hash estable del id → posición de partida repartida en un círculo. */
function seedAngle(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return ((hash >>> 0) % 3600) / 3600
}

export function nodeRadius(degree: number, maxDegree: number): number {
  if (maxDegree <= 0) return SETTINGS.minRadius
  const t = Math.min(degree / maxDegree, 1)
  return SETTINGS.minRadius + (SETTINGS.maxRadius - SETTINGS.minRadius) * Math.sqrt(t)
}

export function buildGraph(
  notes: AtlasNote[],
  index: NoteIndex,
  width: number,
  height: number,
): Graph {
  if (notes.length === 0) return { nodes: [], edges: [], width, height, maxDegree: 0 }

  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  for (const note of notes) {
    for (const targetId of index.outgoing.get(note.id) ?? []) {
      // El enlace es una arista sola aunque las dos notas se citen mutuamente.
      const key = note.id < targetId ? `${note.id}|${targetId}` : `${targetId}|${note.id}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: note.id, target: targetId })
    }
  }

  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2.6
  const points = notes.map((note, i) => {
    // El ángulo mezcla el hash con la posición para que no se solapen dos ids parecidos.
    const angle = (seedAngle(note.id) + i / notes.length) * Math.PI * 2
    return {
      id: note.id,
      title: note.title,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      degree: degree.get(note.id) ?? 0,
    }
  })
  const byId = new Map(points.map((p) => [p.id, p]))

  for (let step = 0; step < SETTINGS.iterations; step++) {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]
        const b = points[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let distSq = dx * dx + dy * dy
        if (distSq < 0.01) {
          // Dos nodos exactamente encima: se separan por su índice, no al azar,
          // para que el resultado siga siendo el mismo en cada ejecución.
          dx = (i - j) * 0.1
          dy = 0.1
          distSq = dx * dx + dy * dy
        }
        const dist = Math.sqrt(distSq)
        const force = SETTINGS.repulsion / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
    }

    for (const edge of edges) {
      const a = byId.get(edge.source)
      const b = byId.get(edge.target)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const force = (dist - SETTINGS.springLength) * SETTINGS.springStrength
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }

    for (const p of points) {
      p.vx += (cx - p.x) * SETTINGS.centerPull
      p.vy += (cy - p.y) * SETTINGS.centerPull
      p.vx *= SETTINGS.damping
      p.vy *= SETTINGS.damping
      p.x += Math.max(-SETTINGS.maxStep, Math.min(SETTINGS.maxStep, p.vx))
      p.y += Math.max(-SETTINGS.maxStep, Math.min(SETTINGS.maxStep, p.vy))
    }
  }

  // Se reencuadra al final: la simulación puede acabar descentrada o pasarse
  // de los bordes, y el mapa tiene que caber siempre en el lienzo.
  const maxDegree = Math.max(0, ...points.map((p) => p.degree))
  const margin = SETTINGS.padding + SETTINGS.maxRadius
  const minX = Math.min(...points.map((p) => p.x))
  const maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  const maxY = Math.max(...points.map((p) => p.y))
  const spanX = maxX - minX
  const spanY = maxY - minY
  const scale = Math.min(
    spanX > 1 ? (width - margin * 2) / spanX : 1,
    spanY > 1 ? (height - margin * 2) / spanY : 1,
    1.6,
  )

  const nodes: GraphNode[] = points.map((p) => ({
    id: p.id,
    title: p.title,
    x: cx + (p.x - (minX + spanX / 2)) * scale,
    y: cy + (p.y - (minY + spanY / 2)) * scale,
    degree: p.degree,
  }))

  return { nodes, edges, width, height, maxDegree }
}
