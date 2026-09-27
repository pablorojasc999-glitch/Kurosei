import { ringArcs } from '../lib/completionRing'
import type { DayCompletion, ModuleKey } from '../lib/dayCompletion'

/** El orden de los arcos alrededor del anillo, desde arriba y en sentido horario. */
const ARC_ORDER: ModuleKey[] = ['training', 'nutrition', 'finance', 'bitacora']

interface CompletionRingProps {
  day: DayCompletion
  /** Lo que va adentro: el número del día en el calendario. */
  children?: React.ReactNode
  size?: number
}

/**
 * Cuatro arcos alrededor de un número: cuánto le falta al día y qué le falta.
 *
 * Un arco apagado es un módulo pendiente. Como la posición es siempre la misma
 * se aprende sola: el hueco de arriba es el entrenamiento, el de la izquierda
 * la bitácora.
 */
export function CompletionRing({ day, children, size = 34 }: CompletionRingProps) {
  const stroke = 2.5
  const radius = size / 2 - stroke / 2
  const arcs = ringArcs(radius, 3)

  return (
    <span className="completion-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {ARC_ORDER.map((key, index) => (
            <circle
              key={key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              className={`completion-arc completion-arc--${day[key]}`}
              strokeDasharray={arcs[index].dashArray}
              strokeDashoffset={arcs[index].dashOffset}
            />
          ))}
        </g>
      </svg>
      {children !== undefined && <span className="completion-ring-label">{children}</span>}
    </span>
  )
}
