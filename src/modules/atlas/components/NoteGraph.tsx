import { useMemo } from 'react'
import type { AtlasNote } from '../domain/types'
import { buildGraph, nodeRadius } from '../lib/atlasGraph'
import { LEVEL_COLOR, type NoteIndex } from '../lib/atlasLinks'

interface NoteGraphProps {
  notes: AtlasNote[]
  index: NoteIndex
  width: number
  height: number
  selectedId: string | null
  onSelect: (id: string) => void
}

/** El grafo: un punto por nota, del color de su nivel, y una línea por enlace. */
export function NoteGraph({
  notes,
  index,
  width,
  height,
  selectedId,
  onSelect,
}: NoteGraphProps) {
  // El layout es caro y determinista: sólo se recalcula si cambian las notas.
  const graph = useMemo(
    () => buildGraph(notes, index, width, height),
    [notes, index, width, height],
  )
  const levelById = useMemo(
    () => new Map(notes.map((n) => [n.id, n.level])),
    [notes],
  )
  const positions = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph],
  )

  if (graph.nodes.length === 0) {
    return <p className="empty-hint">Crea tu primera nota para ver el grafo.</p>
  }

  const neighbours = new Set<string>()
  if (selectedId) {
    for (const id of index.outgoing.get(selectedId) ?? []) neighbours.add(id)
    for (const id of index.backlinks.get(selectedId) ?? []) neighbours.add(id)
  }

  return (
    <svg
      className="note-graph"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label={`Grafo de ${graph.nodes.length} notas`}
    >
      <g>
        {graph.edges.map((edge) => {
          const a = positions.get(edge.source)
          const b = positions.get(edge.target)
          if (!a || !b) return null
          const active =
            selectedId !== null &&
            (edge.source === selectedId || edge.target === selectedId)
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              className={`note-graph-edge${active ? ' note-graph-edge--active' : ''}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
            />
          )
        })}
      </g>
      <g>
        {graph.nodes.map((node) => {
          const radius = nodeRadius(node.degree, graph.maxDegree)
          const level = levelById.get(node.id) ?? 'desarrollo'
          const isSelected = node.id === selectedId
          // Con una nota elegida, lo que no la toca se apaga para que se lea
          // su vecindario en vez de todo el mapa a la vez.
          const dimmed = selectedId !== null && !isSelected && !neighbours.has(node.id)
          return (
            <g
              key={node.id}
              className={`note-graph-node${dimmed ? ' note-graph-node--dim' : ''}`}
              onClick={() => onSelect(node.id)}
              role="button"
              tabIndex={0}
              aria-label={node.title}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(node.id)
              }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={LEVEL_COLOR[level]}
                className={isSelected ? 'note-graph-dot--selected' : undefined}
              />
              <text x={node.x} y={node.y + radius + 11} textAnchor="middle">
                {node.title.length > 18 ? `${node.title.slice(0, 17)}…` : node.title}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
