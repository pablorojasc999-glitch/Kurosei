export const TRAINING_STORES_V1 = {
  training_muscle_groups: 'id, name, updatedAt, deletedAt',
  training_exercises: 'id, name, type, category, updatedAt, deletedAt',
  training_exercise_muscle_contributions:
    'id, exerciseId, muscleGroupId, updatedAt, deletedAt',
  training_macrocycles: 'id, name, startDate, updatedAt, deletedAt',
  training_mesocycles: 'id, macrocycleId, order, updatedAt, deletedAt',
  training_weeks: 'id, mesocycleId, order, updatedAt, deletedAt',
  training_days: 'id, weekId, date, updatedAt, deletedAt',
  training_planned_exercises:
    'id, dayId, exerciseId, order, updatedAt, deletedAt',
  training_planned_sets:
    'id, plannedExerciseId, setNumber, updatedAt, deletedAt',
  training_sessions: 'id, dayId, startedAt, endedAt, updatedAt, deletedAt',
  training_session_exercises:
    'id, sessionId, exerciseId, order, updatedAt, deletedAt',
  training_executed_sets:
    'id, sessionExerciseId, setNumber, performedAt, updatedAt, deletedAt',
  training_cardio_sessions:
    'id, dayId, exerciseId, startedAt, updatedAt, deletedAt',
}
