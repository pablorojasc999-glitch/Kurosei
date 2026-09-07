import type { SyncedEntity } from '../../training/domain/types'

/**
 * Nivel de dominio de una nota. Lo fija siempre la persona — el sistema nunca
 * lo infiere. Es el único uso legítimo de rojo/ámbar/verde en toda la app.
 */
export type MasteryLevel = 'principiante' | 'desarrollo' | 'dominado'

export const MASTERY_LEVELS: MasteryLevel[] = ['principiante', 'desarrollo', 'dominado']

/**
 * Una nota. No hay jerarquía: las relaciones son enlaces `[[Título]]` dentro
 * del cuerpo, muchos a muchos, y los backlinks se derivan de ellos. Lo que en
 * el Atlas anterior era un "perfil" ahora es simplemente una nota que enlaza a
 * las demás — hace de padre por su contenido, no por su tipo.
 */
export interface AtlasNote extends SyncedEntity {
  /** Único a efectos de enlace: `[[Título]]` resuelve por aquí, sin distinguir mayúsculas. */
  title: string
  /** Markdown, con `[[enlaces]]` y `#etiquetas` embebidos. */
  body: string
  level: MasteryLevel
}
