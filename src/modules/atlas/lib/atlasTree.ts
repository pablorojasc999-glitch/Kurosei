import type { AtlasNode, MasteryLevel } from '../domain/types'

/** Un nodo con sus hijos ya resueltos, ordenado por `order`. */
export interface TreeNode {
  node: AtlasNode
  depth: number
  children: TreeNode[]
}

export interface LevelCounts {
  principiante: number
  desarrollo: number
  dominado: number
}

/** Caja de un nodo ya posicionada, lista para pintar en absoluto. */
export interface PlacedNode {
  id: string
  node: AtlasNode
  depth: number
  x: number
  y: number
  width: number
  height: number
}

/**
 * Una arista ya resuelta a path SVG. `direct` son las que salen de la raíz
 * (llevan resplandor y color de línea fuerte); `branch` son las ramas nietas,
 * más tenues y sin resplandor.
 */
export interface PlacedEdge {
  id: string
  path: string
  kind: 'direct' | 'branch'
  portX: number
  portY: number
  portSize: number
}

export interface Layout {
  nodes: PlacedNode[]
  edges: PlacedEdge[]
  width: number
  height: number
}

const EMPTY_COUNTS: LevelCounts = { principiante: 0, desarrollo: 0, dominado: 0 }

/** Ordena hermanos por `order` y desempata por `createdAt` para que el orden sea estable. */
function compareSiblings(a: AtlasNode, b: AtlasNode): number {
  if (a.order !== b.order) return a.order - b.order
  return a.createdAt.localeCompare(b.createdAt)
}

/** Arma el árbol desde la lista plana. Devuelve `null` si no hay raíz. */
export function buildTree(nodes: AtlasNode[]): TreeNode | null {
  const root = nodes.find((n) => n.parentId === null)
  if (!root) return null

  const childrenByParent = new Map<string, AtlasNode[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const siblings = childrenByParent.get(node.parentId)
    if (siblings) siblings.push(node)
    else childrenByParent.set(node.parentId, [node])
  }
  for (const siblings of childrenByParent.values()) siblings.sort(compareSiblings)

  // Iterativo en vez de recursivo: un ciclo en los datos colgaría el render,
  // así que se lleva la cuenta de lo ya visitado y se corta.
  const visited = new Set<string>([root.id])
  function attach(node: AtlasNode, depth: number): TreeNode {
    const children: TreeNode[] = []
    for (const child of childrenByParent.get(node.id) ?? []) {
      if (visited.has(child.id)) continue
      visited.add(child.id)
      children.push(attach(child, depth + 1))
    }
    return { node, depth, children }
  }
  return attach(root, 0)
}

/** Recorrido en profundidad: el orden exacto en el que se pintan las filas en móvil. */
export function flattenTree(tree: TreeNode | null): TreeNode[] {
  if (!tree) return []
  const out: TreeNode[] = []
  const walk = (t: TreeNode) => {
    out.push(t)
    for (const child of t.children) walk(child)
  }
  walk(tree)
  return out
}

export function countByLevel(nodes: AtlasNode[]): LevelCounts {
  return nodes.reduce<LevelCounts>(
    (acc, node) => ({ ...acc, [node.level]: acc[node.level] + 1 }),
    { ...EMPTY_COUNTS },
  )
}

/** Todos los descendientes de `id`, sin incluirlo. Usado para borrar en cascada y para el guardia de ciclos. */
export function collectDescendantIds(nodes: AtlasNode[], id: string): string[] {
  const childrenByParent = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    const siblings = childrenByParent.get(node.parentId)
    if (siblings) siblings.push(node.id)
    else childrenByParent.set(node.parentId, [node.id])
  }
  const out: string[] = []
  const seen = new Set<string>([id])
  const queue = [...(childrenByParent.get(id) ?? [])]
  while (queue.length > 0) {
    const current = queue.shift() as string
    if (seen.has(current)) continue
    seen.add(current)
    out.push(current)
    queue.push(...(childrenByParent.get(current) ?? []))
  }
  return out
}

/**
 * El árbol es estricto, así que reasignar padre solo vale si no crea un ciclo
 * ni mueve la raíz: un nodo no puede colgar de sí mismo ni de su descendencia.
 */
