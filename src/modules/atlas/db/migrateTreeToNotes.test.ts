import { describe, expect, it } from 'vitest'
import { buildIndex } from '../lib/atlasLinks'
import {
  migrateTreeToNotes,
  type LegacyNode,
  type LegacyProfile,
} from './migrateTreeToNotes'

const base = { createdAt: '2026-01-01', updatedAt: '2026-01-02', deletedAt: null }

const profile = (id: string, name: string, over: Partial<LegacyProfile> = {}): LegacyProfile => ({
  id,
  name,
  order: 0,
  ...base,
  ...over,
})

const node = (
  id: string,
  profileId: string,
  parentId: string | null,
  name: string,
  over: Partial<LegacyNode> = {},
): LegacyNode => ({
  id,
  profileId,
  parentId,
  name,
  level: 'desarrollo',
  note: '',
  order: 0,
  ...base,
  ...over,
})

describe('migrateTreeToNotes', () => {
  const perfiles = [profile('p1', 'Powerlifting')]
  const nodos = [
    node('r', 'p1', null, 'Powerlifting', { note: 'Mi plan.' }),
    node('a', 'p1', 'r', 'Sentadilla', { order: 0, level: 'principiante', note: 'Bajar lento.' }),
    node('b', 'p1', 'r', 'Press de banca', { order: 1, level: 'dominado' }),
    node('c', 'p1', 'a', 'Movilidad de tobillo', { order: 0 }),
  ]

  it('cada nodo se convierte en una nota', () => {
    expect(migrateTreeToNotes(perfiles, nodos).map((n) => n.title).sort()).toEqual([
      'Movilidad de tobillo',
      'Powerlifting',
      'Press de banca',
      'Sentadilla',
    ])
  })

  it('la jerarquía se conserva como enlaces en el cuerpo del padre', () => {
    const notes = migrateTreeToNotes(perfiles, nodos)
    const raiz = notes.find((n) => n.id === 'r')
    expect(raiz?.body).toBe('Mi plan.\n\n- [[Sentadilla]]\n- [[Press de banca]]')
    const sentadilla = notes.find((n) => n.id === 'a')
    expect(sentadilla?.body).toBe('Bajar lento.\n\n- [[Movilidad de tobillo]]')
  })

  it('los enlaces migrados resuelven de verdad, no quedan rotos', () => {
    const index = buildIndex(migrateTreeToNotes(perfiles, nodos))
    expect(index.broken.size).toBe(0)
    expect(index.backlinks.get('a')).toEqual(['r'])
    expect(index.backlinks.get('c')).toEqual(['a'])
  })

  it('conserva el nivel, el id y las fechas de cada nodo', () => {
    const notes = migrateTreeToNotes(perfiles, nodos)
    expect(notes.find((n) => n.id === 'a')).toMatchObject({
      level: 'principiante',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      deletedAt: null,
    })
    expect(notes.find((n) => n.id === 'b')?.level).toBe('dominado')
  })

  it('una hoja sin nota ni hijos queda con el cuerpo vacío', () => {
    expect(migrateTreeToNotes(perfiles, nodos).find((n) => n.id === 'c')?.body).toBe('')
  })

  it('un nombre repetido entre perfiles se desambigua, para que el enlace no quede a medias', () => {
    const dos = [profile('p1', 'Powerlifting'), profile('p2', 'Escalada')]
    const repetidos = [
      node('r1', 'p1', null, 'Powerlifting'),
      node('x1', 'p1', 'r1', 'Movilidad'),
      node('r2', 'p2', null, 'Escalada'),
      node('x2', 'p2', 'r2', 'Movilidad'),
    ]
    const notes = migrateTreeToNotes(dos, repetidos)
    expect(notes.map((n) => n.title).sort()).toEqual([
      'Escalada',
      'Movilidad (Escalada)',
      'Movilidad (Powerlifting)',
      'Powerlifting',
    ])
    // Y el enlace del padre apunta al título desambiguado, no al genérico.
    expect(notes.find((n) => n.id === 'r1')?.body).toBe('- [[Movilidad (Powerlifting)]]')
    expect(buildIndex(notes).broken.size).toBe(0)
  })

  it('lo borrado no se migra, ni los nodos de un perfil borrado', () => {
    const conBorrados = [profile('p1', 'Vivo'), profile('p2', 'Borrado', { deletedAt: '2026-02-01' })]
    const nodosMixtos = [
      node('a', 'p1', null, 'Vivo'),
      node('b', 'p1', 'a', 'Nodo borrado', { deletedAt: '2026-02-01' }),
      node('c', 'p2', null, 'De perfil borrado'),
    ]
    expect(migrateTreeToNotes(conBorrados, nodosMixtos).map((n) => n.title)).toEqual(['Vivo'])
  })

  it('un árbol vacío no produce notas', () => {
    expect(migrateTreeToNotes([], [])).toEqual([])
  })
})
