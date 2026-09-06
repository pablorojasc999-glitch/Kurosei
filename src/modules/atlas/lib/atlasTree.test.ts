import { describe, expect, it } from 'vitest'
import {
  buildTree,
  canReparent,
  collectDescendantIds,
  countByLevel,
  flattenTree,
  layoutDesktop,
  layoutMobile,
} from './atlasTree'
import type { AtlasNode, MasteryLevel } from '../domain/types'

let seq = 0
function node(
  id: string,
  parentId: string | null,
  level: MasteryLevel = 'desarrollo',
  order = seq++,
): AtlasNode {
  return {
    id,
    profileId: 'p1',
    parentId,
    name: id,
    level,
    note: '',
    order,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  }
}

/** El árbol de la pantalla 1a/1f del diseño: raíz + 4 ramas + 5 hojas = 10 nodos. */
function powerliftingTree(): AtlasNode[] {
  seq = 0
  return [
    node('raiz', null, 'desarrollo'),
    node('sentadilla', 'raiz', 'desarrollo'),
    node('tobillo', 'sentadilla', 'principiante'),
    node('bracing', 'sentadilla', 'dominado'),
    node('banca', 'raiz', 'dominado'),
    node('arco', 'banca', 'dominado'),
    node('pesomuerto', 'raiz', 'principiante'),
    node('bisagra', 'pesomuerto', 'desarrollo'),
    node('recuperacion', 'raiz', 'principiante'),
    node('sueno', 'recuperacion', 'principiante'),
  ]
}

describe('buildTree', () => {
  it('arma la jerarquía y ordena los hermanos por order', () => {
    const tree = buildTree(powerliftingTree())
    expect(tree?.node.id).toBe('raiz')
    expect(tree?.children.map((c) => c.node.id)).toEqual([
      'sentadilla',
      'banca',
      'pesomuerto',
      'recuperacion',
    ])
    expect(tree?.children[0].children.map((c) => c.node.id)).toEqual(['tobillo', 'bracing'])
    expect(tree?.children[0].depth).toBe(1)
    expect(tree?.children[0].children[0].depth).toBe(2)
  })

  it('devuelve null cuando no hay raíz', () => {
    expect(buildTree([node('huerfano', 'inexistente')])).toBeNull()
  })

  it('no se cuelga si los datos traen un ciclo', () => {
    const cyclic = [node('raiz', null), node('a', 'b'), node('b', 'a')]
    const tree = buildTree(cyclic)
    expect(tree?.node.id).toBe('raiz')
    expect(flattenTree(tree)).toHaveLength(1)
  })
})

describe('flattenTree', () => {
  it('recorre en profundidad, que es el orden en el que se pinta el árbol indentado', () => {
    expect(flattenTree(buildTree(powerliftingTree())).map((t) => t.node.id)).toEqual([
      'raiz',
      'sentadilla',
      'tobillo',
      'bracing',
      'banca',
      'arco',
      'pesomuerto',
      'bisagra',
      'recuperacion',
      'sueno',
    ])
  })
})

describe('countByLevel', () => {
  it('cuenta los tres niveles incluyendo la raíz — 4/3/3 como el diseño', () => {
    expect(countByLevel(powerliftingTree())).toEqual({
      principiante: 4,
      desarrollo: 3,
      dominado: 3,
    })
  })
})

describe('collectDescendantIds', () => {
  it('junta toda la descendencia, no solo los hijos directos', () => {
    expect(collectDescendantIds(powerliftingTree(), 'sentadilla').sort()).toEqual([
      'bracing',
      'tobillo',
    ])
    expect(collectDescendantIds(powerliftingTree(), 'raiz')).toHaveLength(9)
    expect(collectDescendantIds(powerliftingTree(), 'sueno')).toEqual([])
  })
})

