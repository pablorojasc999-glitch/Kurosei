import { useState } from 'react'
import { buildLineChartGeometry, computeJointRange, dateToX } from '../lib/lineChart'
import type { ChartPoint } from '../lib/lineChart'
import { formatDateWithWeekday } from '../lib/format'

export interface ChartSeries {
  label: string
  color: string
  points: ChartPoint[]
}

export interface TooltipExtra {
  label: string
  value: string
}

interface LineChartProps {
  /** Every calendar date in the active scope, ascending — the shared x-axis. */
  domainDates: string[]
  series: ChartSeries[]
  unit?: string
  /** Dates to mark with a faint vertical tick (e.g. days a strength session happened). */
  markedDates?: Set<string>
  /** Extra context line shown in the tooltip for the tapped date (e.g. that day's bodyweight). */
  tooltipExtra?: (date: string) => TooltipExtra | null
}

const WIDTH = 300
const HEIGHT = 150
const PADDING_Y = 16

export function LineChart({
  domainDates,
  series,
  unit = '',
  markedDates,
  tooltipExtra,
}: LineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

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

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || domainDates.length === 0) return
    const relX = (e.clientX - rect.left) / rect.width
    const index = Math.min(
      Math.max(Math.round(relX * (domainDates.length - 1)), 0),
      domainDates.length - 1,
    )
    setActiveIndex(index)
  }

  const marks = markedDates ? domainDates.filter((d) => markedDates.has(d)) : []
  const activeDate = activeIndex !== null ? domainDates[activeIndex] : null
  const activeX = activeDate !== null ? dateToX(domainDates, activeDate, WIDTH) : null
  const extra = activeDate !== null ? (tooltipExtra?.(activeDate) ?? null) : null

  // Every series shares one y-range once `jointRange` is applied, so the
  // first plotted series' geometry already reflects the chart-wide min/max.
  const { min: rangeMin, max: rangeMax } = plotted[0].geometry
  const rangeMid = (rangeMin + rangeMax) / 2
  const latestPoint = plotted[0].geometry.points[plotted[0].geometry.points.length - 1]

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

      <div className="line-chart-tooltip">
        {activeDate !== null ? (
          <>
            <span className="line-chart-tooltip-date">{formatDateWithWeekday(activeDate)}</span>
            {series.map((s) => {
              const point = s.points.find((p) => p.date === activeDate)
              return (
                <span key={s.label} className="line-chart-tooltip-value">
                  <span className="line-chart-legend-dot" style={{ background: s.color }} />
                  {s.label}: {point?.value != null ? `${point.value.toFixed(1)}${unit}` : 'sin dato'}
                </span>
              )
            })}
            {extra && (
              <span className="line-chart-tooltip-value line-chart-tooltip-extra">
                {extra.label}: {extra.value}
              </span>
            )}
          </>
        ) : (
          <span className="line-chart-tooltip-hint">
            <span className="line-chart-tooltip-item">
              Último {latestPoint.value.toFixed(1)}
              {unit} ({formatDateWithWeekday(latestPoint.date)})
            </span>
            <span className="line-chart-tooltip-item">
              Rango {rangeMin.toFixed(1)}–{rangeMax.toFixed(1)}
              {unit}
            </span>
            <span className="line-chart-tooltip-item">Toca para ver un día</span>
          </span>
        )}
      </div>

      <div className="line-chart-plot">
        <div className="line-chart-yaxis">
          <span>
            {rangeMax.toFixed(1)}
            {unit}
          </span>
          <span>
            {rangeMid.toFixed(1)}
            {unit}
          </span>
          <span>
            {rangeMin.toFixed(1)}
            {unit}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="line-chart-svg"
          preserveAspectRatio="none"
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
        >
          {[0, 0.5, 1].map((fraction) => (
            <line
              key={fraction}
              className="line-chart-gridline"
              x1={0}
              x2={WIDTH}
              y1={PADDING_Y + fraction * (HEIGHT - PADDING_Y * 2)}
              y2={PADDING_Y + fraction * (HEIGHT - PADDING_Y * 2)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
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
          {activeX !== null && (
            <line
              className="line-chart-crosshair"
              x1={activeX}
              x2={activeX}
              y1={0}
              y2={HEIGHT}
              vectorEffect="non-scaling-stroke"
            />
          )}
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
                <circle
                  key={p.date}
                  cx={p.x}
                  cy={p.y}
                  r={p.date === activeDate ? 5 : 3.5}
                  style={{ fill: s.color }}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="line-chart-range">
        <span>{formatDateWithWeekday(domainDates[0])}</span>
        <span>{formatDateWithWeekday(domainDates[domainDates.length - 1])}</span>
      </div>
    </div>
  )
}
