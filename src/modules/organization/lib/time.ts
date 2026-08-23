/** Minutes since midnight -> the "HH:MM" value an <input type="time"> expects. */
export function minutesToTimeInput(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/** The inverse of minutesToTimeInput — null if the value isn't a well-formed HH:MM. */
export function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/**
 * Formats a block's real start/end for display. `endMinutes` can exceed
 * 1439 for an overnight block (e.g. 22:00 -> 1560, meaning 06:00 the next
 * day) — mod 1440 so it still reads as a normal time-of-day.
 */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${minutesToTimeInput(startMinutes % 1440)} – ${minutesToTimeInput(endMinutes % 1440)}`
}

/** Rounds a minute-of-day value to the nearest step (default 15 min), used to default new-block times to tidy slots. */
export function roundToStep(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step
}

/** "1 h 30 min" / "45 min" / "2 h" — a block's duration, in minutes. */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}
