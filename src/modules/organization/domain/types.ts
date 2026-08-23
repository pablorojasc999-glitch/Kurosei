import type { SyncedEntity } from '../../training/domain/types'

/** A user-defined time-blocking category (Trabajo, Gimnasio, Comer, Dormir…). */
export interface TimeBlockCategory extends SyncedEntity {
  name: string
  color: string
  emoji: string
  order: number
}

/**
 * One block on a day's timeline. `date` is a local calendar-day key
 * (yyyy-MM-dd, see toDateKey in training/lib/calendarGrid) rather than an
 * ISO timestamp — a block belongs to a day, not an instant. `startMinutes`/
 * `endMinutes` are minutes since midnight (0-1440) in that day's local time.
 */
export interface TimeBlock extends SyncedEntity {
  categoryId: string
  date: string
  startMinutes: number
  endMinutes: number
  title: string
  notes: string
}
