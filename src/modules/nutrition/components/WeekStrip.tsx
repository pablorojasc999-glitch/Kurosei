import { toDateKey } from '../../training/lib/calendarGrid'
import type { GoalStatus } from '../lib/goalPlans'
import { WEEKDAY_LABELS } from '../lib/weekStrip'

interface WeekStripDay {
  date: Date
  status: GoalStatus
}

interface WeekStripProps {
  days: WeekStripDay[]
  selectedDate: Date
  onSelect: (date: Date) => void
}

export function WeekStrip({ days, selectedDate, onSelect }: WeekStripProps) {
  const selectedKey = toDateKey(selectedDate)
  return (
    <div className="nutrition-week-strip">
      {days.map((day, i) => {
        const dateKey = toDateKey(day.date)
        const isSelected = dateKey === selectedKey
        return (
          <button
            key={dateKey}
            type="button"
            className={`nutrition-week-day${isSelected ? ' nutrition-week-day--selected' : ''}`}
            onClick={() => onSelect(day.date)}
            aria-current={isSelected ? 'date' : undefined}
          >
            <span className="nutrition-week-day-label">{WEEKDAY_LABELS[i]}</span>
            <span
              className={`nutrition-week-day-dot nutrition-week-day-dot--${day.status}`}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </div>
  )
}
