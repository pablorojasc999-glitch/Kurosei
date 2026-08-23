import { formatDayHeaderLines } from '../lib/calendarGrid'

interface DayHeaderLabelProps {
  date: Date
}

/**
 * The two-line "Hoy · Domingo" / "23 de agosto" content of a day-nav label
 * — split across two short lines instead of one long one so it never has to
 * wrap or shrink to fit a narrow screen. The caller owns the wrapping
 * element (a <span> or a clickable <button>) and should set its
 * `aria-label` from formatDayHeader for a single unambiguous string.
 */
export function DayHeaderLabel({ date }: DayHeaderLabelProps) {
  const [topLine, bottomLine] = formatDayHeaderLines(date)
  return (
    <>
      <span className="day-nav-label-line">{topLine}</span>
      <span className="day-nav-label-line">{bottomLine}</span>
    </>
  )
}
