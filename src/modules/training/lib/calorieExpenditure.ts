import type { Sex } from '../domain/types'

/**
 * MET for resistance training, vigorous effort. Compendium MET values for
 * resistance training are themselves session-averaged — measured across a
 * typical training session including its natural rest between sets, not
 * just the concentric/eccentric movement — so this MET is meant to be
 * applied over a realistic per-set duration that already has rest baked in,
 * not over isolated "active lifting time".
 */
const STRENGTH_TRAINING_MET = 6

/**
 * Assumed average minutes per set, rest included, for powerlifting-style
 * training (heavier loads, longer rest than typical hypertrophy work).
 * Deliberately not derived from timestamps between logged sets: sets are
 * sometimes logged in a batch after several were actually performed (e.g.
 * catching up on a few forgotten entries at once), which would make
 * consecutive `performedAt` gaps meaningless. Set *count* is always
 * complete and reliable, so it's the only signal this estimate depends on.
 */
const MINUTES_PER_SET = 4

/** Estimated session minutes for a session, from its executed set count. */
export function estimateStrengthMinutesFromSetCount(setCount: number): number {
  return setCount * MINUTES_PER_SET
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
}

/** Calories burned during a strength session, from its executed set count. */
export function estimateStrengthSessionCalories({
  weightKg,
  setCount,
}: StrengthSessionCaloriesInput): number {
  const minutes = estimateStrengthMinutesFromSetCount(setCount)
  return STRENGTH_TRAINING_MET * weightKg * (minutes / 60)
}

export interface CalorieExpenditureInput {
  heightCm: number
  birthDate: string
  sex: Sex
  weightKg: number
  targetDate: Date
  cardioCaloriesBurned: number
  strengthSetCount: number
}

/**
 * Total daily calorie expenditure: basal metabolism (from the profile and
 * that day's body weight) plus the day's logged cardio calories plus an
 * estimate for the day's strength session, from its logged set count.
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
  })
  return bmr + strengthCalories + input.cardioCaloriesBurned
}
