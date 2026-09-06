import type { AtlasNode, AtlasProfile } from '../domain/types'
import { MASTERY_LEVELS } from '../domain/types'
import { LEVEL_COLOR, LEVEL_LABEL, countByLevel } from '../lib/atlasTree'

interface AtlasOverviewProps {
  profiles: AtlasProfile[]
  nodesByProfile: Map<string, AtlasNode[]>
  onOpenProfile: (id: string) => void
  onAddProfile: () => void
}

export function AtlasOverview({
  profiles,
  nodesByProfile,
  onOpenProfile,
  onAddProfile,
}: AtlasOverviewProps) {
  return (
    <div className="atlas-overview">
      <h1 className="atlas-overview-title">Dónde estás hoy</h1>
      <p className="atlas-overview-lead">
        Todos tus perfiles de un vistazo. El color no lo calcula la app: es el nivel que le
        pusiste a cada nodo.
      </p>

      {profiles.map((profile) => {
        const nodes = nodesByProfile.get(profile.id) ?? []
        const counts = countByLevel(nodes)
        const root = nodes.find((n) => n.parentId === null)
        const total = nodes.length
        return (
          <div
            key={profile.id}
            className="atlas-overview-row"
            role="button"
            tabIndex={0}
            onClick={() => onOpenProfile(profile.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpenProfile(profile.id)
            }}
          >
            <div>
              <div className="atlas-overview-name">
                <span
                  className="atlas-tab-dot"
                  style={{ background: LEVEL_COLOR[root?.level ?? 'desarrollo'] }}
                />
                <strong>{profile.name}</strong>
              </div>
              <div className="atlas-overview-meta">
                {total} NODO{total === 1 ? '' : 'S'}
              </div>
            </div>
            <div>
              <div className="atlas-overview-bar">
                {MASTERY_LEVELS.map((level) =>
                  counts[level] > 0 ? (
                    <span
                      key={level}
                      style={{ flex: counts[level], background: LEVEL_COLOR[level] }}
                    />
                  ) : null,
                )}
                {total === 0 && <span style={{ flex: 1, background: 'var(--atlas-rule)' }} />}
              </div>
              <div className="atlas-overview-counts">
                {MASTERY_LEVELS.map((level) => (
                  <span key={level}>
                    <b style={{ color: LEVEL_COLOR[level] }}>{counts[level]}</b>{' '}
                    {LEVEL_LABEL[level].toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        className="atlas-add-child"
        style={{ marginTop: 8 }}
        onClick={onAddProfile}
      >
        + AÑADIR OTRO PERFIL
      </button>
    </div>
  )
}
