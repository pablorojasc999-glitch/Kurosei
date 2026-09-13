/** `YYYY-MM` key for a date, in local time. */
export function toMonthKey(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** El `YYYY-MM` al que cae una fecha `YYYY-MM-DD`. */
export function monthKeyOfDate(date: string): string {
  return date.slice(0, 7)
}

/**
 * Corre un `YYYY-MM` la cantidad de meses que se le pida, hacia adelante o
 * hacia atrás. Se hace con aritmética sobre los números y no con `Date`, que en
 * un mes corto ajusta el día y puede saltarse un mes entero.
 */
export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const zeroBased = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(zeroBased / 12)
  const nextMonth = zeroBased - nextYear * 12 + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`
}

/** "septiembre de 2026", para mostrar. */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })
}

/** El año de un `YYYY-MM`. */
export function yearOfMonthKey(monthKey: string): number {
  return Number(monthKey.slice(0, 4))
}

/**
 * Los meses que se ofrecen para imputar una transacción: los dos de antes y los
 * dos de después del de su fecha. Cubre el caso real — una compra de fin de mes
 * que va al siguiente, o una cuenta que llega tarde y va al anterior — sin
 * convertir el desplegable en una lista interminable.
 *
 * Si la transacción ya está imputada a un mes fuera de esa ventana, ese mes
 * entra igual: el desplegable nunca puede perder lo que ya estaba elegido.
 */
export function financialMonthOptions(date: string, current?: string): string[] {
  const base = monthKeyOfDate(date)
  const options = [-2, -1, 0, 1, 2].map((delta) => addMonths(base, delta))
  if (current && !options.includes(current)) options.push(current)
  return options.sort()
}
