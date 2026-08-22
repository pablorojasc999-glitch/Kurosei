export interface LoadSample {
  performedAt: string
  tonnageKg: number
}

export interface StressResult {
  central: number
  peripheral: number
  total: number
}

export type FatigueIndexFormula = (
  history: LoadSample[],
  referenceDate: string,
) => StressResult

const ACUTE_WINDOW_DAYS = 7
const CHRONIC_WINDOW_DAYS = 28

function tonnageInWindow(
  history: LoadSample[],
  referenceDate: string,
  windowDays: number,
): number {
  const referenceMs = new Date(referenceDate).getTime()
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  return history
    .filter((sample) => {
      const deltaMs = referenceMs - new Date(sample.performedAt).getTime()
      return deltaMs >= 0 && deltaMs < windowMs
    })
    .reduce((sum, sample) => sum + sample.tonnageKg, 0)
}

/**
 * Placeholder only — public ACWR (acute:chronic workload ratio) by tonnage,
 * applied uniformly to central/peripheral/total since RTS's real Stress
 * Index formula is proprietary. Replace via setFatigueIndexFormula().
 */
export const placeholderFatigueIndexFormula: FatigueIndexFormula = (
  history,
  referenceDate,
) => {
  const acuteTotal = tonnageInWindow(history, referenceDate, ACUTE_WINDOW_DAYS)
  const chronicTotal = tonnageInWindow(
    history,
    referenceDate,
    CHRONIC_WINDOW_DAYS,
  )
  const acuteAvg = acuteTotal / ACUTE_WINDOW_DAYS
  const chronicAvg = chronicTotal / CHRONIC_WINDOW_DAYS

  const ratio = chronicAvg === 0 ? 0 : acuteAvg / chronicAvg

  return { central: ratio, peripheral: ratio, total: ratio }
}

let activeFormula: FatigueIndexFormula = placeholderFatigueIndexFormula

export function setFatigueIndexFormula(formula: FatigueIndexFormula): void {
  activeFormula = formula
}

export function calculateFatigueIndex(
  history: LoadSample[],
  referenceDate: string,
): StressResult {
  return activeFormula(history, referenceDate)
}
