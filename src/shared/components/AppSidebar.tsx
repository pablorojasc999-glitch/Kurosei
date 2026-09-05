import type { ReactElement } from 'react'

export type AppModule = 'registro' | 'entrenamiento' | 'finanzas' | 'nutricion'

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

function IconRegistroModule() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

function IconDumbbell() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 9v6M2 10v4M20 9v6M22 10v4M7 12h10" />
      <path d="M6 7v10M18 7v10" />
    </svg>
  )
}

function IconFinance() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.2c0 3 6 1.3 6 4.3 0 1.3-1.3 2.5-3 2.5s-3-1.1-3-2.5" />
    </svg>
  )
}

function IconNutrition() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3c3.5 4 6 7.5 6 10.5a6 6 0 1 1-12 0C6 10.5 8.5 7 12 3Z" />
    </svg>
  )
}

const MODULES: Array<{ id: AppModule; label: string; icon: () => ReactElement }> = [
  { id: 'registro', label: 'Registro', icon: IconRegistroModule },
  { id: 'entrenamiento', label: 'Entrenamiento', icon: IconDumbbell },
  { id: 'finanzas', label: 'Finanzas', icon: IconFinance },
  { id: 'nutricion', label: 'Nutrición', icon: IconNutrition },
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
