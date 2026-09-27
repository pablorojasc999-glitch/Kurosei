import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { ClosableModule, ClosureKind, DayClosure } from '../domain/types'

/** Los cierres de un rango de fechas, ambas incluidas. */
export async function listClosuresInRange(
  from: string,
  to: string,
): Promise<DayClosure[]> {
  return db.day_closures
    .where('date')
    .between(from, to, true, true)
    .filter((c) => c.deletedAt === null)
    .toArray()
}

/**
 * El primer día que se cerró algo, o null si nunca.
 *
 * Es desde cuándo tiene sentido hablar de días pendientes: lo de antes no es
 * un día a medias, es un día de cuando esto no existía. Sin este piso, la
 * lista arranca con un mes de días vacíos y deja de servir el primer día.
 */
export async function firstClosureDate(): Promise<string | null> {
  const first = await db.day_closures
    .orderBy('date')
    .filter((c) => c.deletedAt === null)
    .first()
  return first?.date ?? null
}

export async function listClosuresForDate(date: string): Promise<DayClosure[]> {
  return db.day_closures
    .where('date')
    .equals(date)
    .filter((c) => c.deletedAt === null)
    .toArray()
}

/**
 * Cierra un módulo en un día, o cambia cómo estaba cerrado.
 *
 * Reutiliza la fila que ya exista en vez de agregar otra: hay como mucho un
 * cierre por (fecha, módulo), y así corregir un "no entrené" por un "sí
 * entrené" se sincroniza como una edición y no como un alta más un borrado.
 */
export async function closeDay(
  date: string,
  module: ClosableModule,
  kind: ClosureKind,
): Promise<DayClosure> {
  const timestamp = nowIso()
  return db.transaction('rw', db.day_closures, async () => {
    const existing = await db.day_closures
      .where('[date+module]')
      .equals([date, module])
      .filter((c) => c.deletedAt === null)
      .first()

    if (existing) {
      await db.day_closures.update(existing.id, { kind, updatedAt: timestamp })
      return { ...existing, kind, updatedAt: timestamp }
    }

    const closure: DayClosure = {
      id: generateId(),
      date,
      module,
      kind,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }
    await db.day_closures.add(closure)
    return closure
  })
}

/** Deshace el cierre: el día vuelve a contar como pendiente en ese módulo. */
export async function reopenDay(
  date: string,
  module: ClosableModule,
): Promise<void> {
  const timestamp = nowIso()
  const existing = await db.day_closures
    .where('[date+module]')
    .equals([date, module])
    .filter((c) => c.deletedAt === null)
    .first()
  if (!existing) return
  await db.day_closures.update(existing.id, {
    deletedAt: timestamp,
    updatedAt: timestamp,
  })
}