export function canReparent(
  nodes: AtlasNode[],
  nodeId: string,
  newParentId: string,
): boolean {
  if (nodeId === newParentId) return false
  const node = nodes.find((n) => n.id === nodeId)
  const newParent = nodes.find((n) => n.id === newParentId)
  if (!node || !newParent) return false
  if (node.parentId === null) return false // la raíz no se mueve
  if (node.profileId !== newParent.profileId) return false
  return !collectDescendantIds(nodes, nodeId).includes(newParentId)
}

// ---------------------------------------------------------------------
// Móvil — árbol indentado, codos ortogonales. Medidas tomadas de la
// pantalla 1f del diseño (390px de ancho).
// ---------------------------------------------------------------------

const MOBILE = {
  rootX: 16,
  rootWidth: 200,
  rootHeight: 40,
  parentX: 40,
  parentWidth: 300,
  parentHeight: 40,
  childX: 76,
  childWidth: 264,
  childHeight: 36,
  /** Cada nivel por debajo del 2 sigue indentando con el mismo paso. */
  indentStep: 36,
  topMargin: 20,
  /** Separaciones centro a centro, tal cual el diseño. */
  gapAfterRoot: 90,
  gapToFirstChild: 68,
  gapBetweenChildren: 64,
  gapToNextParent: 78,
  /** Codo: la espina baja desde `left + 15` del padre. */
  spineOffset: 15,
  bottomMargin: 28,
}

function mobileBox(depth: number): { x: number; width: number; height: number } {
  if (depth === 0) return { x: MOBILE.rootX, width: MOBILE.rootWidth, height: MOBILE.rootHeight }
  if (depth === 1)
    return { x: MOBILE.parentX, width: MOBILE.parentWidth, height: MOBILE.parentHeight }
  const extra = (depth - 2) * MOBILE.indentStep
  return {
    x: MOBILE.childX + extra,
    width: Math.max(MOBILE.childWidth - extra, 140),
    height: MOBILE.childHeight,
  }
}

/** Separación centro a centro entre dos filas consecutivas del árbol indentado. */
function mobileGap(prev: TreeNode, next: TreeNode): number {
  if (prev.depth === 0) return MOBILE.gapAfterRoot
  if (next.depth > prev.depth) return MOBILE.gapToFirstChild
  if (next.depth === prev.depth && next.depth >= 2) return MOBILE.gapBetweenChildren
  if (next.depth < prev.depth) return MOBILE.gapToNextParent
  return MOBILE.gapToNextParent
}

export function layoutMobile(nodes: AtlasNode[], width = 390): Layout {
  const rows = flattenTree(buildTree(nodes))
  if (rows.length === 0) return { nodes: [], edges: [], width, height: 0 }

  const placed: PlacedNode[] = []
  const byId = new Map<string, PlacedNode>()
  let center = MOBILE.topMargin + mobileBox(0).height / 2

  rows.forEach((row, index) => {
    if (index > 0) center += mobileGap(rows[index - 1], row)
    const box = mobileBox(row.depth)
    const item: PlacedNode = {
      id: row.node.id,
      node: row.node,
      depth: row.depth,
      x: box.x,
      y: center - box.height / 2,
      width: box.width,
      height: box.height,
    }
    placed.push(item)
    byId.set(item.id, item)
  })

  const edges: PlacedEdge[] = []
  for (const row of rows) {
    const parentId = row.node.parentId
    if (parentId === null) continue
    const child = byId.get(row.node.id)
    const parent = byId.get(parentId)
    if (!child || !parent) continue
    const spineX = parent.x + MOBILE.spineOffset
    const startY = parent.y + parent.height
    const endY = child.y + child.height / 2
    const direct = parent.depth === 0
    edges.push({
      id: child.id,
      path: `M${spineX},${startY} L${spineX},${endY} L${child.x},${endY}`,
      kind: direct ? 'direct' : 'branch',
      portSize: direct ? 6 : 5,
      portX: spineX - (direct ? 3 : 3),
      portY: startY - 3,
    })
  }

  const last = placed[placed.length - 1]
  return {
    nodes: placed,
    edges,
    width,
    height: last.y + last.height + MOBILE.bottomMargin,
  }
}

// ---------------------------------------------------------------------
// Escritorio — columnas fijas y curvas bézier. Medidas de la pantalla 1a.
// ---------------------------------------------------------------------

