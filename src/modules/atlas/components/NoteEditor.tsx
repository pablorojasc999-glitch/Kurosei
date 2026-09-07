import { useEffect, useRef, useState } from 'react'
import type { AtlasNote, MasteryLevel } from '../domain/types'
import { MASTERY_LEVELS } from '../domain/types'
import {
  activeLinkQuery,
  LEVEL_COLOR,
  LEVEL_LABEL,
  LEVEL_SHORT,
  normalizeTitle,
} from '../lib/atlasLinks'

interface NoteEditorProps {
  note: AtlasNote
  /** Títulos existentes, para el autocompletado de `[[`. */
  titles: string[]
  onChangeTitle: (title: string) => void
  onChangeBody: (body: string) => void
  onChangeLevel: (level: MasteryLevel) => void
  error: string | null
}

/** Lo que se espera antes de bajar el cuerpo a la base, en milisegundos. */
const SAVE_DELAY = 400

export function NoteEditor({
  note,
  titles,
  onChangeTitle,
  onChangeBody,
  onChangeLevel,
  error,
}: NoteEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const [query, setQuery] = useState<string | null>(null)
  // El borrador vive aquí y no en la base. Guardar es asíncrono (Dexie →
  // liveQuery → render): si el textarea dependiera de esa vuelta, escribir
  // rápido perdería letras y movería el cursor.
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)

  // El guardado sale de un temporizador, así que necesita leer siempre lo
  // último sin que eso reinicie la cuenta.
  const pending = useRef(body)
  const saved = useRef(note.body)
  const persist = useRef(onChangeBody)

  useEffect(() => {
    pending.current = body
    persist.current = onChangeBody
  })

  useEffect(() => {
    if (body === saved.current) return
    const id = window.setTimeout(() => {
      saved.current = pending.current
      persist.current(pending.current)
    }, SAVE_DELAY)
    return () => window.clearTimeout(id)
  }, [body])

  // Cerrar el editor cancela ese temporizador, así que lo pendiente se escribe
  // aquí: salir de la nota nunca debería perder lo último tecleado.
  useEffect(
    () => () => {
      if (pending.current !== saved.current) persist.current(pending.current)
    },
    [],
  )

  /**
   * El título se guarda al salir del campo, no letra a letra: renombrar
   * reescribe los enlaces de todas las demás notas, y hacerlo en cada tecla
   * dejaría un rastro de renombrados a medias.
   */
  function commitTitle() {
    if (title.trim() !== note.title) onChangeTitle(title)
  }

  const suggestions =
    query === null
      ? []
      : titles
          .filter((t) => normalizeTitle(t).includes(normalizeTitle(query)))
          .filter((t) => normalizeTitle(t) !== normalizeTitle(title))
          .slice(0, 6)

  /** Escribe el título elegido cerrando el `[[` que estaba a medias. */
  function complete(chosen: string) {
    const el = bodyRef.current
    if (!el) return
    const caret = el.selectionStart
    const before = body.slice(0, caret)
    const open = before.lastIndexOf('[[')
    if (open === -1) return
    setBody(`${body.slice(0, open)}[[${chosen}]]${body.slice(caret)}`)
    setQuery(null)
    // El cursor tiene que quedar detrás del enlace recién cerrado.
    const next = open + chosen.length + 4
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next, next)
    })
  }

  function syncQuery(el: HTMLTextAreaElement) {
    setQuery(activeLinkQuery(el.value, el.selectionStart))
  }

  return (
    <div className="note-editor">
      <input
        className="note-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder="Título de la nota"
        aria-label="Título de la nota"
      />

      <div className="note-levels" role="group" aria-label="Nivel de dominio">
        {MASTERY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`note-level${note.level === level ? ' note-level--active' : ''}`}
            style={note.level === level ? { background: LEVEL_COLOR[level] } : undefined}
            aria-pressed={note.level === level}
            aria-label={LEVEL_LABEL[level]}
            onClick={() => onChangeLevel(level)}
          >
            {LEVEL_SHORT[level]}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="note-body-wrap">
        <textarea
          ref={bodyRef}
          className="note-body-input"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            syncQuery(e.target)
          }}
          onKeyUp={(e) => syncQuery(e.currentTarget)}
          onClick={(e) => syncQuery(e.currentTarget)}
          onBlur={() => window.setTimeout(() => setQuery(null), 150)}
          placeholder={'Escribe en Markdown.\n\nUsa [[ para enlazar otra nota y # para etiquetar.'}
          aria-label="Cuerpo de la nota"
        />

        {query !== null && (
          <div className="note-autocomplete" role="listbox" aria-label="Notas para enlazar">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => complete(suggestion)}
              >
                {suggestion}
              </button>
            ))}
            {query.trim() !== '' &&
              !titles.some((t) => normalizeTitle(t) === normalizeTitle(query)) && (
                <button
                  type="button"
                  className="note-autocomplete-new"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => complete(query.trim())}
                >
                  Enlazar a «{query.trim()}» — se creará al abrirla
                </button>
              )}
            {suggestions.length === 0 && query.trim() === '' && (
              <span className="note-autocomplete-hint">Escribe para buscar una nota…</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
