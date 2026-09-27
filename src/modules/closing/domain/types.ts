import type { SyncedEntity } from '../../training/domain/types'

/** Los módulos cuyo día se cierra a mano. La bitácora no está: se da por
 *  cerrada cuando está completa, que es un dato que ya se tiene. */
export type ClosableModule = 'training' | 'nutrition' | 'finance'

/**
 * Cómo se cerró el día.
 *
 * `none` no es lo mismo que "falta": es haber dicho que ese día no había nada
 * que registrar. Un día de descanso o un día sin gastos son días completos, y
 * sin esta distinción quedarían pendientes para siempre.
 */
export type ClosureKind = 'done' | 'none'

/** El cierre de un módulo en un día. Uno por (fecha, módulo). */
export interface DayClosure extends SyncedEntity {
  date: string
  module: ClosableModule
  kind: ClosureKind
}
