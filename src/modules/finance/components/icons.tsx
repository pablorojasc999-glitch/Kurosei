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

export function IconAccounts() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  )
}

export function IconCategories() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

export function IconTransactions() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 4h12v16l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 9h6M9 13h6" />
    </svg>
  )
}
