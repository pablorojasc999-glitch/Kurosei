import { db } from '../../../shared/db/database'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import type { AtlasNote, MasteryLevel } from '../domain/types'
import { normalizeTitle, parseLinks } from '../lib/atlasLinks'

export async function listNotes(): Promise<AtlasNote[]> {
  const notes = await db.atlas_notes.filter((n) => n.deletedAt === null).toArray()
  return notes.sort((a, b) => a.title.localeCompare(b.title, 'es'))
}

export async function getNote(id: string): Promise<AtlasNote | undefined> {
  const note = await db.atlas_notes.get(id)
  return note && note.deletedAt === null ? note : undefined
}

export async function findByTitle(title: string): Promise<AtlasNote | undefined> {
  const key = normalizeTitle(title)
  return (await listNotes()).find((n) => normalizeTitle(n.title) === key)
}

export interface CreateNoteInput {
  title: string
  body?: string
  level?: MasteryLevel
}

/**
 * El título es la clave de los enlaces, así que dos notas con el mismo nombre
 * harían ambiguo a qué apunta `[[Título]]`. Se rechaza.
 */
export async function createNote(input: CreateNoteInput): Promise<AtlasNote> {
  const title = input.title.trim()
  if (title === '') throw new Error('La nota necesita un título.')
  if (await findByTitle(title)) throw new Error(`Ya existe una nota titulada "${title}".`)

  const timestamp = nowIso()
  const note: AtlasNote = {
    id: generateId(),
    title,
    body: input.body ?? '',
    level: input.level ?? 'desarrollo',
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.atlas_notes.add(note)
  return note
}

export interface UpdateNoteInput {
  title?: string
  body?: string
  level?: MasteryLevel
}

/**
 * Renombrar reescribe los `[[enlaces]]` que apuntaban al título viejo en todas
 * las demás notas: si no, renombrar rompería en silencio todo lo que enlaza
 * aquí, que es justo lo que un sistema de notas enlazadas no puede permitirse.
 */
export async function updateNote(id: string, input: UpdateNoteInput): Promise<void> {
  const note = await db.atlas_notes.get(id)
  if (!note) return
  const timestamp = nowIso()
  const patch: Partial<AtlasNote> = { updatedAt: timestamp }

  if (input.body !== undefined) patch.body = input.body
  if (input.level !== undefined) patch.level = input.level

  let renamedFrom: string | null = null
  if (input.title !== undefined) {
    const title = input.title.trim()
    if (title === '') throw new Error('La nota necesita un título.')
    const clash = await findByTitle(title)
    if (clash && clash.id !== id) throw new Error(`Ya existe una nota titulada "${title}".`)
    if (normalizeTitle(title) !== normalizeTitle(note.title)) renamedFrom = note.title
    patch.title = title
  }

  await db.atlas_notes.update(id, patch)
  if (renamedFrom !== null && patch.title) {
    await rewriteLinksTo(renamedFrom, patch.title, id)
  }
}

/** Reescribe `[[viejo]]` como `[[nuevo]]` en todas las notas menos la renombrada. */
async function rewriteLinksTo(from: string, to: string, exceptId: string): Promise<void> {
  const key = normalizeTitle(from)
  const timestamp = nowIso()
  const notes = (await listNotes()).filter((n) => n.id !== exceptId)

  for (const other of notes) {
    if (!parseLinks(other.body).some((l) => normalizeTitle(l.target) === key)) continue
    const body = other.body.replace(
      /\[\[([^\]|]+?)(\|[^\]]+?)?\]\]/g,
      (match, target: string, alias?: string) =>
        normalizeTitle(target) === key ? `[[${to}${alias ?? ''}]]` : match,
    )
    await db.atlas_notes.update(other.id, { body, updatedAt: timestamp })
  }
}

/**
 * Abre el destino de un `[[enlace]]`, creándolo si no existe. Es lo que hace
 * que enlazar sea barato: escribes el nombre y la nota nace al tocarla.
 */
export async function openOrCreateByTitle(title: string): Promise<AtlasNote> {
  return (await findByTitle(title)) ?? (await createNote({ title }))
}

export async function setLevel(id: string, level: MasteryLevel): Promise<void> {
  await db.atlas_notes.update(id, { level, updatedAt: nowIso() })
}

/**
 * Borra la nota. Los `[[enlaces]]` que apuntaban a ella se quedan escritos, y
 * pasan a mostrarse como rotos — igual que en Obsidian, y a propósito: perder
 * la nota no debería borrar en silencio la mención en otras cinco.
 */
export async function softDeleteNote(id: string): Promise<void> {
  const timestamp = nowIso()
  await db.atlas_notes.update(id, { deletedAt: timestamp, updatedAt: timestamp })
}
