import type { AtlasNote, MasteryLevel } from '../domain/types'

/** Las filas del Atlas viejo, tal como quedaron en la base antes de la v9. */
export interface LegacyProfile {
  id: string
  name: string
  order: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface LegacyNode {
  id: string
  profileId: string
  parentId: string | null
  name: string
  level: MasteryLevel
  note: string
  order: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Convierte el árbol viejo en notas enlazadas.
 *
 * Cada nodo pasa a ser una nota, y cada relación padre→hijo se escribe como un
 * `[[enlace]]` en el cuerpo del padre: la jerarquía no se pierde, deja de ser
 * estructura y pasa a ser contenido. El perfil ya no es una entidad aparte —
 * su nodo raíz se queda como la nota que enlaza a las demás.
 *
 * Los títulos tienen que ser únicos porque son la clave de los enlaces, así
 * que un nombre repetido entre perfiles se desambigua con el perfil detrás.
 */
export function migrateTreeToNotes(
  profiles: LegacyProfile[],
  nodes: LegacyNode[],
): AtlasNote[] {
  const liveProfiles = profiles.filter((p) => p.deletedAt === null)
  const profileById = new Map(liveProfiles.map((p) => [p.id, p]))
  const liveNodes = nodes.filter(
    (n) => n.deletedAt === null && profileById.has(n.profileId),
  )

  // Un mismo nombre en dos perfiles distintos se vuelve ambiguo al enlazar.
  const nameCount = new Map<string, number>()
  for (const node of liveNodes) {
    const key = node.name.trim().toLocaleLowerCase('es')
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1)
  }
  const titleOf = (node: LegacyNode): string => {
    const name = node.name.trim() || 'Sin título'
    const key = name.toLocaleLowerCase('es')
    if ((nameCount.get(key) ?? 0) <= 1) return name
    const profile = profileById.get(node.profileId)
    return profile ? `${name} (${profile.name})` : name
  }

  const titles = new Map(liveNodes.map((n) => [n.id, titleOf(n)]))
  const childrenOf = new Map<string, LegacyNode[]>()
  for (const node of liveNodes) {
    if (node.parentId === null) continue
    const list = childrenOf.get(node.parentId)
    if (list) list.push(node)
    else childrenOf.set(node.parentId, [node])
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.order - b.order)

  return liveNodes.map((node) => {
    const children = childrenOf.get(node.id) ?? []
    const links = children
      .map((child) => `- [[${titles.get(child.id)}]]`)
      .join('\n')
    const parts = [node.note.trim(), links].filter((part) => part !== '')
    return {
      id: node.id,
      title: titles.get(node.id) as string,
      body: parts.join('\n\n'),
      level: node.level,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      deletedAt: null,
    }
  })
}
