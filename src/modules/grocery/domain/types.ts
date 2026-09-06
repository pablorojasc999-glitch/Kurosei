import type { SyncedEntity } from '../../training/domain/types'

/**
 * Cada cuánto se repone el producto. Es lo único que separa las tres listas
 * y lo que decide cuándo un artículo vuelve a tocar.
 */
export type PurchaseCadence = 'quincenal' | 'mensual' | 'esporadico'

export const PURCHASE_CADENCES: PurchaseCadence[] = ['quincenal', 'mensual', 'esporadico']

export interface GroceryItem extends SyncedEntity {
  name: string
  cadence: PurchaseCadence
  /** Texto libre — "2 kg", "1 paquete", "el grande". Puede ir vacío. */
  quantity: string
  note: string
  /** Marcado para la compra en curso; se limpia al cerrarla. */
  checked: boolean
  /** `YYYY-MM-DD` de la última compra cerrada con este artículo marcado; `null` si nunca se compró. */
  lastBoughtAt: string | null
  order: number
}
