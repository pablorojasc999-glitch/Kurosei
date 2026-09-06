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

/** Un árbol de nodos: la raíz a la izquierda y dos ramas colgando. */
export function IconAtlas() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M7 12h4v-6h6M11 12v6h6" />
    </svg>
  )
}
