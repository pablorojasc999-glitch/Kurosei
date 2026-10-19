import type { TrainingLogData } from '../lib/trainingLogCsv'
import { listAllExecutedSets, listAllSessionExercises, listAllSessions } from './executionRepository'
import {
  listAllDays,
  listAllMesocycles,
  listAllPlannedExercises,
  listAllPlannedSets,
  listAllWeeks,
  listMacrocycles,
} from './planningRepository'
import { listExercises } from './trainingRepository'

/** Todo lo que la exportación de entrenamiento cruza, pedido de una vez a la base. */
export async function loadTrainingLogData(): Promise<TrainingLogData> {
  const [
    macrocycles,
    mesocycles,
    weeks,
    days,
    exercises,
    plannedExercises,
    plannedSets,
    sessions,
    sessionExercises,
    executedSets,
  ] = await Promise.all([
    listMacrocycles(),
    listAllMesocycles(),
    listAllWeeks(),
    listAllDays(),
    listExercises(),
    listAllPlannedExercises(),
    listAllPlannedSets(),
    listAllSessions(),
    listAllSessionExercises(),
    listAllExecutedSets(),
  ])
  return {
    macrocycles,
    mesocycles,
    weeks,
    days,
    exercises,
    plannedExercises,
    plannedSets,
    sessions,
    sessionExercises,
    executedSets,
  }
}
