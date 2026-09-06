import { useEffect, useRef, useState } from 'react'
import type { AtlasNode, MasteryLevel } from '../domain/types'
import { MASTERY_LEVELS } from '../domain/types'
import { LEVEL_COLOR, LEVEL_LABEL, LEVEL_SHORT } from '../lib/atlasTree'

interface AtlasNodePageProps {
  profileName: string
  node: AtlasNode
  parent: AtlasNode | null
  childNodes: AtlasNode[]
  desktop: boolean
  onBack: () => void
  onOpen: (id: string) => void
  onRename: (name: string) => void
  onLevel: (level: MasteryLevel) => void
  onNote: (note: string) => void
  onAddChild: () => void
  onDelete: () => void
}

export function AtlasNodePage({
  profileName,
  node,
  parent,
  childNodes,
  desktop,
  onBack,
  onOpen,
  onRename,
  onLevel,
  onNote,
  onAddChild,
  onDelete,
}: AtlasNodePageProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.name)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(node.note)
  const [armed, setArmed] = useState(false)
  const titleRef = useRef<HTMLInputElement | null>(null)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (editingNote) noteRef.current?.focus()
  }, [editingNote])

  function commitTitle() {
    const name = titleDraft.trim()
    if (name && name !== node.name) onRename(name)
    else setTitleDraft(node.name)
    setEditingTitle(false)
  }

  function commitNote() {
    onNote(noteDraft)
    setEditingNote(false)
  }

  const isRoot = node.parentId === null

  // Nivel + relaciones + borrado: en escritorio viven en el rail derecho, en
  // móvil se apilan bajo la nota. El contenido es el mismo.
  const side = (
    <>
      <div className="atlas-eyebrow" style={{ marginBottom: 12 }}>
        NIVEL DE DOMINIO
      </div>
      <div className="atlas-levels">
        {MASTERY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`atlas-level atlas-level--${level}${
              node.level === level ? ' atlas-level--active' : ''
            }`}
            aria-pressed={node.level === level}
            aria-label={LEVEL_LABEL[level]}
            onClick={() => onLevel(level)}
          >
            {LEVEL_SHORT[level]}
          </button>
        ))}
      </div>
      <div className="atlas-note-hint" style={{ marginTop: 10 }}>
        Tú decides cuándo cambia. La app no lo calcula.
      </div>

      <div className="atlas-hairline" style={{ margin: '22px 0 14px' }} />

      <div className="atlas-eyebrow" style={{ marginBottom: 12 }}>
        RELACIONES
      </div>
      <div className="atlas-children-list">
        {parent && (
          <button
            type="button"
            className="atlas-relation"
            style={{ borderLeftColor: LEVEL_COLOR[parent.level] }}
            onClick={() => onOpen(parent.id)}
          >
            <span className="atlas-relation-kind">PADRE</span>
            <span className="atlas-relation-name">{parent.name}</span>
          </button>
        )}
        {childNodes.map((child) => (
          <button
            key={child.id}
            type="button"
            className="atlas-relation"
            style={{ borderLeftColor: LEVEL_COLOR[child.level] }}
            onClick={() => onOpen(child.id)}
          >
            <span className="atlas-relation-kind">HIJO</span>
            <span className="atlas-relation-name">{child.name}</span>
          </button>
        ))}
        {!parent && childNodes.length === 0 && (
          <div className="atlas-note-hint">Todavía no cuelga nada de aquí.</div>
        )}
      </div>
      <button type="button" className="atlas-add-child" onClick={onAddChild}>
        + AÑADIR HIJO
      </button>

      {!isRoot && (
        <>
          <div className="atlas-hairline" style={{ margin: '14px 0 0' }} />
          <button
            type="button"
            className={`atlas-danger${armed ? ' atlas-danger--armed' : ''}`}
            onClick={() => {
              if (armed) onDelete()
              else setArmed(true)
            }}
            onBlur={() => setArmed(false)}
          >
            {armed
              ? childNodes.length > 0
                ? `PULSA OTRA VEZ — SE LLEVA ${childNodes.length} NODO${childNodes.length === 1 ? '' : 'S'}`
                : 'PULSA OTRA VEZ PARA BORRAR'
              : 'BORRAR ESTE NODO'}
          </button>
        </>
      )}
    </>
  )

  return (
    <>
      <div className="atlas-crumbs">
        <button type="button" className="atlas-back" onClick={onBack}>
          <span aria-hidden="true">←</span> MAPA
        </button>
        <span className="atlas-divider" />
        <span className="atlas-crumb">{profileName}</span>
        {/* La raíz lleva el nombre del perfil: repetirla dejaría "X › X". */}
        {parent && parent.parentId !== null && (
          <>
            <span className="atlas-crumb-sep" aria-hidden="true">
              ›
            </span>
            <span className="atlas-crumb">{parent.name}</span>
          </>
        )}
      </div>

      <div className="atlas-node-body">
        <div className="atlas-node-main">
          <div className="atlas-level-flag">
            <span
              className="atlas-level-flag-dot"
              style={{ background: LEVEL_COLOR[node.level] }}
            />
            <span className="atlas-level-flag-text" style={{ color: LEVEL_COLOR[node.level] }}>
              {LEVEL_LABEL[node.level].toUpperCase()}
            </span>
            <span className="atlas-level-flag-meta">· LO FIJASTE TÚ</span>
          </div>

          {editingTitle ? (
            <input
              ref={titleRef}
              className="atlas-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') {
                  setTitleDraft(node.name)
                  setEditingTitle(false)
                }
              }}
              aria-label="Nombre del nodo"
            />
          ) : (
            <h1
              className="atlas-title"
              role="button"
              tabIndex={0}
              onClick={() => setEditingTitle(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingTitle(true)
              }}
            >
              {node.name}
            </h1>
          )}

          <div className="atlas-parent-line">
            {parent ? `CUELGA DE ${parent.name.toUpperCase()}` : 'RAÍZ DEL PERFIL'}
          </div>

          <div className="atlas-hairline" style={{ margin: '22px 0 18px' }} />

          {editingNote ? (
            <>
              <textarea
                ref={noteRef}
                className="atlas-note-editor"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                aria-label="Nota del nodo"
                placeholder="Qué sabes, qué te falta, qué probaste."
              />
              <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
                <button type="button" className="atlas-add-child" onClick={commitNote}>
                  GUARDAR NOTA
                </button>
                <button
                  type="button"
                  className="atlas-danger"
                  onClick={() => {
                    setNoteDraft(node.note)
                    setEditingNote(false)
                  }}
                >
                  DESCARTAR
                </button>
              </div>
            </>
          ) : (
            <>
              {node.note ? (
                <p className="atlas-note">{node.note}</p>
              ) : (
                <p className="atlas-note-empty">
                  Sin nota todavía. Escribe lo que sabes y lo que te falta.
                </p>
              )}
              <button
                type="button"
                className="atlas-add-child"
                onClick={() => setEditingNote(true)}
              >
                EDITAR NOTA
              </button>
            </>
          )}

          {!desktop && (
            <>
              <div className="atlas-rule-strong" style={{ margin: '26px 0 20px' }} />
              {side}
            </>
          )}
        </div>

        {desktop && <div className="atlas-rail">{side}</div>}
      </div>
    </>
  )
}
