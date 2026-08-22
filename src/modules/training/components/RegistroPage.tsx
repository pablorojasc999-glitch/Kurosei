import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { findDayByDate, getOrCreateDayForDate } from '../db/planningRepository'
import { addDays, startOfDay } from '../lib/calendarGrid'
import { CardioView } from './CardioView'
import { SessionView } from './SessionView'

const SWIPE_THRESHOLD_PX = 50

function formatDayHeader(date: Date): string {
  const todayKey = startOfDay(new Date()).getTime()
  const dateKey = startOfDay(date).getTime()
  const diffDays = Math.round((dateKey - todayKey) / (24 * 60 * 60 * 1000))

  const rawDateLabel = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const dateLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1)

  if (diffDays === 0) return `Hoy · ${dateLabel}`
  if (diffDays === -1) return `Ayer · ${dateLabel}`
  if (diffDays === 1) return `Mañana · ${dateLabel}`
  return dateLabel
}

interface RegistroPageProps {
  jumpToDate?: Date | null
  onEditPlan: (dayId: string) => void
}

export function RegistroPage({ jumpToDate, onEditPlan }: RegistroPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [appliedJumpToDate, setAppliedJumpToDate] = useState(jumpToDate)
  const touchStartX = useRef<number | null>(null)

  if (jumpToDate !== appliedJumpToDate) {
    setAppliedJumpToDate(jumpToDate)
    if (jumpToDate) setSelectedDate(startOfDay(jumpToDate))
  }

  const day = useLiveQuery(() => findDayByDate(selectedDate), [selectedDate])

  function goToPreviousDay() {
    setSelectedDate((d) => addDays(d, -1))
  }
  function goToNextDay() {
    setSelectedDate((d) => addDays(d, 1))
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (delta > SWIPE_THRESHOLD_PX) goToPreviousDay()
    else if (delta < -SWIPE_THRESHOLD_PX) goToNextDay()
  }

  async function handleCreateDay() {
    await getOrCreateDayForDate(selectedDate)
  }

  return (
    <div
      className="page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <h1>Registro</h1>

      <div className="day-nav">
        <button type="button" onClick={goToPreviousDay} aria-label="Día anterior">
          ‹
        </button>
        <span className="day-nav-label">{formatDayHeader(selectedDate)}</span>
        <button type="button" onClick={goToNextDay} aria-label="Día siguiente">
          ›
        </button>
      </div>

      {day === undefined ? null : day === null ? (
        <div>
          <p className="empty-hint">Nada registrado este día todavía.</p>
          <button type="button" onClick={handleCreateDay}>
            Registrar entrenamiento
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="edit-plan-link"
            onClick={() => onEditPlan(day.id)}
          >
            Editar plan del día
          </button>

          <section>
            <h2>Fuerza</h2>
            <SessionView dayId={day.id} />
          </section>

          <section>
            <h2>Cardio</h2>
            <CardioView dayId={day.id} />
          </section>
        </>
      )}
    </div>
  )
}
