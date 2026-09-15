import type { Sex } from '../domain/types'

/**
 * METs del Compendium para trabajo de fuerza, ya promediados por sesión: se
 * midieron a lo largo de un entrenamiento completo, con sus descansos entre
 * series incluidos, no sólo sobre el tiempo bajo la barra. Por eso se aplican
 * a la duración total de la sesión y no a un "tiempo activo".
 *
 * Cuál de los dos corresponde depende de qué tan densa fue la sesión: una hora
 * haciendo veinte series no es el mismo gasto que una hora haciendo seis.
 */
const STRENGTH_MET_VIGOROUS = 6
const STRENGTH_MET_MODERATE = 3.5

/**
 * Series por hora a partir de las cuales la sesión cuenta como vigorosa. Con
 * descansos de powerlifting (3 a 5 minutos), doce series por hora ya es un
 * ritmo sostenido; por debajo de seis la sesión es mayormente descanso.
 */
const DENSE_SETS_PER_HOUR = 12
const SPARSE_SETS_PER_HOUR = 6

/**
 * Minutos por serie que se asumen cuando la sesión no tiene hora de término.
 * No se deriva de los tiempos entre series registradas: a veces se cargan
 * varias de una vez al acordarse, y esos intervalos no significan nada. El
 * conteo de series, en cambio, siempre está completo.
 */
const MINUTES_PER_SET = 4

/** Minutos estimados de una sesión a partir de cuántas series tuvo. */
export function estimateStrengthMinutesFromSetCount(setCount: number): number {
  return setCount * MINUTES_PER_SET
}

/**
 * El MET que le corresponde a la sesión según su densidad, interpolando entre
 * moderado y vigoroso.
 *
 * Sin esto, anotar la hora real castigaría al que es honesto: quien se queda
 * dos horas conversando entre series sumaría el doble de calorías que quien
 * hace el mismo trabajo en una hora.
 */
export function strengthMetForDensity(setCount: number, minutes: number): number {
  if (minutes <= 0) return STRENGTH_MET_VIGOROUS
  const setsPerHour = setCount / (minutes / 60)
  if (setsPerHour >= DENSE_SETS_PER_HOUR) return STRENGTH_MET_VIGOROUS
  if (setsPerHour <= SPARSE_SETS_PER_HOUR) return STRENGTH_MET_MODERATE
  const t = (setsPerHour - SPARSE_SETS_PER_HOUR) / (DENSE_SETS_PER_HOUR - SPARSE_SETS_PER_HOUR)
  return STRENGTH_MET_MODERATE + t * (STRENGTH_MET_VIGOROUS - STRENGTH_MET_MODERATE)
}

/**
 * Los minutos que se usan para el gasto: los reales si la sesión tiene hora de
 * inicio y de término, y si no la estimación por series.
 */
export function strengthSessionMinutes(
  setCount: number,
  loggedMinutes: number | null,
): number {
  if (loggedMinutes !== null && loggedMinutes > 0) return loggedMinutes
  return estimateStrengthMinutesFromSetCount(setCount)
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
  /** Duración real de la sesión, cuando tiene anotadas las dos horas. */
  loggedMinutes: number | null
}

/**
 * Calorías de una sesión de fuerza.
 *
 * Con las horas anotadas se usa la duración real y un MET ajustado a la
 * densidad de la sesión; sin ellas se cae a la estimación por número de
 * series, que es lo que había antes y sigue sirviendo para las sesiones
 * viejas.
 */
export function estimateStrengthSessionCalories({
  weightKg,
  setCount,
  loggedMinutes,
}: StrengthSessionCaloriesInput): number {
  if (setCount <= 0) return 0
  const minutes = strengthSessionMinutes(setCount, loggedMinutes)
  const met = strengthMetForDensity(setCount, minutes)
  return met * weightKg * (minutes / 60)
}

export interface CalorieExpenditureInput {
  heightCm: number
  birthDate: string
  sex: Sex
  weightKg: number
  targetDate: Date
  cardioCaloriesBurned: number
  strengthSetCount: number
  /** Duración real de la sesión de fuerza, cuando tiene las dos horas anotadas. */
  strengthMinutes: number | null
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
    loggedMinutes: input.strengthMinutes,
  })
  return bmr + strengthCalories + input.cardioCaloriesBurned
}
