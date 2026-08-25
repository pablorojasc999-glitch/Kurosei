/** `YYYY-MM` key for a date, in local time. */
export function toMonthKey(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}
