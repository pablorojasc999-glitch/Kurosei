/** Lo que dejó una copia de la semana anterior, tal como lo cuenta la base. */
export interface CopyPreviousWeekCounts {
  copied: number
  kept: number
  skippedDays: number
}

/**
 * El aviso que se lee después de traer lo planificado de la semana anterior.
 *
 * Los tres números importan, y cada uno por un motivo distinto: lo que vino es
 * el resultado, lo que ya estaba explica por qué vino menos de lo que se
 * esperaba, y los días que quedaron afuera avisan de un hueco —una semana que
 * no tiene ese día, o uno que ya se entrenó— que si no se dice acá se descubre
 * al ir a entrenar.
 */
export function describePreviousWeekCopy(
  { copied, kept, skippedDays }: CopyPreviousWeekCounts,
  fromWeekNumber: number,
): string {
  const parts: string[] = []

  if (copied > 0) {
    parts.push(
      copied === 1
        ? `Se trajo 1 ejercicio de la Semana ${fromWeekNumber}.`
        : `Se trajeron ${copied} ejercicios de la Semana ${fromWeekNumber}.`,
    )
    if (kept > 0) {
      parts.push(
        kept === 1
          ? '1 ejercicio ya estaba planificado y quedó como estaba.'
          : `${kept} ejercicios ya estaban planificados y quedaron como estaban.`,
      )
    }
  } else if (kept > 0) {
    // Sin nada nuevo, el detalle de cuántos ya estaban sobra: lo que hay que
    // entender es que no se tocó nada, no el recuento.
    parts.push('No se trajo nada: ya estaba todo planificado.')
  } else if (skippedDays === 0) {
    parts.push(`La Semana ${fromWeekNumber} no tiene nada planificado.`)
  }

  if (skippedDays > 0) {
    parts.push(
      skippedDays === 1
        ? '1 día quedó afuera: la semana no lo tiene, o ya se entrenó.'
        : `${skippedDays} días quedaron afuera: la semana no los tiene, o ya se entrenaron.`,
    )
  }

  return parts.join(' ')
}