describe('canReparent', () => {
  it('permite colgar un nodo de otra rama', () => {
    expect(canReparent(powerliftingTree(), 'tobillo', 'pesomuerto')).toBe(true)
  })

  it('rechaza colgarlo de sí mismo o de su propia descendencia (crearía un ciclo)', () => {
    expect(canReparent(powerliftingTree(), 'sentadilla', 'sentadilla')).toBe(false)
    expect(canReparent(powerliftingTree(), 'sentadilla', 'tobillo')).toBe(false)
  })

  it('no deja mover la raíz', () => {
    expect(canReparent(powerliftingTree(), 'raiz', 'sentadilla')).toBe(false)
  })
})

describe('layoutMobile', () => {
  it('coloca raíz, padre e hijo en las columnas y alturas del diseño (1f)', () => {
    const { nodes } = layoutMobile(powerliftingTree())
    const byId = new Map(nodes.map((n) => [n.id, n]))

    expect(byId.get('raiz')).toMatchObject({ x: 16, y: 20, width: 200, height: 40 })
    expect(byId.get('sentadilla')).toMatchObject({ x: 40, y: 110, width: 300, height: 40 })
    expect(byId.get('tobillo')).toMatchObject({ x: 76, y: 180, width: 264, height: 36 })
    // hijos consecutivos: 64px centro a centro
    expect((byId.get('bracing')?.y ?? 0) - (byId.get('tobillo')?.y ?? 0)).toBe(64)
  })

  it('dibuja codos ortogonales desde left + 15 del padre', () => {
    const { edges } = layoutMobile(powerliftingTree())
    const toSentadilla = edges.find((e) => e.id === 'sentadilla')
    // raíz: left 16 + 15 = 31 · borde inferior 60 · centro del hijo 130 · x del hijo 40
    expect(toSentadilla?.path).toBe('M31,60 L31,130 L40,130')
    expect(toSentadilla?.kind).toBe('direct')
    expect(toSentadilla).toMatchObject({ portX: 28, portY: 57, portSize: 6 })
  })

  it('marca como rama (tenue, sin resplandor) todo lo que no sale de la raíz', () => {
    const { edges } = layoutMobile(powerliftingTree())
    expect(edges.find((e) => e.id === 'tobillo')?.kind).toBe('branch')
  })

  it('devuelve un alto que cubre la última fila', () => {
    const { nodes, height } = layoutMobile(powerliftingTree())
    const last = nodes[nodes.length - 1]
    expect(height).toBeGreaterThan(last.y + last.height)
  })
})

describe('layoutDesktop', () => {
  it('usa las columnas x = 40 / 360 / 690 del diseño', () => {
    const { nodes } = layoutDesktop(powerliftingTree())
    const byId = new Map(nodes.map((n) => [n.id, n]))
    expect(byId.get('raiz')?.x).toBe(40)
    expect(byId.get('sentadilla')?.x).toBe(360)
    expect(byId.get('tobillo')?.x).toBe(690)
    expect(byId.get('raiz')).toMatchObject({ width: 210, height: 44 })
  })

  it('centra cada padre sobre sus hijos, y la raíz sobre sus ramas', () => {
    const { nodes } = layoutDesktop(powerliftingTree())
    const center = (id: string) => {
      const n = nodes.find((x) => x.id === id)
      return (n?.y ?? 0) + (n?.height ?? 0) / 2
    }
    expect(center('sentadilla')).toBe((center('tobillo') + center('bracing')) / 2)
    // una rama con un solo hijo queda a su misma altura
    expect(center('banca')).toBe(center('arco'))
    const ramas = ['sentadilla', 'banca', 'pesomuerto', 'recuperacion'].map(center)
    expect(center('raiz')).toBeCloseTo(ramas.reduce((a, b) => a + b, 0) / ramas.length, 5)
  })

  it('traza bézier horizontal, y recta cuando padre e hijo comparten y', () => {
    const { edges } = layoutDesktop(powerliftingTree())
    expect(edges.find((e) => e.id === 'sentadilla')?.path).toMatch(/^M250,\d+(\.\d+)? C305,/)
    expect(edges.find((e) => e.id === 'arco')?.path).toMatch(/^M570,\d+(\.\d+)? L690,/)
  })
})
