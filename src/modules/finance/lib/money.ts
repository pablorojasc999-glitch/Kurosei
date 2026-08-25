/** Chilean peso style: dot as thousands separator, no decimals, trailing " $" — e.g. "102.421 $". */
export function formatMoney(amount: number): string {
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Math.round(amount))} $`
}

/** Same as formatMoney but with an explicit +/- sign, for transaction rows. */
export function formatSignedMoney(amount: number, sign: 1 | -1): string {
  return `${sign > 0 ? '+' : '-'}${formatMoney(Math.abs(amount))}`
}
