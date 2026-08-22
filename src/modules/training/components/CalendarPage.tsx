import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import { addMonths, buildMonthGrid, startOfMonth, toDateKey } from '../lib/calendarGrid'

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface CalendarPageProps {
  onOpenDay: (dayId: string) => void
}

export function CalendarPage({ onOpenDay }: CalendarPageProps) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))

  const days = useLiveQuery(
    () => db.training_days.filter((d) => d.deletedAt === null).toArray(),
    [],
  )
  const sessions = useLiveQuery(
    () => db.training_sessions.filter((s) => s.deletedAt === null).toArray(),
    [],
  )
  const executedSets = useLiveQuery(
    () => db.training_executed_sets.filter((s) => s.deletedAt === null).toArray(),
    [],
  )
  const sessionExercises = useLiveQuery(
    () =>
      db.training_session_exercises.filter((se) => se.deletedAt === null).toArray(),
    [],
  )
  const cardioSessions = useLiveQuery(
    () => db.training_cardio_sessions.filter((s) => s.deletedAt === null).toArray(),
    [],
  )

  if (!days || !sessions || !executedSets || !sessionExercises || !cardioSessions) {
    return null
  }

  const daysByDateKey = new Map<string, (typeof days)[number]>()
  for (const day of days) {
    daysByDateKey.set(toDateKey(new Date(day.date)), day)
  }

  const sessionIdsWithSets = new Set(
    executedSets
      .map((s) => sessionExercises.find((se) => se.id === s.sessionExerciseId)?.sessionId)
      .filter((id): id is string => Boolean(id)),
  )
  const trainedDayIds = new Set(
    sessions.filter((s) => sessionIdsWithSets.has(s.id)).map((s) => s.dayId),
  )
  const cardioDayIds = new Set(cardioSessions.map((s) => s.dayId))

  const grid = buildMonthGrid(monthStart)
  const rawMonthLabel = monthStart.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  const monthLabel =
    rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1)
  const todayKey = toDateKey(new Date())

  return (
    <div className="page">
      <h1>Calendario</h1>

      <div className="calendar-nav">
        <button type="button" onClick={() => setMonthStart((m) => addMonths(m, -1))}>
          ‹
        </button>
        <span className="calendar-month-label">{monthLabel}</span>
        <button type="button" onClick={() => setMonthStart((m) => addMonths(m, 1))}>
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {grid.map((date) => {
          const dateKey = toDateKey(date)
          const day = daysByDateKey.get(dateKey)
          const isCurrentMonth = date.getMonth() === monthStart.getMonth()
          const isToday = dateKey === todayKey
          const isTrained = day && trainedDayIds.has(day.id)
          const hasCardio = day && cardioDayIds.has(day.id)

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!day}
              className={`calendar-cell${isCurrentMonth ? '' : ' calendar-cell--outside'}${isToday ? ' calendar-cell--today' : ''}`}
              onClick={() => day && onOpenDay(day.id)}
            >
              <span className="calendar-cell-number">{date.getDate()}</span>
              {day?.label && isCurrentMonth && (
                <span className="calendar-cell-label">{day.label}</span>
              )}
              <span className="calendar-cell-dots">
                {isTrained && <span className="calendar-dot calendar-dot--strength" />}
                {hasCardio && <span className="calendar-dot calendar-dot--cardio" />}
                {day && !isTrained && !hasCardio && (
                  <span className="calendar-dot calendar-dot--planned" />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
