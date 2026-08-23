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

export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${minutesToTimeInput(startMinutes)} – ${minutesToTimeInput(endMinutes)}`
}

/** Rounds a minute-of-day value to the nearest step (default 15 min), used to default new-block times to tidy slots. */
export function roundToStep(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step
}
