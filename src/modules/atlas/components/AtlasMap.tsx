import { useEffect, useRef, useState } from 'react'
import type { AtlasNode, MasteryLevel } from '../domain/types'
import { MASTERY_LEVELS } from '../domain/types'
import {
  LEVEL_COLOR,
  LEVEL_LABEL,
  canReparent,
  countByLevel,
  layoutDesktop,
  layoutMobile,
  type PlacedNode,
} from '../lib/atlasTree'

const LONG_PRESS_MS = 350
const MOVE_CANCEL_PX = 10
/** Id del nodo borrador: vive solo en el layout, nunca llega a la base. */
const DRAFT_ID = '__atlas-draft__'

interface DragMeta {
  nodeId: string
  pointerId: number
  startX: number
  startY: number
  timer: number
  started: boolean
}

interface AtlasMapProps {
  profileName: string
  nodes: AtlasNode[]
  desktop: boolean
  selectedId: string | null
  draftParentId: string | null
  draftLevel: MasteryLevel
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onRequestDraft: (parentId: string) => void
  onDraftLevel: (level: MasteryLevel) => void
  onDraftSave: (name: string) => void
  onDraftCancel: () => void
  onReparent: (nodeId: string, newParentId: string) => void
}

export function AtlasMap({
  profileName,
  nodes,
  desktop,
  selectedId,
  draftParentId,
  draftLevel,
  onSelect,
  onOpen,
  onRequestDraft,
  onDraftLevel,
  onDraftSave,
  onDraftCancel,
  onReparent,
}: AtlasMapProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const draftInputRef = useRef<HTMLInputElement | null>(null)
  const dragMeta = useRef<DragMeta | null>(null)
  /* El navegador dispara `click` después de soltar. Como el estado de arrastre
     ya se limpió para entonces, hace falta una marca síncrona para no abrir el
     nodo que se acaba de mover. */
  const justDragged = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [flashId, setFlashId] = useState<string | null>(null)

  // El borrador entra al layout como un hijo más, así cae en su sitio del
  // árbol y su arista se dibuja sola — solo cambia cómo se pinta.
  const draftNode: AtlasNode | null = draftParentId
    ? {
        id: DRAFT_ID,
        profileId: nodes[0]?.profileId ?? '',
        parentId: draftParentId,
        name: draftName,
        level: draftLevel,
        note: '',
        order: Number.MAX_SAFE_INTEGER,
        createdAt: '9999',
        updatedAt: '9999',
        deletedAt: null,
      }
    : null
  const laidOut = draftNode ? [...nodes, draftNode] : nodes
  const layout = desktop ? layoutDesktop(laidOut) : layoutMobile(laidOut)
  const byId = new Map(layout.nodes.map((n) => [n.id, n]))
  const childCount = new Map<string, number>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    childCount.set(node.parentId, (childCount.get(node.parentId) ?? 0) + 1)
  }

  // Cada vez que el borrador cambia de padre arranca vacío. Se ajusta durante
  // el render (patrón recomendado) en vez de en un efecto, que provocaría un
  // segundo render con el nombre viejo pintado.
  const [draftFor, setDraftFor] = useState<string | null>(draftParentId)
  if (draftParentId !== draftFor) {
    setDraftFor(draftParentId)
    setDraftName('')
  }

  useEffect(() => {
    // El input nace con el foco puesto: se escribe y se pulsa ↵.
    if (draftParentId) draftInputRef.current?.focus()
  }, [draftParentId])

  function stagePoint(e: React.PointerEvent): { x: number; y: number } | null {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function nodeAt(point: { x: number; y: number }, exceptId: string): PlacedNode | null {
    for (const placed of layout.nodes) {
      if (placed.id === exceptId || placed.id === DRAFT_ID) continue
      if (
        point.x >= placed.x &&
        point.x <= placed.x + placed.width &&
        point.y >= placed.y &&
        point.y <= placed.y + placed.height
      ) {
        return placed
      }
    }
    return null
  }

  function handlePointerDown(nodeId: string, e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (nodeId === DRAFT_ID) return
    const target = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    const timer = window.setTimeout(() => {
      const meta = dragMeta.current
      if (!meta || meta.nodeId !== nodeId) return
      meta.started = true
      target.setPointerCapture(pointerId)
      setDraggingId(nodeId)
    }, LONG_PRESS_MS)
    dragMeta.current = {
      nodeId,
      pointerId,
      startX: e.clientX,
      startY: e.clientY,
      timer,
      started: false,
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const meta = dragMeta.current
    if (!meta || meta.pointerId !== e.pointerId) return
    if (!meta.started) {
      if (Math.hypot(e.clientX - meta.startX, e.clientY - meta.startY) > MOVE_CANCEL_PX) {
        window.clearTimeout(meta.timer)
        dragMeta.current = null
      }
      return
    }
    e.preventDefault()
    const point = stagePoint(e)
    if (!point) return
    setDragPoint(point)
    const over = nodeAt(point, meta.nodeId)
    setDropTargetId(over && canReparent(nodes, meta.nodeId, over.id) ? over.id : null)
  }

  function handlePointerUp(e: React.PointerEvent) {
    const meta = dragMeta.current
    if (!meta || meta.pointerId !== e.pointerId) return
    window.clearTimeout(meta.timer)
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
    if (meta.started) {
      justDragged.current = true
      if (dropTargetId) {
        onReparent(meta.nodeId, dropTargetId)
        setFlashId(meta.nodeId)
        window.setTimeout(() => setFlashId(null), 200)
      }
    }
    dragMeta.current = null
    setDraggingId(null)
    setDragPoint(null)
    setDropTargetId(null)
  }

  function commitDraft() {
    const name = draftName.trim()
    if (!name) {
      onDraftCancel()
      return
    }
    onDraftSave(name)
    setFlashId(DRAFT_ID)
    window.setTimeout(() => setFlashId(null), 200)
  }

  const counts = countByLevel(nodes)
  const total = nodes.length
  const weakest = nodes.find((n) => n.parentId !== null && n.level === 'principiante')
  const dragOrigin = draggingId ? byId.get(draggingId) : null
  const dropTarget = dropTargetId ? byId.get(dropTargetId) : null
  const selected = selectedId ? byId.get(selectedId) : null
  const draftPlaced = draftNode ? byId.get(DRAFT_ID) : null

  return (
    <div className="atlas-canvas">
      <div
        ref={stageRef}
        className="atlas-stage"
        style={{ width: layout.width, height: layout.height, minWidth: '100%' }}
      >
        <svg
          className="atlas-edges"
          width={layout.width}
          height={layout.height}
          aria-hidden="true"
        >
          {/* El resplandor es una copia de la ruta bajo la línea real. */}
          <g opacity={0.32} strokeWidth={desktop ? 3.5 : 3}>
            {layout.edges
              .filter((edge) => edge.kind === 'direct' && edge.id !== DRAFT_ID)
              .map((edge) => (
                <path
                  key={edge.id}
                  className={`atlas-edge-glow${flashId === edge.id ? ' atlas-edge-glow--flash' : ''}`}
                  d={edge.path}
                />
              ))}
          </g>
          <g strokeWidth={1}>
            {layout.edges
              .filter((edge) => edge.id !== DRAFT_ID)
              .map((edge) => (
                <path
                  key={edge.id}
                  className={`atlas-edge${edge.kind === 'branch' ? ' atlas-edge--branch' : ''}`}
                  d={edge.path}
                />
              ))}
          </g>
          {/* El borrador cuelga de una línea punteada roja hasta que se confirma. */}
          {layout.edges
            .filter((edge) => edge.id === DRAFT_ID)
            .map((edge) => (
              <path key={edge.id} className="atlas-edge-drag" d={edge.path} />
            ))}
          <g>
            {layout.edges
              .filter((edge) => edge.id !== DRAFT_ID)
              .map((edge) => (
                <rect
                  key={edge.id}
                  className="atlas-port"
                  x={edge.portX}
                  y={edge.portY}
                  width={edge.portSize}
                  height={edge.portSize}
                />
              ))}
          </g>
          {dragOrigin && dragPoint && (
            <path
              className="atlas-edge-drag"
              d={`M${dragOrigin.x + dragOrigin.width / 2},${dragOrigin.y + dragOrigin.height / 2} L${dragPoint.x},${dragPoint.y}`}
            />
          )}
        </svg>

        {selected && !draftPlaced && (
          <div
            className="atlas-selection-ring"
            style={{
              left: selected.x - 8,
              top: selected.y - 8,
              width: selected.width + 16,
              height: selected.height + 16,
            }}
          />
        )}

        {dropTarget && (
          <div
            className="atlas-drop-ring"
            style={{
              left: dropTarget.x + dropTarget.width / 2 - 16,
              top: dropTarget.y + dropTarget.height / 2 - 16,
              width: 32,
              height: 32,
            }}
          />
        )}

        {layout.nodes.map((placed) => {
          if (placed.id === DRAFT_ID) {
            return (
              <div
                key={placed.id}
                className="atlas-draft"
                style={{
                  left: placed.x,
                  top: placed.y,
                  width: placed.width,
                  height: placed.height,
                  borderLeftColor: LEVEL_COLOR[draftLevel],
                }}
              >
                <input
                  ref={draftInputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitDraft()
                    if (e.key === 'Escape') onDraftCancel()
                  }}
                  placeholder="Nombre del nodo"
                  aria-label="Nombre del nodo nuevo"
                />
              </div>
            )
          }

          const node = placed.node
          const isRoot = placed.depth === 0
          const kids = childCount.get(node.id) ?? 0
          const meta = isRoot
            ? desktop
              ? 'RAÍZ'
              : ''
            : selectedId === node.id && desktop
              ? 'ABRIR ↵'
              : kids > 0
                ? desktop
                  ? String(kids)
                  : `${kids} ›`
                : ''

          return (
            <div
              key={placed.id}
              className={[
                'atlas-node',
                isRoot && 'atlas-node--root',
                placed.depth >= 2 && 'atlas-node--child',
                selectedId === node.id && 'atlas-node--selected',
                draggingId === node.id && 'atlas-node--dragging',
                dropTargetId === node.id && 'atlas-node--drop-target',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                left: placed.x,
                top: placed.y,
                width: placed.width,
                height: placed.height,
                ...(isRoot
                  ? { borderColor: LEVEL_COLOR[node.level] }
                  : { borderLeftColor: LEVEL_COLOR[node.level] }),
              }}
              role="button"
              tabIndex={0}
              aria-label={`${node.name} · ${LEVEL_LABEL[node.level]}`}
              onPointerDown={(e) => handlePointerDown(node.id, e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => {
                if (justDragged.current) {
                  justDragged.current = false
                  return
                }
                if (selectedId === node.id) onOpen(node.id)
                else onSelect(node.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpen(node.id)
                if (e.key.toLowerCase() === 'r') onSelect(node.id)
              }}
            >
              <span className="atlas-node-name">{node.name}</span>
              {meta && <span className="atlas-node-meta">{meta}</span>}
              {desktop && (
                <button
                  type="button"
                  className="atlas-node-port"
                  style={{ left: placed.width - 8, top: placed.height / 2 - 8 }}
                  aria-label={`Añadir un nodo bajo ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRequestDraft(node.id)
                  }}
                >
                  +
                </button>
              )}
            </div>
          )
        })}

        {/* Paleta de nivel del borrador: R / A / V o clic. */}
        {draftPlaced && (
          <>
            <div
              className="atlas-level-swatches"
              style={{ left: draftPlaced.x, top: draftPlaced.y + draftPlaced.height + 20 }}
            >
              {MASTERY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`atlas-swatch${draftLevel === level ? ' atlas-swatch--active' : ''}`}
                  style={{ background: LEVEL_COLOR[level] }}
                  aria-label={LEVEL_LABEL[level]}
                  aria-pressed={draftLevel === level}
                  onClick={() => onDraftLevel(level)}
                />
              ))}
            </div>
            <div
              className="atlas-draft-hint"
              style={{ left: draftPlaced.x + 172, top: draftPlaced.y + draftPlaced.height + 28 }}
            >
              ESCRIBE Y PULSA ↵
            </div>
          </>
        )}

        {desktop && (
          <div className="atlas-map-card">
            <div className="atlas-eyebrow" style={{ marginBottom: 14 }}>
              TU MAPA · {profileName.toUpperCase()}
            </div>
            <div className="atlas-legend">
              {MASTERY_LEVELS.map((level) => (
                <div key={level} className="atlas-legend-row">
                  <span
                    className="atlas-legend-dot"
                    style={{ background: LEVEL_COLOR[level] }}
                  />
                  <span className="atlas-legend-name">{LEVEL_LABEL[level]}</span>
                  <span className="atlas-legend-count">{counts[level]}</span>
                </div>
              ))}
            </div>
            <div className="atlas-hairline" style={{ margin: '14px 0' }} />
            <div style={{ display: 'flex', height: 6 }}>
              {MASTERY_LEVELS.map((level) => (
                <span
                  key={level}
                  style={{ flex: counts[level] || 0, background: LEVEL_COLOR[level] }}
                />
              ))}
            </div>
            <div className="atlas-note-hint" style={{ marginTop: 10 }}>
              {weakest
                ? `${weakest.name} es tu punto débil. Empieza ahí.`
                : total > 1
                  ? 'Ningún nodo en rojo ahora mismo.'
                  : 'Cuelga el primer nodo de la raíz.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
