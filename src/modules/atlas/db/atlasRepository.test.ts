import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../shared/db/database'
import {
  createNode,
  createProfile,
  listAllNodes,
  listNodes,
  listProfiles,
  renameProfile,
  reparentNode,
  softDeleteNode,
  softDeleteProfile,
  updateNodeLevel,
  updateNodeName,
  updateNodeNote,
} from './atlasRepository'
import { ATLAS_TEMPLATES, countTemplateNodes } from '../lib/atlasTemplates'
import { countByLevel } from '../lib/atlasTree'

const powerlifting = ATLAS_TEMPLATES[0]
const enBlanco = ATLAS_TEMPLATES[2]

beforeEach(async () => {
  await db.atlas_profiles.clear()
  await db.atlas_nodes.clear()
})

describe('perfiles', () => {
  it('crea el perfil con su nodo raíz, sin plantilla', async () => {
    const profile = await createProfile('Escalada')
    expect((await listProfiles()).map((p) => p.name)).toEqual(['Escalada'])
    const nodes = await listNodes(profile.id)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ parentId: null, name: 'Escalada', level: 'desarrollo' })
  })

  it('cuelga el árbol completo al arrancar desde una plantilla', async () => {
    const profile = await createProfile('Powerlifting', powerlifting)
    const nodes = await listNodes(profile.id)
    expect(nodes).toHaveLength(countTemplateNodes(powerlifting.root))
    // el balance de la plantilla es el del diseño: 4 / 3 / 3
    expect(countByLevel(nodes)).toEqual({ principiante: 4, desarrollo: 3, dominado: 3 })
    const root = nodes.find((n) => n.parentId === null)
    expect(root?.name).toBe('Powerlifting')
    const ramas = nodes.filter((n) => n.parentId === root?.id).sort((a, b) => a.order - b.order)
    expect(ramas.map((n) => n.name)).toEqual([
      'Sentadilla',
      'Press de banca',
      'Peso muerto',
      'Recuperación',
    ])
  })

  it('la plantilla en blanco deja solo la raíz, con el nombre que le pongas', async () => {
    const profile = await createProfile('Ajedrez', enBlanco)
    const nodes = await listNodes(profile.id)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].name).toBe('Ajedrez')
  })

  it('renombrar el perfil renombra también su raíz', async () => {
    const profile = await createProfile('Escalada')
    await renameProfile(profile.id, 'Boulder')
    expect((await listProfiles())[0].name).toBe('Boulder')
    expect((await listNodes(profile.id))[0].name).toBe('Boulder')
  })

  it('borrar el perfil se lleva sus nodos en cascada', async () => {
    const profile = await createProfile('Powerlifting', powerlifting)
    const otro = await createProfile('Escalada')
    await softDeleteProfile(profile.id)
    expect((await listProfiles()).map((p) => p.id)).toEqual([otro.id])
    expect(await listNodes(profile.id)).toEqual([])
    // el otro perfil queda intacto
    expect(await listNodes(otro.id)).toHaveLength(1)
  })
})

describe('nodos', () => {
  it('crea un nodo colgado del padre, en ámbar por defecto', async () => {
    const profile = await createProfile('Escalada')
    const root = (await listNodes(profile.id))[0]
    const node = await createNode({ profileId: profile.id, parentId: root.id, name: 'Bloque' })
    expect(node).toMatchObject({ parentId: root.id, level: 'desarrollo', note: '' })
  })

  it('numera los hermanos en orden de creación', async () => {
    const profile = await createProfile('Escalada')
    const root = (await listNodes(profile.id))[0]
    const a = await createNode({ profileId: profile.id, parentId: root.id, name: 'A' })
    const b = await createNode({ profileId: profile.id, parentId: root.id, name: 'B' })
    expect(a.order).toBe(0)
    expect(b.order).toBe(1)
  })

  it('guarda nivel y nota, que son lo único editable del nodo además del nombre', async () => {
    const profile = await createProfile('Escalada')
    const root = (await listNodes(profile.id))[0]
    const node = await createNode({ profileId: profile.id, parentId: root.id, name: 'Bloque' })
    await updateNodeLevel(node.id, 'dominado')
    await updateNodeNote(node.id, 'Se me da mejor en placa que en desplome.')
    await updateNodeName(node.id, 'Bloque en placa')
    const [updated] = (await listNodes(profile.id)).filter((n) => n.id === node.id)
    expect(updated).toMatchObject({
      level: 'dominado',
      note: 'Se me da mejor en placa que en desplome.',
      name: 'Bloque en placa',
    })
  })

  it('renombrar la raíz renombra el perfil', async () => {
    const profile = await createProfile('Escalada')
    const root = (await listNodes(profile.id))[0]
    await updateNodeName(root.id, 'Boulder')
    expect((await listProfiles())[0].name).toBe('Boulder')
  })
})

