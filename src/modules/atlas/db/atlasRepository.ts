import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { AtlasNode, AtlasProfile, MasteryLevel } from '../domain/types'
import { canReparent, collectDescendantIds } from '../lib/atlasTree'
import type { AtlasTemplate, TemplateNodeSpec } from '../lib/atlasTemplates'

// ---------------------------------------------------------------------
// Perfiles
// ---------------------------------------------------------------------

export async function listProfiles(): Promise<AtlasProfile[]> {
  return db.atlas_profiles.filter((p) => p.deletedAt === null).sortBy('order')
}

export async function listNodes(profileId: string): Promise<AtlasNode[]> {
  return db.atlas_nodes
    .where('profileId')
    .equals(profileId)
    .filter((n) => n.deletedAt === null)
    .toArray()
}

/** Todos los nodos vivos de todos los perfiles — lo que necesita la panorámica. */
export async function listAllNodes(): Promise<AtlasNode[]> {
  return db.atlas_nodes.filter((n) => n.deletedAt === null).toArray()
}

async function nextProfileOrder(): Promise<number> {
  const profiles = await listProfiles()
  return profiles.length ? Math.max(...profiles.map((p) => p.order)) + 1 : 0
}

/**
 * Crea el perfil junto con su nodo raíz — nunca existe un perfil sin raíz, ni
 * un nodo huérfano. `template` opcional cuelga el árbol de base.
 */
export async function createProfile(
  name: string,
  template?: AtlasTemplate,
): Promise<AtlasProfile> {
  const timestamp = nowIso()
  const profile: AtlasProfile = {
    id: generateId(),
    name,
    order: await nextProfileOrder(),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }

  const nodes: AtlasNode[] = []
  const spec: TemplateNodeSpec = template
    ? { ...template.root, name }
    : { name, level: 'desarrollo' }

  const walk = (item: TemplateNodeSpec, parentId: string | null, order: number): string => {
    const id = generateId()
    nodes.push({
      id,
      profileId: profile.id,
      parentId,
      name: item.name,
      level: item.level,
      note: '',
      order,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    })
    ;(item.children ?? []).forEach((child, index) => walk(child, id, index))
    return id
  }
  walk(spec, null, 0)

  await db.transaction('rw', db.atlas_profiles, db.atlas_nodes, async () => {
    await db.atlas_profiles.add(profile)
    await db.atlas_nodes.bulkAdd(nodes)
  })
  return profile
}

export async function renameProfile(id: string, name: string): Promise<void> {
  const timestamp = nowIso()
  await db.atlas_profiles.update(id, { name, updatedAt: timestamp })
  // La raíz lleva el nombre del perfil: se renombran juntos.
  const nodes = await listNodes(id)
  const root = nodes.find((n) => n.parentId === null)
  if (root) await db.atlas_nodes.update(root.id, { name, updatedAt: timestamp })
}

/** Borra el perfil y, en cascada, todos sus nodos. */
export async function softDeleteProfile(id: string): Promise<void> {
  const timestamp = nowIso()
  const nodes = await listNodes(id)
  await db.transaction('rw', db.atlas_profiles, db.atlas_nodes, async () => {
    await db.atlas_profiles.update(id, { deletedAt: timestamp, updatedAt: timestamp })
    await Promise.all(
      nodes.map((n) => db.atlas_nodes.update(n.id, { deletedAt: timestamp, updatedAt: timestamp })),
    )
  })
}

// ---------------------------------------------------------------------
// Nodos
// ---------------------------------------------------------------------

export interface CreateNodeInput {
  profileId: string
  parentId: string
  name: string
  level?: MasteryLevel
}

/** Un nodo nuevo nace siempre colgado de un padre y, sin elegir nivel, en ámbar. */
export async function createNode(input: CreateNodeInput): Promise<AtlasNode> {
  const siblings = (await listNodes(input.profileId)).filter(
    (n) => n.parentId === input.parentId,
  )
  const timestamp = nowIso()
  const node: AtlasNode = {
    id: generateId(),
    profileId: input.profileId,
    parentId: input.parentId,
    name: input.name,
    level: input.level ?? 'desarrollo',
    note: '',
    order: siblings.length ? Math.max(...siblings.map((n) => n.order)) + 1 : 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.atlas_nodes.add(node)
  return node
}

export async function updateNodeName(id: string, name: string): Promise<void> {
  const node = await db.atlas_nodes.get(id)
  if (!node) return
  await db.atlas_nodes.update(id, { name, updatedAt: nowIso() })
  if (node.parentId === null) {
    await db.atlas_profiles.update(node.profileId, { name, updatedAt: nowIso() })
  }
}

export async function updateNodeLevel(id: string, level: MasteryLevel): Promise<void> {
  await db.atlas_nodes.update(id, { level, updatedAt: nowIso() })
}

export async function updateNodeNote(id: string, note: string): Promise<void> {
  await db.atlas_nodes.update(id, { note, updatedAt: nowIso() })
}

/**
 * Reasigna el padre de un nodo. Como el árbol es estricto, esto mueve la rama
 * entera; se rechaza si crearía un ciclo o si se intenta mover la raíz.
 */
export async function reparentNode(nodeId: string, newParentId: string): Promise<boolean> {
  const node = await db.atlas_nodes.get(nodeId)
  if (!node) return false
  const nodes = await listNodes(node.profileId)
  if (!canReparent(nodes, nodeId, newParentId)) return false

  const siblings = nodes.filter((n) => n.parentId === newParentId && n.id !== nodeId)
  await db.atlas_nodes.update(nodeId, {
    parentId: newParentId,
    order: siblings.length ? Math.max(...siblings.map((n) => n.order)) + 1 : 0,
    updatedAt: nowIso(),
  })
  return true
}

/** Borra el nodo con toda su descendencia. La raíz no se borra por acá: se borra el perfil. */
export async function softDeleteNode(id: string): Promise<void> {
  const node = await db.atlas_nodes.get(id)
  if (!node || node.parentId === null) return
  const nodes = await listNodes(node.profileId)
  const timestamp = nowIso()
  const ids = [id, ...collectDescendantIds(nodes, id)]
  await Promise.all(
    ids.map((nodeId) =>
      db.atlas_nodes.update(nodeId, { deletedAt: timestamp, updatedAt: timestamp }),
    ),
  )
}
