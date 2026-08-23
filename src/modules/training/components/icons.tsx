const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'tab-icon',
  'aria-hidden': true,
}

export function IconRegistro() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

export function IconPlan() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="19" cy="18" r="2" />
    </svg>
  )
}

export function IconCalendar() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function IconProgress() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l3.5-4 3 2.5L19 8" />
    </svg>
  )
}

export function IconLibrary() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5 4h4a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5z" />
      <path d="M19 4h-4a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4z" />
    </svg>
  )
}

export function IconCalculator() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  )
}