describe('reasignar padre', () => {
  it('mueve la rama entera bajo el nuevo padre', async () => {
    const profile = await createProfile('Powerlifting', powerlifting)
    const nodes = await listNodes(profile.id)
    const tobillo = nodes.find((n) => n.name === 'Movilidad de tobillo')!
    const pesoMuerto = nodes.find((n) => n.name === 'Peso muerto')!

    expect(await reparentNode(tobillo.id, pesoMuerto.id)).toBe(true)
    const after = await listNodes(profile.id)
    expect(after.find((n) => n.id === tobillo.id)?.parentId).toBe(pesoMuerto.id)
    // sigue habiendo el mismo número de nodos: se movió, no se duplicó
    expect(after).toHaveLength(nodes.length)
  })

  it('rechaza el movimiento que crearía un ciclo', async () => {
    const profile = await createProfile('Powerlifting', powerlifting)
    const nodes = await listNodes(profile.id)
    const sentadilla = nodes.find((n) => n.name === 'Sentadilla')!
    const tobillo = nodes.find((n) => n.name === 'Movilidad de tobillo')!

    expect(await reparentNode(sentadilla.id, tobillo.id)).toBe(false)
    expect((await listNodes(profile.id)).find((n) => n.id === sentadilla.id)?.parentId).toBe(
      nodes.find((n) => n.parentId === null)?.id,
    )
  })

  it('no mueve la raíz', async () => {
    const profile = await createProfile('Powerlifting', powerlifting)
    const nodes = await listNodes(profile.id)
    const root = nodes.find((n) => n.parentId === null)!
    const sentadilla = nodes.find((n) => n.name === 'Sentadilla')!
    expect(await reparentNode(root.id, sentadilla.id)).toBe(false)
  })

  it('no cruza nodos entre perfiles', async () => {
    const uno = await createProfile('Powerlifting', powerlifting)
    const otro = await createProfile('Escalada')
    const sentadilla = (await listNodes(uno.id)).find((n) => n.name === 'Sentadilla')!
    const raizOtro = (await listNodes(otro.id))[0]
    expect(await reparentNode(sentadilla.id, raizOtro.id)).toBe(false)
  })
})

describe('borrar nodos', () => {
  it('se lleva la descendencia entera', async () => {
    const profile = await createProfile('Powerlifting', powerlifting)
    const nodes = await listNodes(profile.id)
    const sentadilla = nodes.find((n) => n.name === 'Sentadilla')!

    await softDeleteNode(sentadilla.id)
    const after = await listNodes(profile.id)
    const names = after.map((n) => n.name)
    expect(names).not.toContain('Sentadilla')
    expect(names).not.toContain('Movilidad de tobillo')
    expect(names).not.toContain('Bracing / Valsalva')
    expect(after).toHaveLength(nodes.length - 3)
  })

  it('no borra la raíz — para eso se borra el perfil', async () => {
    const profile = await createProfile('Escalada')
    const root = (await listNodes(profile.id))[0]
    await softDeleteNode(root.id)
    expect(await listNodes(profile.id)).toHaveLength(1)
  })
})

describe('listAllNodes', () => {
  it('junta los nodos vivos de todos los perfiles, que es lo que lee la panorámica', async () => {
    await createProfile('Powerlifting', powerlifting)
    await createProfile('Escalada')
    expect(await listAllNodes()).toHaveLength(countTemplateNodes(powerlifting.root) + 1)
  })
})
