import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { CardioSession } from '../domain/types'

export async function listCardioSessions(
  dayId: string,
): Promise<CardioSession[]> {
  return db.training_cardio_sessions
    .where('dayId')
    .equals(dayId)
    .filter((s) => s.deletedAt === null)
    .sortBy('startedAt')
}

export interface CreateCardioSessionInput {
  dayId: string
  exerciseId: string
  startedAt: string
  durationMinutes: number
  distanceKm: number | null
  caloriesBurned: number | null
  notes: string
}

export async function createCardioSession(
  input: CreateCardioSessionInput,
): Promise<CardioSession> {
  const timestamp = nowIso()
  const session: CardioSession = {
    id: generateId(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.training_cardio_sessions.add(session)
  return session
}

export async function deleteCardioSession(id: string): Promise<void> {
  await db.training_cardio_sessions.update(id, { deletedAt: nowIso() })
}
