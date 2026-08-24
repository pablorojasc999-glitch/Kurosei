import type { Sex } from '../domain/types'

/** MET value used for a strength-training session (resistance training, vigorous effort). */
const STRENGTH_TRAINING_MET = 6

/**
 * Assumed active lifting time per set (the concentric+eccentric effort
 * itself, not the rest that follows it). Session `startedAt`→`endedAt`
 * includes rest between sets, which in powerlifting can run to several
 * minutes — crediting that idle time at a vigorous-effort MET would badly
 * overestimate the session's calorie cost, so the calorie estimate uses
 * set count instead of wall-clock session duration.
 */
const ACTIVE_SECONDS_PER_SET = 45

/** Estimated active lifting minutes for a session, from its executed set count. */
export function estimateActiveMinutesFromSetCount(setCount: number): number {
  return (setCount * ACTIVE_SECONDS_PER_SET) / 60
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
  durationMinutes: number
}

/** Calories burned during a strength session, estimated from its duration via METs. */
export function estimateStrengthSessionCalories({
  weightKg,
  durationMinutes,
}: StrengthSessionCaloriesInput): number {
  return STRENGTH_TRAINING_MET * weightKg * (durationMinutes / 60)
}

export interface CalorieExpenditureInput {
  heightCm: number
  birthDate: string
  sex: Sex
  weightKg: number
  targetDate: Date
  cardioCaloriesBurned: number
  strengthSessionDurationMinutes: number
}

/**
 * Total daily calorie expenditure: basal metabolism (from the profile and
 * that day's body weight) plus the day's logged cardio calories plus an
 * estimate for the day's strength session, from its duration.
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
    durationMinutes: input.strengthSessionDurationMinutes,
  })
  return bmr + strengthCalories + input.cardioCaloriesBurned
}
