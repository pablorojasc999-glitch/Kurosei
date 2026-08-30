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

export function IconNutritionRegistro() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M7 3v7M5 3v4a2 2 0 0 0 4 0V3M17 3c-2 1-3 3-3 6 0 2 1 3 3 3v9" />
    </svg>
  )
}

export function IconTemplates() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  )
}

export function IconWater() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3c3.5 4 6 7.5 6 10.5a6 6 0 1 1-12 0C6 10.5 8.5 7 12 3Z" />
    </svg>
  )
}

export function IconFoodLibrary() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  )
}

export function IconGoals() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </svg>
  )
}
