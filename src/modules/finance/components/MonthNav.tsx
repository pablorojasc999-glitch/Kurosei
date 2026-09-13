import { addMonths, formatMonthKey } from '../lib/month'

interface MonthNavProps {
  monthKey: string
  onChange: (monthKey: string) => void
}

export function MonthNav({ monthKey, onChange }: MonthNavProps) {
  return (
    <div className="day-nav">
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => onChange(addMonths(monthKey, -1))}
      >
        ‹
      </button>
      <div className="day-nav-label">
        <span className="day-nav-label-line">{formatMonthKey(monthKey)}</span>
      </div>
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => onChange(addMonths(monthKey, 1))}
      >
        ›
      </button>
    </div>
  )
}
