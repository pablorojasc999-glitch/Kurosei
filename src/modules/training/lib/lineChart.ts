export interface ChartPoint {
  date: string
  value: number | null
}

export interface PlottedPoint {
  date: string
  value: number
  x: number
  y: number
}

export interface ChartGeometry {
  points: PlottedPoint[]
  path: string
  min: number
  max: number
}

export interface YRange {
  min: number
  max: number
}

/** x-coordinate for `date`'s position in an evenly spaced calendar-day axis. */
export function dateToX(domainDates: string[], date: string, width: number): number {
  const index = domainDates.indexOf(date)
  if (index === -1 || domainDates.length <= 1) return width / 2
  return (index / (domainDates.length - 1)) * width
}

/**
 * Builds an SVG polyline path for one series, plotted against a shared
 * calendar-day x-axis (`domainDates`) so multiple series (or a training-day
 * marker overlay) line up correctly even when a series has gaps. Days with
 * no value are skipped rather than interpolated.
 */
export function buildLineChartGeometry(
  domainDates: string[],
  points: ChartPoint[],
  width: number,
  height: number,
  paddingY: number,
  yRange?: YRange,
): ChartGeometry | null {
  const valueByDate = new Map(
    points.filter((p): p is { date: string; value: number } => p.value !== null).map((p) => [p.date, p.value]),
  )

  const plotted: PlottedPoint[] = []
  for (const date of domainDates) {
    const value = valueByDate.get(date)
    if (value === undefined) continue
    plotted.push({ date, value, x: dateToX(domainDates, date, width), y: 0 })
  }
  if (plotted.length === 0) return null

  const values = plotted.map((p) => p.value)
  const min = yRange?.min ?? Math.min(...values)
  const max = yRange?.max ?? Math.max(...values)
  const range = max - min || 1
  const usableHeight = height - paddingY * 2

  for (const p of plotted) {
    p.y = height - paddingY - ((p.value - min) / range) * usableHeight
  }

  const path = plotted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return { points: plotted, path, min, max }
}

/** The shared y-range spanning every series, so multi-series charts (same unit) plot on one comparable scale. */
export function computeJointRange(seriesPoints: ChartPoint[][]): YRange | null {
  const values = seriesPoints
    .flatMap((points) => points)
    .filter((p): p is { date: string; value: number } => p.value !== null)
    .map((p) => p.value)
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}
