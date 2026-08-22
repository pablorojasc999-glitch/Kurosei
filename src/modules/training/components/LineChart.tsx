import { buildLineChartGeometry, computeJointRange, dateToX } from '../lib/lineChart'
import type { ChartPoint } from '../lib/lineChart'
import { formatDate } from '../lib/format'

export interface ChartSeries {
  label: string
  color: string
  points: ChartPoint[]
}

interface LineChartProps {
  /** Every calendar date in the active scope, ascending — the shared x-axis. */
  domainDates: string[]
  series: ChartSeries[]
  unit?: string
  /** Dates to mark with a faint vertical tick (e.g. days a strength session happened). */
  markedDates?: Set<string>
}

const WIDTH = 300
const HEIGHT = 120
const PADDING_Y = 14

export function LineChart({ domainDates, series, unit = '', markedDates }: LineChartProps) {
  const jointRange =
    series.length > 1 ? computeJointRange(series.map((s) => s.points)) : undefined

  const plotted = series
    .map((s) => ({
      series: s,
      geometry: buildLineChartGeometry(
        domainDates,
        s.points,
        WIDTH,
        HEIGHT,
        PADDING_Y,
        jointRange ?? undefined,
      ),
    }))
    .filter((p) => p.geometry !== null) as {
    series: ChartSeries
    geometry: NonNullable<ReturnType<typeof buildLineChartGeometry>>
  }[]

  if (plotted.length === 0) {
    return <p className="empty-hint">Sin datos en este periodo.</p>
  }

  const marks = markedDates
    ? domainDates.filter((d) => markedDates.has(d))
    : []

  return (
    <div className="line-chart">
      {series.length > 1 && (
        <div className="line-chart-legend">
          {series.map((s) => (
            <span key={s.label} className="line-chart-legend-item">
              <span className="line-chart-legend-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="line-chart-svg" preserveAspectRatio="none">
        {marks.map((date) => (
          <line
            key={date}
            className="line-chart-mark"
            x1={dateToX(domainDates, date, WIDTH)}
            x2={dateToX(domainDates, date, WIDTH)}
            y1={0}
            y2={HEIGHT}
          />
        ))}
        {plotted.map(({ series: s, geometry }) => (
          <g key={s.label}>
            <path
              d={geometry.path}
              fill="none"
              style={{ stroke: s.color }}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {geometry.points.map((p) => (
              <circle key={p.date} cx={p.x} cy={p.y} r={3.5} style={{ fill: s.color }}>
                <title>
                  {formatDate(p.date)} · {s.label}: {p.value.toFixed(1)}
                  {unit}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <div className="line-chart-range">
        <span>{formatDate(domainDates[0])}</span>
        <span>{formatDate(domainDates[domainDates.length - 1])}</span>
      </div>
    </div>
  )
}
