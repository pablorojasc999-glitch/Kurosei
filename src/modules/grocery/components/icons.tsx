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

/** Carro de supermercado. */
export function IconGrocery() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2 4h2.2l2.3 10.4a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.5L19.6 8H5.4" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  )
}
