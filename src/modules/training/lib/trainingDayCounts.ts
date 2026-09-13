/** Un día del calendario y qué se hizo en él, tal como lo marcan los puntos de la cuadrícula. */
export interface TrainingDayMark {
  /** `YYYY-MM-DD`. */
  date: string
  /** Hubo sesión de fuerza con series anotadas. */
  strength: boolean
  /** Hubo sesión de cardio. */
  cardio: boolean
}

export interface TrainingDayCounts {
  strength: number
  cardio: number
}

/**
 * Cuántos días se entrenó fuerza y cuántos cardio dentro de un período.
 *
 * El período llega como el principio de la fecha: `2026-09` cuenta un mes y
 * `2026` un año, con la misma función. Las fechas van en `YYYY-MM-DD`, así que
 * comparar texto es comparar calendario, sin pasar por `Date` ni por sus zonas
 * horarias.
 *
 * Cuenta días distintos y no sesiones: entrenar dos veces un martes es un día
 * entrenado, que es lo que se ve en la cuadrícula — un punto por día.
 */
export function countTrainingDays(
  marks: TrainingDayMark[],
  periodPrefix: string,
): TrainingDayCounts {
  const strengthDays = new Set<string>()
  const cardioDays = new Set<string>()

  for (const mark of marks) {
    if (!mark.date.startsWith(periodPrefix)) continue
    if (mark.strength) strengthDays.add(mark.date)
    if (mark.cardio) cardioDays.add(mark.date)
  }

  return { strength: strengthDays.size, cardio: cardioDays.size }
}
