import { parseDateInput, startOfDay, toDateKey } from '../../training/lib/calendarGrid'
import type { GroceryItem, PurchaseCadence } from '../domain/types'

/**
 * Cada cuántos días vuelve a tocar el artículo. `esporadico` no tiene ciclo:
 * se compra cuando hace falta, así que nunca "vence".
 */
export const CADENCE_DAYS: Record<PurchaseCadence, number | null> = {
  quincenal: 14,
  mensual: 30,
  esporadico: null,
}

export const CADENCE_LABEL: Record<PurchaseCadence, string> = {
  quincenal: 'Cada 2 semanas',
  mensual: 'Mensual',
  esporadico: 'Esporádico',
}

export const CADENCE_SHORT: Record<PurchaseCadence, string> = {
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  esporadico: 'Esporádico',
}

export const CADENCE_HINT: Record<PurchaseCadence, string> = {
  quincenal: 'Lo repones cada 14 días.',
  mensual: 'Lo repones cada 30 días.',
  esporadico: 'Sin ciclo fijo: lo compras cuando hace falta.',
}

/** Días completos entre dos fechas `YYYY-MM-DD`. Negativo si la compra está en el futuro. */
export function daysSince(lastBoughtAt: string, today: string): number {
  const from = startOfDay(parseDateInput(lastBoughtAt)).getTime()
  const to = startOfDay(parseDateInput(today)).getTime()
  return Math.round((to - from) / 86_400_000)
}

/**
 * Un artículo toca cuando nunca se compró o cuando ya pasó su ciclo. Los
 * esporádicos nunca tocan solos — no tendría sentido avisar de algo que por
 * definición no tiene periodicidad.
 */
export function isDue(item: GroceryItem, today: string): boolean {
  const cycle = CADENCE_DAYS[item.cadence]
  if (cycle === null) return false
  if (item.lastBoughtAt === null) return true
  return daysSince(item.lastBoughtAt, today) >= cycle
}

/**
 * La cantidad es lo que dice cuánto hay que comprar. Sin cantidad el artículo
 * está en casa: sigue en la lista como parte del catálogo, pero no entra en la
 * ida al súper.
 */
export function hasQuantity(item: GroceryItem): boolean {
  return item.quantity.trim() !== ''
}

/**
 * Lo que de verdad hay que llevar: además de que le toque por ciclo, tiene que
 * hacer falta. Es lo que cuentan las tarjetas de arriba y lo que marca de golpe
 * el botón de la barra de compra.
 */
export function needsBuying(item: GroceryItem, today: string): boolean {
  return hasQuantity(item) && isDue(item, today)
}

/** Línea secundaria de cada fila: cuándo se compró por última vez y si ya toca. */
export function lastBoughtLabel(item: GroceryItem, today: string): string {
  const ago =
    item.lastBoughtAt === null
      ? 'Nunca comprado'
      : (() => {
          const days = daysSince(item.lastBoughtAt, today)
          return days <= 0 ? 'Comprado hoy' : days === 1 ? 'Hace 1 día' : `Hace ${days} días`
        })()
  return needsBuying(item, today) ? `${ago} · toca` : ago
}

/**
 * Orden de cada lista: primero lo que hay que comprar y luego lo que ya está en
 * casa, alfabético dentro de cada bloque. `localeCompare` con `es` para que la
 * ñ y los acentos caigan donde uno los busca.
 */
export function sortForDisplay(items: GroceryItem[]): GroceryItem[] {
  return [...items].sort((a, b) => {
    const byNeed = Number(hasQuantity(b)) - Number(hasQuantity(a))
    if (byNeed !== 0) return byNeed
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  })
}

/** Fecha de hoy en el formato que guarda `lastBoughtAt`. */
export function todayKey(): string {
  return toDateKey(new Date())
}

export interface CadenceGroup {
  cadence: PurchaseCadence
  items: GroceryItem[]
  /** Cuántos hay que llevar: les toca por ciclo y tienen cantidad puesta. */
  dueCount: number
  /** Cuántos están en casa (sin cantidad) y quedan fuera de esta ida al súper. */
  stockedCount: number
}

/**
 * Reparte los artículos en los tres grupos, cada uno ya en orden de pantalla.
 * Devuelve siempre los tres, aunque estén vacíos: las tres listas son la
 * estructura de la pantalla, no un resultado de los datos.
 */
export function groupByCadence(items: GroceryItem[], today: string): CadenceGroup[] {
  return (['quincenal', 'mensual', 'esporadico'] as PurchaseCadence[]).map((cadence) => {
    const group = sortForDisplay(items.filter((item) => item.cadence === cadence))
    return {
      cadence,
      items: group,
      dueCount: group.filter((i) => needsBuying(i, today)).length,
      stockedCount: group.filter((i) => !hasQuantity(i)).length,
    }
  })
}
