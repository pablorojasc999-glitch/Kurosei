import type { SyncedEntity } from '../../training/domain/types'

/**
 * Nivel de dominio de un nodo. Lo fija siempre la persona — el sistema nunca
 * lo infiere. Es el único uso legítimo de rojo/ámbar/verde en toda la app.
 */
export type MasteryLevel = 'principiante' | 'desarrollo' | 'dominado'

export const MASTERY_LEVELS: MasteryLevel[] = ['principiante', 'desarrollo', 'dominado']

/** Un perfil = una pestaña = una versión de vos que estás construyendo. */
export interface AtlasProfile extends SyncedEntity {
  name: string
  order: number
}

/**
 * Un nodo del árbol. `parentId === null` marca la raíz del perfil (hay
 * exactamente una por perfil, y se crea junto con el perfil). El árbol es
 * estricto: cada nodo tiene un único padre.
 */
export interface AtlasNode extends SyncedEntity {
  profileId: string
  parentId: string | null
  name: string
  level: MasteryLevel
  note: string
  order: number
}
