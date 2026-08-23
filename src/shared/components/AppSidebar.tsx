import type { ReactElement } from 'react'

export type AppModule = 'entrenamiento' | 'organizacion'

interface AppSidebarProps {
  open: boolean
  activeModule: AppModule
  onSelect: (module: AppModule) => void
  onClose: () => void
}

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'sidebar-nav-icon',
  'aria-hidden': true,
}

function IconDumbbell() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 9v6M2 10v4M20 9v6M22 10v4M7 12h10" />
      <path d="M6 7v10M18 7v10" />
    </svg>
  )
}

function IconOrganization() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 13h3M8 17h6" />
    </svg>
  )
}

const MODULES: Array<{ id: AppModule; label: string; icon: () => ReactElement }> = [
  { id: 'entrenamiento', label: 'Entrenamiento', icon: IconDumbbell },
  { id: 'organizacion', label: 'Organización', icon: IconOrganization },
]

export function AppSidebar({ open, activeModule, onSelect, onClose }: AppSidebarProps) {
  return (
    <>
      <div
        className={`sidebar-backdrop${open ? ' sidebar-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <nav
        className={`app-sidebar${open ? ' app-sidebar--open' : ''}`}
        aria-hidden={!open}
        aria-label="Módulos"
      >
        <div className="app-sidebar-header">
          <span className="app-logo-word">Kurosei</span>
        </div>
        <ul className="sidebar-nav-list">
          {MODULES.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                className={`sidebar-nav-item${id === activeModule ? ' active' : ''}`}
                onClick={() => {
                  onSelect(id)
                  onClose()
                }}
              >
                <Icon />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
