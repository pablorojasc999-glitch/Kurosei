/**
 * Las horas de inicio y fin de una sesión, tal como se escriben a mano.
 *
 * Se trabaja siempre en hora local: lo que el reloj marcaba al entrar y al
 * salir del gimnasio. Guardado queda un instante completo (ISO), pero lo que
 * se edita es sólo la hora del día; la fecha la pone la sesión.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** `HH:MM` en hora local, que es lo que espera un <input type="time">. */
export function toTimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseTime(time: string): { hours: number; minutes: number } | null {
  const match = TIME_PATTERN.exec(time)
  if (!match) return null
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

/** Cambia la hora de un instante dejándole su misma fecha local. */
export function withTimeOfDay(iso: string, time: string): string | null {
  const base = new Date(iso)
  const parsed = parseTime(time)
  if (Number.isNaN(base.getTime()) || !parsed) return null
  const next = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    parsed.hours,
    parsed.minutes,
    0,
    0,
  )
  return next.toISOString()
}

/**
 * La hora de término, anclada al día en que empezó la sesión.
 *
 * Si queda antes del inicio se entiende que la sesión cruzó la medianoche y
 * pasa al día siguiente: entrenar de 23:30 a 00:45 dura 75 minutos, no menos
 * que cero.
 */
export function endIsoFromTime(startIso: string, time: string): string | null {
  const sameDay = withTimeOfDay(startIso, time)
  if (sameDay === null) return null
  const start = new Date(startIso)
  const end = new Date(sameDay)
  if (end.getTime() >= start.getTime()) return sameDay
  const nextDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, end.getHours(), end.getMinutes(), 0, 0)
  return nextDay.toISOString()
}

/** Minutos que duró la sesión, o null mientras no tenga hora de término. */
export function sessionDurationMinutes(startIso: string, endIso: string | null): number | null {
  if (!endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.max(0, Math.round((end - start) / 60000))
}

/** `1 h 25 min`, que es como se lee una duración de entrenamiento. */
export function formatSessionDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${mins} min`
}
