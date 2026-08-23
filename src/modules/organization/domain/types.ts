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
 * ISO timestamp — a block belongs to the day it starts, not an instant.
 * `startMinutes` is minutes since midnight (0-1439) on `date`. `endMinutes`
 * is normally also 0-1439, but can go up to 2880 to represent a block that
 * ends after midnight the next day (e.g. Dormir 22:00 -> 06:00): a value
 * past 1440 means "that many minutes into the day after `date`".
 */
export interface TimeBlock extends SyncedEntity {
  categoryId: string
  date: string
  startMinutes: number
  endMinutes: number
  title: string
  notes: string
}
