import { useCallback, useState } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { useSupabaseSession } from '../../../shared/hooks/useSupabaseSession'
import { listAllCardioSessions } from '../db/cardioRepository'
import { listAllExecutedSets, listAllSessionExercises, listAllSessions } from '../db/executionRepository'
import { listAllDays } from '../db/planningRepository'
import { addMonths, buildMonthGrid, startOfMonth, toDateKey } from '../lib/calendarGrid'
import { countTrainingDays, type TrainingDayMark } from '../lib/trainingDayCounts'

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface CalendarPageProps {
  onOpenDay: (date: Date) => void
}

export function CalendarPage({ onOpenDay }: CalendarPageProps) {
  const session = useSupabaseSession()
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))

  const { data } = useRemoteQuery(
    useCallback(async () => {
      const [days, sessions, executedSets, sessionExercises, cardioSessions] = await Promise.all([
        listAllDays(),
        listAllSessions(),
        listAllExecutedSets(),
        listAllSessionExercises(),
        listAllCardioSessions(),
      ])
      return { days, sessions, executedSets, sessionExercises, cardioSessions }
    }, []),
  )

  if (session === undefined) {
    return (
      <div className="page">
        <h1>Calendario</h1>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="page">
        <h1>Calendario</h1>
        <p className="empty-hint">
          Iniciá sesión (el ícono de arriba a la derecha) para ver tu calendario.
        </p>
      </div>
    )
  }
  if (!data) return null
  const { days, sessions, executedSets, sessionExercises, cardioSessions } = data

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

  // Se cuenta con el mismo criterio que pinta los puntos de la cuadrícula: un
  // día de fuerza es el que tiene series anotadas, no el que estaba planificado.
  const marks: TrainingDayMark[] = days.map((day) => ({
    date: toDateKey(new Date(day.date)),
    strength: trainedDayIds.has(day.id),
    cardio: cardioDayIds.has(day.id),
  }))
  const monthPrefix = toDateKey(monthStart).slice(0, 7)
  const yearPrefix = monthPrefix.slice(0, 4)
  const monthCounts = countTrainingDays(marks, monthPrefix)
  const yearCounts = countTrainingDays(marks, yearPrefix)

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
              className={[
                'calendar-cell',
                !isCurrentMonth && 'calendar-cell--outside',
                isToday && 'calendar-cell--today',
                isTrained && 'calendar-cell--trained',
                day && !isTrained && !hasCardio && 'calendar-cell--planned',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onOpenDay(date)}
            >
              <span className="calendar-cell-number numeric">{date.getDate()}</span>
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

      <div className="calendar-counts">
        {[
          { label: monthLabel, counts: monthCounts },
          { label: yearPrefix, counts: yearCounts },
        ].map(({ label, counts }) => (
          <div key={label} className="calendar-counts-group">
            <span className="calendar-counts-period">{label}</span>
            <div className="calendar-counts-row">
              <div className="calendar-count-card">
                <span className="calendar-count-name">
                  <span className="calendar-dot calendar-dot--strength" aria-hidden="true" />
                  Fuerza
                </span>
                <strong className="numeric">{counts.strength}</strong>
                <span className="calendar-count-unit">
                  {counts.strength === 1 ? 'día' : 'días'}
                </span>
              </div>
              <div className="calendar-count-card">
                <span className="calendar-count-name">
                  <span className="calendar-dot calendar-dot--cardio" aria-hidden="true" />
                  Cardio
                </span>
                <strong className="numeric">{counts.cardio}</strong>
                <span className="calendar-count-unit">
                  {counts.cardio === 1 ? 'día' : 'días'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
