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

/** Línea secundaria de cada fila: cuándo se compró por última vez y si ya toca. */
export function lastBoughtLabel(item: GroceryItem, today: string): string {
  if (item.lastBoughtAt === null) {
    return CADENCE_DAYS[item.cadence] === null ? 'Nunca comprado' : 'Nunca comprado · toca'
  }
  const days = daysSince(item.lastBoughtAt, today)
  const ago =
    days <= 0 ? 'Comprado hoy' : days === 1 ? 'Hace 1 día' : `Hace ${days} días`
  return isDue(item, today) ? `${ago} · toca` : ago
}

/** Fecha de hoy en el formato que guarda `lastBoughtAt`. */
export function todayKey(): string {
  return toDateKey(new Date())
}

export interface CadenceGroup {
  cadence: PurchaseCadence
  items: GroceryItem[]
  dueCount: number
}

/**
 * Reparte los artículos en los tres grupos, cada uno ya ordenado por `order`.
 * Devuelve siempre los tres, aunque estén vacíos: las tres listas son la
 * estructura de la pantalla, no un resultado de los datos.
 */
export function groupByCadence(items: GroceryItem[], today: string): CadenceGroup[] {
  return (['quincenal', 'mensual', 'esporadico'] as PurchaseCadence[]).map((cadence) => {
    const group = items
      .filter((item) => item.cadence === cadence)
      .sort((a, b) => a.order - b.order)
    return { cadence, items: group, dueCount: group.filter((i) => isDue(i, today)).length }
  })
}
