import type { Sex } from '../domain/types'

/** MET for the active lift itself (resistance training, vigorous effort). */
const STRENGTH_TRAINING_MET = 6

/**
 * MET for the recovery time between sets: still elevated above resting
 * (heart rate recovering, standing, re-racking plates) but nowhere near the
 * effort of the lift itself.
 */
const REST_MET = 2

/**
 * Assumed active lifting time per set (the concentric+eccentric effort
 * itself, not the rest that follows it).
 */
const ACTIVE_SECONDS_PER_SET = 45

/**
 * Ceiling on how much of a single gap between two logged sets counts as
 * "resting between sets". Anchoring rest time to the sets' own `performedAt`
 * timestamps (instead of the session's `startedAt`/`endedAt`) means the
 * estimate can't be broken by forgetting to tap "Finalizar sesión" — but
 * without a cap, a real interruption between two sets (a phone call, a long
 * break) would still get counted as recovery. 8 minutes is generous even
 * for powerlifting-length rest, so it only clips genuine interruptions.
 */
const MAX_REST_SECONDS_PER_GAP = 8 * 60

/** Estimated active lifting minutes for a session, from its executed set count. */
export function estimateActiveMinutesFromSetCount(setCount: number): number {
  return (setCount * ACTIVE_SECONDS_PER_SET) / 60
}

/**
 * Estimated (capped) rest minutes between sets, from the sets' own
 * `performedAt` timestamps — not from session `startedAt`/`endedAt`, so a
 * forgotten "Finalizar sesión" tap can't inflate it.
 */
export function estimateRestMinutesFromSetTimestamps(performedAt: string[]): number {
  const sorted = [...performedAt].sort()
  let totalSeconds = 0
  for (let i = 1; i < sorted.length; i += 1) {
    const gapSeconds =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 1000
    totalSeconds += Math.min(Math.max(gapSeconds, 0), MAX_REST_SECONDS_PER_GAP)
  }
  return totalSeconds / 60
}

/** Age in whole years at `atDate`, from a `YYYY-MM-DD` birth date. */
export function calculateAge(birthDate: string, atDate: Date): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  let age = atDate.getFullYear() - birthYear
  const hadBirthdayThisYear =
    atDate.getMonth() + 1 > birthMonth ||
    (atDate.getMonth() + 1 === birthMonth && atDate.getDate() >= birthDay)
  if (!hadBirthdayThisYear) age -= 1
  return age
}

export interface BmrInput {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
}

/** Basal metabolic rate via the Mifflin-St Jeor equation. */
export function bmrMifflinStJeor({ weightKg, heightCm, age, sex }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export interface StrengthSessionCaloriesInput {
  weightKg: number
  setCount: number
  /** `performedAt` of every executed set in the session, any order. */
  setTimestamps: string[]
}

/**
 * Calories burned during a strength session: vigorous-effort MET for the
 * assumed active lifting time, plus a light-activity MET for the (capped)
 * rest time actually elapsed between logged sets.
 */
export function estimateStrengthSessionCalories({
  weightKg,
  setCount,
  setTimestamps,
}: StrengthSessionCaloriesInput): number {
  const activeMinutes = estimateActiveMinutesFromSetCount(setCount)
  const restMinutes = estimateRestMinutesFromSetTimestamps(setTimestamps)
  return (
    STRENGTH_TRAINING_MET * weightKg * (activeMinutes / 60) +
    REST_MET * weightKg * (restMinutes / 60)
  )
}

export interface CalorieExpenditureInput {
  heightCm: number
  birthDate: string
  sex: Sex
  weightKg: number
  targetDate: Date
  cardioCaloriesBurned: number
  strengthSetCount: number
  strengthSetTimestamps: string[]
}

/**
 * Total daily calorie expenditure: basal metabolism (from the profile and
 * that day's body weight) plus the day's logged cardio calories plus an
 * estimate for the day's strength session, from its logged sets.
 */
export function estimateCalorieExpenditure(input: CalorieExpenditureInput): number {
  const age = calculateAge(input.birthDate, input.targetDate)
  const bmr = bmrMifflinStJeor({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age,
    sex: input.sex,
  })
  const strengthCalories = estimateStrengthSessionCalories({
    weightKg: input.weightKg,
    setCount: input.strengthSetCount,
    setTimestamps: input.strengthSetTimestamps,
  })
  return bmr + strengthCalories + input.cardioCaloriesBurned
}
