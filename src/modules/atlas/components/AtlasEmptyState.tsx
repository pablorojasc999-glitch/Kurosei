import { useState } from 'react'
import { ATLAS_TEMPLATES, countTemplateNodes, type AtlasTemplate } from '../lib/atlasTemplates'

interface AtlasEmptyStateProps {
  /** `true` cuando ya hay perfiles y se está añadiendo otro: cambia el copy. */
  additional: boolean
  desktop: boolean
  onCreate: (name: string, template?: AtlasTemplate) => void
  onCancel?: () => void
}

export function AtlasEmptyState({
  additional,
  desktop,
  onCreate,
  onCancel,
}: AtlasEmptyStateProps) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  function create(template?: AtlasTemplate) {
    // Sin nombre escrito, la plantilla presta el suyo; en blanco no hay nada
    // que prestar, así que ese botón espera a que se escriba algo.
    const finalName = trimmed || template?.name
    if (!finalName) return
    onCreate(finalName, template)
    setName('')
  }

  return (
    <div className="atlas-empty">
      <div className="atlas-empty-inner">
        <div className="atlas-empty-eyebrow">{additional ? 'OTRO PERFIL' : 'EMPIEZA AQUÍ'}</div>
        <h1 className="atlas-empty-title">
          {additional ? 'Otra versión de ti.' : 'Tu mapa está en blanco.'}
        </h1>
        <p className="atlas-empty-text">
          Un perfil es una versión de ti que estás construyendo. Ponle nombre y cuelga debajo
          lo que la compone: cada nodo lleva su nivel de dominio y su nota, y los fijas tú.
        </p>

        <div className="atlas-name-form">
          <input
            className="atlas-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmed) create()
            }}
            placeholder="Powerlifting, Emprendedor de IA, Escalada…"
            aria-label="Nombre del perfil"
          />
          <div className={desktop ? 'atlas-cta-row' : undefined}>
            <button
              type="button"
              className="atlas-cta"
              disabled={!trimmed}
              style={trimmed ? undefined : { opacity: 0.4, cursor: 'default' }}
              onClick={() => create()}
            >
              CREAR EL PRIMER NODO
            </button>
            {desktop && onCancel && (
              <button type="button" className="atlas-cta atlas-cta--ghost" onClick={onCancel}>
                Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="atlas-eyebrow" style={{ marginBottom: 12 }}>
          O ARRANCA DESDE UNA BASE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ATLAS_TEMPLATES.map((template) => {
            const blank = template.id === 'en-blanco'
            const count = countTemplateNodes(template.root)
            return (
              <button
                key={template.id}
                type="button"
                className={`atlas-template${blank ? ' atlas-template--blank' : ''}`}
                disabled={blank && !trimmed}
                style={blank && !trimmed ? { opacity: 0.5, cursor: 'default' } : undefined}
                onClick={() => create(template)}
              >
                <span className="atlas-template-name">{template.name}</span>
                <span className="atlas-template-desc">{template.description}</span>
                <span className="atlas-template-count">
                  {count} NODO{count === 1 ? '' : 'S'}
                </span>
              </button>
            )
          })}
        </div>

        {!desktop && onCancel && (
          <button type="button" className="atlas-danger" onClick={onCancel}>
            VOLVER
          </button>
        )}
      </div>
    </div>
  )
}
