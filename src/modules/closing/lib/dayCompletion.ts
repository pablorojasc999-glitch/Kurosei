import type { DailyLog } from '../../training/domain/types'
import type { ClosableModule, DayClosure } from '../domain/types'

/**
 * Qué le falta a un día para estar completo.
 *
 * Entrenamiento, nutrición y finanzas se cierran a mano, porque "no hay datos"
 * y "no había nada que registrar" se ven idénticos desde la base: un día de
 * descanso o un día sin gastos son días completos que no dejan ninguna fila.
 * Deducirlos dejaría justamente esos días pendientes para siempre.
 *
 * La bitácora es la excepción y va deducida: ahí sí todo campo que falta es un
 * campo que falta, así que pedir además un botón de cerrar sería pedir dos
 * veces lo mismo.
 */

export type ModuleKey = ClosableModule | 'bitacora'

export type ModuleState =
  /** Cerrado, con algo registrado. */
  | 'done'
  /** Cerrado diciendo que no hubo nada: no entrené, no hubo movimientos. */
  | 'empty'
  /** Todavía falta. */
  | 'pending'

/**
 * Los campos que tienen que estar para dar la bitácora por completa.
 *
 * Los suplementos quedan fuera porque son casillas: desmarcada no se distingue
 * de no contestada. El agua y los macros tampoco, que se leen de Nutrición y
 * no se escriben acá.
 */
export const REQUIRED_BITACORA_FIELDS = [
  { key: 'bodyWeightKg', label: 'Peso' },
  { key: 'sleepHours', label: 'Sueño' },
  { key: 'steps', label: 'Pasos' },
  { key: 'stress', label: 'Estrés' },
  { key: 'stimulants', label: 'Estimulantes' },
  { key: 'fatigue', label: 'Fatiga' },
] as const satisfies ReadonlyArray<{ key: keyof DailyLog; label: string }>

export type BitacoraField = (typeof REQUIRED_BITACORA_FIELDS)[number]['key']

export interface DayCompletion {
  date: string
  training: ModuleState
  nutrition: ModuleState
  finance: ModuleState
  bitacora: ModuleState
  /** Los campos de bitácora que faltan, para poder decir cuáles son. */
  missingBitacora: Array<{ key: BitacoraField; label: string }>
  /** Cuántos de los cuatro están listos. */
  doneCount: number
  complete: boolean
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  training: 'Entrenamiento',
  nutrition: 'Nutrición',
  finance: 'Finanzas',
  bitacora: 'Bitácora',
}

/** Lo que se pregunta al cerrar cuando no hubo nada, por módulo. */
export const EMPTY_LABELS: Record<ClosableModule, string> = {
  training: 'No entrené',
  nutrition: 'No registré comidas',
  finance: 'Sin movimientos',
}

function stateOfClosure(closure: DayClosure | undefined): ModuleState {
  if (!closure) return 'pending'
  return closure.kind === 'none' ? 'empty' : 'done'
}

export function missingBitacoraFields(
  log: DailyLog | undefined,
): Array<{ key: BitacoraField; label: string }> {
  if (!log) return REQUIRED_BITACORA_FIELDS.map((f) => ({ key: f.key, label: f.label }))
  return REQUIRED_BITACORA_FIELDS.filter((f) => log[f.key] === null || log[f.key] === undefined).map(
    (f) => ({ key: f.key, label: f.label }),
  )
}

export interface DayCompletionInput {
  date: string
  /** Los cierres de ese día, en cualquier orden. */
  closures: DayClosure[]
  log: DailyLog | undefined
}

export function buildDayCompletion({
  date,
  closures,
  log,
}: DayCompletionInput): DayCompletion {
  const byModule = new Map<ClosableModule, DayClosure>()
  for (const closure of closures) {
    if (closure.date !== date) continue
    // Si hubiera dos para el mismo módulo gana el último cerrado, que es el
    // que refleja la última decisión.
    const current = byModule.get(closure.module)
    if (!current || closure.updatedAt > current.updatedAt) byModule.set(closure.module, closure)
  }

  const missingBitacora = missingBitacoraFields(log)
  const bitacora: ModuleState = missingBitacora.length === 0 ? 'done' : 'pending'
  const training = stateOfClosure(byModule.get('training'))
  const nutrition = stateOfClosure(byModule.get('nutrition'))
  const finance = stateOfClosure(byModule.get('finance'))

  const estados = [training, nutrition, finance, bitacora]
  const doneCount = estados.filter((e) => e !== 'pending').length

  return {
    date,
    training,
    nutrition,
    finance,
    bitacora,
    missingBitacora,
    doneCount,
    complete: doneCount === estados.length,
  }
}

/** Los módulos de un día que siguen pendientes, en el orden en que se leen. */
export function pendingModules(day: DayCompletion): ModuleKey[] {
  const orden: ModuleKey[] = ['training', 'nutrition', 'finance', 'bitacora']
  return orden.filter((key) => day[key] === 'pending')
}
