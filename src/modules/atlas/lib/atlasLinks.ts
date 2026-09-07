import type { AtlasNote, MasteryLevel } from '../domain/types'

/**
 * Enlaces y etiquetas se derivan del cuerpo, no se guardan aparte. Así nunca
 * pueden contradecir al texto: si borras un `[[enlace]]` de la nota, el enlace
 * desaparece, sin tabla intermedia que quede desincronizada.
 */

/** `[[Título]]` o `[[Título|como se lee]]`. */
const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g

/** `#etiqueta` — se corta en el primer espacio o signo, y no dispara dentro de `#` de encabezado. */
const TAG = /(^|[\s(])#([\p{L}\p{N}_/-]+)/gu

export interface WikiLink {
  /** El título tal cual se escribió, para poder mostrarlo si la nota no existe. */
  target: string
  /** Lo que se pinta: el alias si lo hay, si no el título. */
  label: string
}

/**
 * Clave de resolución de un enlace: ni mayúsculas, ni acentos, ni espacios de
 * sobra. Los acentos entran porque en el teléfono se escriben a medias, y
 * `[[Tecnica]]` tiene que encontrar «Técnica» igual: la ñ se conserva, que ahí
 * sí cambia la palabra.
 */
export function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u0303\u0308\u030a]/g, (accent, at, whole) =>
      whole[at - 1] === 'n' && accent === '\u0303' ? accent : '',
    )
    .normalize('NFC')
}

export function parseLinks(body: string): WikiLink[] {
  const out: WikiLink[] = []
  const seen = new Set<string>()
  for (const match of body.matchAll(WIKILINK)) {
    const target = match[1].trim()
    if (target === '') continue
    const key = normalizeTitle(target)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ target, label: (match[2] ?? match[1]).trim() })
  }
  return out
}

/**
 * Devuelve lo escrito tras el último `[[` sin cerrar antes del cursor, o `null`
 * si ahí no se está escribiendo un enlace. Es lo que dispara el autocompletado.
 */
export function activeLinkQuery(body: string, caret: number): string | null {
  const before = body.slice(0, caret)
  const open = before.lastIndexOf('[[')
  if (open === -1) return null
  const fragment = before.slice(open + 2)
  // Si ya se cerró, o hay un salto de línea, no se está escribiendo un enlace.
  if (fragment.includes(']]') || fragment.includes('\n')) return null
  return fragment
}

export function parseTags(body: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  // Los enlaces se quitan antes: una `#` dentro de `[[...]]` es parte del título.
  for (const match of body.replace(WIKILINK, ' ').matchAll(TAG)) {
    const tag = match[2]
    // Una etiqueta de sólo dígitos casi siempre es un número, no una etiqueta.
    if (/^\d+$/.test(tag)) continue
    const key = tag.toLocaleLowerCase('es')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

export interface NoteIndex {
  /** Título normalizado → nota. */
  byTitle: Map<string, AtlasNote>
  /** Id de nota → ids a los que enlaza (sólo enlaces que resuelven). */
  outgoing: Map<string, string[]>
  /** Id de nota → ids que la enlazan. */
  backlinks: Map<string, string[]>
  /** Enlaces escritos que no resuelven a ninguna nota, por id de origen. */
  broken: Map<string, WikiLink[]>
  /** Etiqueta en minúsculas → ids de las notas que la usan. */
  tags: Map<string, string[]>
}

export function buildIndex(notes: AtlasNote[]): NoteIndex {
  const byTitle = new Map<string, AtlasNote>()
  for (const note of notes) byTitle.set(normalizeTitle(note.title), note)

  const outgoing = new Map<string, string[]>()
  const backlinks = new Map<string, string[]>()
  const broken = new Map<string, WikiLink[]>()
  const tags = new Map<string, string[]>()

  for (const note of notes) {
    const resolved: string[] = []
    const missing: WikiLink[] = []
    for (const link of parseLinks(note.body)) {
      const target = byTitle.get(normalizeTitle(link.target))
      // Una nota que se enlaza a sí misma no aporta nada al grafo.
      if (target && target.id !== note.id) {
        resolved.push(target.id)
        const back = backlinks.get(target.id)
        if (back) back.push(note.id)
        else backlinks.set(target.id, [note.id])
      } else if (!target) {
        missing.push(link)
      }
    }
    outgoing.set(note.id, resolved)
    if (missing.length > 0) broken.set(note.id, missing)

    for (const tag of parseTags(note.body)) {
      const key = tag.toLocaleLowerCase('es')
      const list = tags.get(key)
      if (list) list.push(note.id)
      else tags.set(key, [note.id])
    }
  }

  return { byTitle, outgoing, backlinks, broken, tags }
}

/** Enlaces sin resolver de todo el mapa, para poder crearlos de un toque. */
export function allBrokenLinks(index: NoteIndex): WikiLink[] {
  const out: WikiLink[] = []
  const seen = new Set<string>()
  for (const links of index.broken.values()) {
    for (const link of links) {
      const key = normalizeTitle(link.target)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(link)
    }
  }
  return out.sort((a, b) => a.target.localeCompare(b.target, 'es'))
}

/**
 * Busca por título y por cuerpo. El título pesa más: escribir "sentadilla"
 * tiene que traer primero la nota que se llama así, no las que la mencionan.
 */
export function searchNotes(notes: AtlasNote[], query: string): AtlasNote[] {
  // Busca con la misma clave que resuelve los enlaces: escribir «tecnica»
  // encuentra «Técnica».
  const q = normalizeTitle(query)
  if (q === '') return [...notes].sort((a, b) => a.title.localeCompare(b.title, 'es'))
  const scored: Array<{ note: AtlasNote; score: number }> = []
  for (const note of notes) {
    const title = normalizeTitle(note.title)
    if (title === q) scored.push({ note, score: 0 })
    else if (title.startsWith(q)) scored.push({ note, score: 1 })
    else if (title.includes(q)) scored.push({ note, score: 2 })
    else if (normalizeTitle(note.body).includes(q)) scored.push({ note, score: 3 })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.note.title.localeCompare(b.note.title, 'es'))
    .map((s) => s.note)
}

export const LEVEL_COLOR: Record<MasteryLevel, string> = {
  principiante: '#EC3013',
  desarrollo: '#E8A22A',
  dominado: '#3FBF7F',
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  principiante: 'Principiante',
  desarrollo: 'En desarrollo',
  dominado: 'Dominado',
}

export const LEVEL_SHORT: Record<MasteryLevel, string> = {
  principiante: 'ROJO',
  desarrollo: 'ÁMBAR',
  dominado: 'VERDE',
}
