import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { normalizeTitle } from './atlasLinks'

/**
 * Markdown → HTML, con los `[[enlaces]]` y las `#etiquetas` convertidos en
 * botones que la vista intercepta.
 *
 * Se sanea aunque el contenido sea tuyo: una nota pegada desde fuera puede
 * traer HTML, y no hay razón para ejecutarlo.
 */

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g
const TAG = /(^|[\s(])#([\p{L}\p{N}_/-]+)/gu

/** Escapa lo que va a ir dentro de un atributo HTML. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface RenderOptions {
  /** Títulos normalizados que existen: los que no, se pintan como enlace roto. */
  existingTitles: Set<string>
}

/**
 * Los enlaces y etiquetas se sustituyen ANTES de pasar por marked, así que el
 * HTML que se inyecta pasa igualmente por el saneado de después.
 */
function replaceWikiSyntax(body: string, options: RenderOptions): string {
  return body
    .replace(WIKILINK, (_match, rawTarget: string, alias?: string) => {
      const target = rawTarget.trim()
      const label = (alias ?? rawTarget).trim()
      const exists = options.existingTitles.has(normalizeTitle(target))
      const cls = exists ? 'md-wikilink' : 'md-wikilink md-wikilink--broken'
      return `<a href="#" class="${cls}" data-wikilink="${escapeAttr(target)}">${escapeAttr(label)}</a>`
    })
    .replace(TAG, (_match, prefix: string, tag: string) => {
      if (/^\d+$/.test(tag)) return `${prefix}#${tag}`
      return `${prefix}<a href="#" class="md-tag" data-tag="${escapeAttr(tag)}">#${escapeAttr(tag)}</a>`
    })
}

export function renderMarkdown(body: string, options: RenderOptions): string {
  const withLinks = replaceWikiSyntax(body, options)
  const html = marked.parse(withLinks, { async: false, gfm: true, breaks: true })
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-wikilink', 'data-tag', 'target', 'rel'],
  })
}

/** Primeras líneas en texto plano, para la tarjeta de la lista. */
export function excerpt(body: string, max = 120): string {
  const plain = body
    .replace(WIKILINK, (_m, target: string, alias?: string) => (alias ?? target).trim())
    .replace(/[#*_`>[\]()~-]/g, ' ')
    .replace(/\s+/g, ' ')
    // Quitar los símbolos deja huecos antes de la puntuación: "esto ." → "esto."
    .replace(/\s+([.,;:!?…])/g, '$1')
    .trim()
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain
}