const DESKTOP = {
  columnX: [40, 360, 690],
  columnStep: 330,
  nodeWidth: 210,
  nodeHeight: 44,
  /** Hojas consecutivas del mismo padre; entre subárboles se separa un poco más. */
  leafGap: 100,
  subtreeGap: 120,
  topMargin: 52,
  bottomMargin: 60,
  rightMargin: 60,
}

function desktopX(depth: number): number {
  return depth < DESKTOP.columnX.length
    ? DESKTOP.columnX[depth]
    : DESKTOP.columnX[DESKTOP.columnX.length - 1] +
        (depth - DESKTOP.columnX.length + 1) * DESKTOP.columnStep
}

/**
 * Árbol ordenado clásico: cada hoja ocupa una ranura y cada nodo interno se
 * centra sobre sus hijos — así la raíz cae en el promedio de sus ramas, igual
 * que en el diseño.
 */
export function layoutDesktop(nodes: AtlasNode[]): Layout {
  const tree = buildTree(nodes)
  if (!tree) return { nodes: [], edges: [], width: 0, height: 0 }

  const centerById = new Map<string, number>()
  let cursor = DESKTOP.topMargin + DESKTOP.nodeHeight / 2
  let lastLeafParent: string | null = null

  function assign(item: TreeNode): number {
    if (item.children.length === 0) {
      const parentKey = item.node.parentId
      if (lastLeafParent !== null) {
        cursor += lastLeafParent === parentKey ? DESKTOP.leafGap : DESKTOP.subtreeGap
      }
      lastLeafParent = parentKey
      centerById.set(item.node.id, cursor)
      return cursor
    }
    const childCenters = item.children.map(assign)
    const center = childCenters.reduce((a, b) => a + b, 0) / childCenters.length
    centerById.set(item.node.id, center)
    return center
  }
  assign(tree)

  const rows = flattenTree(tree)
  const placed: PlacedNode[] = rows.map((row) => {
    const center = centerById.get(row.node.id) ?? DESKTOP.topMargin
    return {
      id: row.node.id,
      node: row.node,
      depth: row.depth,
      x: desktopX(row.depth),
      y: center - DESKTOP.nodeHeight / 2,
      width: DESKTOP.nodeWidth,
      height: DESKTOP.nodeHeight,
    }
  })
  const byId = new Map(placed.map((p) => [p.id, p]))

  const edges: PlacedEdge[] = []
  for (const row of rows) {
    const parentId = row.node.parentId
    if (parentId === null) continue
    const child = byId.get(row.node.id)
    const parent = byId.get(parentId)
    if (!child || !parent) continue
    const x1 = parent.x + parent.width
    const y1 = parent.y + parent.height / 2
    const x2 = child.x
    const y2 = child.y + child.height / 2
    const mid = (x1 + x2) / 2
    edges.push({
      id: child.id,
      // Recta cuando padre e hijo comparten `y`; bézier horizontal si no.
      path: y1 === y2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`,
      kind: parent.depth === 0 ? 'direct' : 'branch',
      portSize: 6,
      portX: x1 - 3,
      portY: y1 - 3,
    })
  }

  const maxRight = Math.max(...placed.map((p) => p.x + p.width))
  const maxBottom = Math.max(...placed.map((p) => p.y + p.height))
  return {
    nodes: placed,
    edges,
    width: maxRight + DESKTOP.rightMargin,
    height: maxBottom + DESKTOP.bottomMargin,
  }
}

/** Reparte 3 tramos proporcionales para la barra de balance; 0 nodos = barra vacía. */
export function levelShares(counts: LevelCounts): LevelCounts {
  const total = counts.principiante + counts.desarrollo + counts.dominado
  if (total === 0) return { ...EMPTY_COUNTS }
  return counts
}

export const LEVEL_COLOR: Record<MasteryLevel, string> = {
  principiante: '#EC3013',
  desarrollo: '#E8A22A',
  dominado: '#3FBF7F',
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  principiante: 'Principiante',
  desarrollo: 'En desarrollo',
  dominado: 'Dominado',
}

/** Etiquetas cortas del selector de nivel, tal cual el diseño: ROJO / ÁMBAR / VERDE. */
export const LEVEL_SHORT: Record<MasteryLevel, string> = {
  principiante: 'ROJO',
  desarrollo: 'ÁMBAR',
  dominado: 'VERDE',
}
