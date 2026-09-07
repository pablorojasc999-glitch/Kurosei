import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import {
  createNote,
  listNotes,
  openOrCreateByTitle,
  setLevel,
  softDeleteNote,
  updateNote,
} from '../db/atlasRepository'
import type { AtlasNote } from '../domain/types'
import {
  allBrokenLinks,
  buildIndex,
  LEVEL_COLOR,
  LEVEL_LABEL,
  searchNotes,
} from '../lib/atlasLinks'
import { excerpt, renderMarkdown } from '../lib/markdown'
import { NoteEditor } from './NoteEditor'
import { NoteGraph } from './NoteGraph'

type View = 'notas' | 'grafo'

export function AtlasPage() {
  const notes = useLiveQuery(() => listNotes(), [])
  const [view, setView] = useState<View>('notas')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const index = useMemo(() => buildIndex(notes ?? []), [notes])

  if (!notes) return <p className="empty-hint">Cargando las notas…</p>

  const open = openId ? notes.find((n) => n.id === openId) : undefined
  const titles = notes.map((n) => n.title)

  async function handleCreate(title: string) {
    setError(null)
    try {
      const note = await createNote({ title })
      setOpenId(note.id)
      setEditing(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  async function handleOpenTitle(title: string) {
    setError(null)
    const note = await openOrCreateByTitle(title)
    setOpenId(note.id)
    setEditing(false)
    setView('notas')
  }

  async function patch(id: string, input: Parameters<typeof updateNote>[1]) {
    setError(null)
    try {
      await updateNote(id, input)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    }
  }

  // ------------------------------------------------------------------
  // Nota abierta
  // ------------------------------------------------------------------
  if (open) {
    const backlinkIds = index.backlinks.get(open.id) ?? []
    const outgoingIds = index.outgoing.get(open.id) ?? []
    const broken = index.broken.get(open.id) ?? []
    const byId = new Map(notes.map((n) => [n.id, n]))

    return (
      <div className="page">
        <div className="note-crumbs">
          <button type="button" className="note-back" onClick={() => setOpenId(null)}>
            ← Notas
          </button>
          <button type="button" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Vista previa' : 'Editar'}
          </button>
        </div>

        {editing ? (
          <NoteEditor
            // Cambiar de nota remonta el editor: así el autocompletado a medias
            // no se arrastra de una a otra.
            key={open.id}
            note={open}
            titles={titles}
            error={error}
            onChangeTitle={(title) => void patch(open.id, { title })}
            onChangeBody={(body) => void patch(open.id, { body })}
            onChangeLevel={(level) => void setLevel(open.id, level)}
          />
        ) : (
          <>
            <div className="note-level-flag">
              <span
                className="note-level-dot"
                style={{ background: LEVEL_COLOR[open.level] }}
              />
              <span style={{ color: LEVEL_COLOR[open.level] }}>
                {LEVEL_LABEL[open.level].toUpperCase()}
              </span>
            </div>
            <h1 className="note-title">{open.title}</h1>
            {error && <p className="error">{error}</p>}
            <NoteBody
              body={open.body}
              index={index}
              onOpenTitle={(t) => void handleOpenTitle(t)}
              onPickTag={(t) => {
                setTag(t)
                setOpenId(null)
              }}
            />
          </>
        )}

        <section>
          <h2>Enlaza a</h2>
          {outgoingIds.length === 0 && broken.length === 0 && (
            <p className="empty-hint">
              Esta nota todavía no enlaza a ninguna. Escribe <code>[[</code> mientras editas.
            </p>
          )}
          <div className="note-link-list">
            {outgoingIds.map((id) => (
              <NoteChip key={id} note={byId.get(id) as AtlasNote} onOpen={setOpenId} />
            ))}
            {broken.map((link) => (
              <button
                key={link.target}
                type="button"
                className="note-chip note-chip--broken"
                onClick={() => void handleOpenTitle(link.target)}
              >
                {link.target} · crear
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Enlazan aquí</h2>
          {backlinkIds.length === 0 ? (
            <p className="empty-hint">Ninguna nota enlaza a esta todavía.</p>
          ) : (
            <div className="note-link-list">
              {backlinkIds.map((id) => (
                <NoteChip key={id} note={byId.get(id) as AtlasNote} onOpen={setOpenId} />
              ))}
            </div>
          )}
        </section>

        <ConfirmDeleteButton
          confirmMessage={`¿Eliminar "${open.title}"? Los enlaces desde otras notas quedarán marcados como rotos.`}
          onConfirm={async () => {
            await softDeleteNote(open.id)
            setOpenId(null)
          }}
        />
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Grafo
  // ------------------------------------------------------------------
  if (view === 'grafo') {
    return (
      <div className="page">
        <ViewTabs view={view} onChange={setView} />
        <NoteGraph
          notes={notes}
          index={index}
          width={340}
          height={460}
          selectedId={null}
          onSelect={setOpenId}
        />
        <p className="empty-hint">
          Cada punto es una nota, del color de su nivel; el tamaño crece con cuántos enlaces
          tiene. Toca uno para abrirlo.
        </p>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Lista de notas
  // ------------------------------------------------------------------
  const tagged = tag ? new Set(index.tags.get(tag.toLocaleLowerCase('es')) ?? []) : null
  const visible = searchNotes(
    tagged ? notes.filter((n) => tagged.has(n.id)) : notes,
    query,
  )
  const tags = [...index.tags.keys()].sort((a, b) => a.localeCompare(b, 'es'))
  const pending = allBrokenLinks(index)

  return (
    <div className="page">
      <ViewTabs view={view} onChange={setView} />

      <input
        type="search"
        className="note-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar en títulos y contenido…"
        aria-label="Buscar notas"
      />

      {tags.length > 0 && (
        <div className="note-tag-row">
          <button
            type="button"
            className={`note-tag${tag === null ? ' note-tag--active' : ''}`}
            onClick={() => setTag(null)}
          >
            Todas
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              className={`note-tag${tag === t ? ' note-tag--active' : ''}`}
              onClick={() => setTag(tag === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <NewNoteForm onCreate={(title) => void handleCreate(title)} />

      {visible.length === 0 ? (
        <p className="empty-hint">
          {notes.length === 0
            ? 'Todavía no hay notas. Crea la primera y enlázala con [[ ]].'
            : 'Nada coincide con esa búsqueda.'}
        </p>
      ) : (
        <div className="note-list">
          {visible.map((note) => {
            const links = (index.outgoing.get(note.id) ?? []).length
            const backs = (index.backlinks.get(note.id) ?? []).length
            return (
              <button
                key={note.id}
                type="button"
                className="note-card"
                style={{ borderLeftColor: LEVEL_COLOR[note.level] }}
                onClick={() => setOpenId(note.id)}
              >
                <span className="note-card-title">{note.title}</span>
                {note.body.trim() !== '' && (
                  <span className="note-card-excerpt">{excerpt(note.body)}</span>
                )}
                <span className="note-card-meta">
                  {links} enlace{links === 1 ? '' : 's'} · {backs} entrante
                  {backs === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2>Mencionadas sin crear</h2>
          <p className="empty-hint">
            Las enlazaste desde otra nota pero todavía no existen. Tócalas para crearlas.
          </p>
          <div className="note-link-list">
            {pending.map((link) => (
              <button
                key={link.target}
                type="button"
                className="note-chip note-chip--broken"
                onClick={() => void handleOpenTitle(link.target)}
              >
                {link.target}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="sub-tabs">
      <button
        type="button"
        className={view === 'notas' ? 'active' : ''}
        onClick={() => onChange('notas')}
      >
        Notas
      </button>
      <button
        type="button"
        className={view === 'grafo' ? 'active' : ''}
        onClick={() => onChange('grafo')}
      >
        Grafo
      </button>
    </div>
  )
}

function NoteChip({ note, onOpen }: { note?: AtlasNote; onOpen: (id: string) => void }) {
  if (!note) return null
  return (
    <button
      type="button"
      className="note-chip"
      style={{ borderLeftColor: LEVEL_COLOR[note.level] }}
      onClick={() => onOpen(note.id)}
    >
      {note.title}
    </button>
  )
}

function NewNoteForm({ onCreate }: { onCreate: (title: string) => void }) {
  const [title, setTitle] = useState('')
  return (
    <form
      className="note-new"
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim() === '') return
        onCreate(title.trim())
        setTitle('')
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nueva nota…"
        aria-label="Título de la nota nueva"
      />
      <button type="submit" disabled={title.trim() === ''}>
        Crear
      </button>
    </form>
  )
}

interface NoteBodyProps {
  body: string
  index: ReturnType<typeof buildIndex>
  onOpenTitle: (title: string) => void
  onPickTag: (tag: string) => void
}

/**
 * El Markdown ya viene saneado, así que se inyecta y se escuchan los clics en
 * el contenedor: así los `[[enlaces]]` y las `#etiquetas` navegan sin montar un
 * componente por cada uno.
 */
function NoteBody({ body, index, onOpenTitle, onPickTag }: NoteBodyProps) {
  const existingTitles = useMemo(() => new Set(index.byTitle.keys()), [index])
  const html = useMemo(
    () => renderMarkdown(body, { existingTitles }),
    [body, existingTitles],
  )

  if (body.trim() === '') {
    return <p className="empty-hint">Esta nota está vacía. Toca «Editar» para escribirla.</p>
  }

  return (
    <div
      className="note-rendered"
      onClick={(e) => {
        const el = (e.target as HTMLElement).closest('[data-wikilink],[data-tag]')
        if (!(el instanceof HTMLElement)) return
        e.preventDefault()
        const link = el.dataset.wikilink
        const tag = el.dataset.tag
        if (link !== undefined) onOpenTitle(link)
        else if (tag !== undefined) onPickTag(tag)
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
