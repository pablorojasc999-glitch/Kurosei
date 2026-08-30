import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { listCardioSessions } from '../db/cardioRepository'
import { getSessionForDay } from '../db/executionRepository'
import {
  findDayByDate,
  getOrCreateDayForDate,
  listPlannedExercises,
} from '../db/planningRepository'
import { addDays, formatDayHeader, startOfDay } from '../lib/calendarGrid'
import { BitacoraSection } from './BitacoraSection'
import { CardioView } from './CardioView'
import { DayHeaderLabel } from './DayHeaderLabel'
import { SessionView } from './SessionView'

const SWIPE_THRESHOLD_PX = 50

interface RegistroPageProps {
  jumpToDate?: Date | null
  onEditPlan: (dayId: string) => void
}

export function RegistroPage({ jumpToDate, onEditPlan }: RegistroPageProps) {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [appliedJumpToDate, setAppliedJumpToDate] = useState(jumpToDate)
  const [forceShowContent, setForceShowContent] = useState(false)
  const [appliedForceShowDate, setAppliedForceShowDate] = useState(selectedDate)
  const touchStartX = useRef<number | null>(null)

  if (jumpToDate !== appliedJumpToDate) {
    setAppliedJumpToDate(jumpToDate)
    if (jumpToDate) setSelectedDate(startOfDay(jumpToDate))
  }
  if (selectedDate !== appliedForceShowDate) {
    setAppliedForceShowDate(selectedDate)
    setForceShowContent(false)
  }

  const day = useLiveQuery(() => findDayByDate(selectedDate), [selectedDate])
  const dayHasContent = useLiveQuery(async () => {
    if (!day) return false
    const [plannedExercises, session, cardioSessions] = await Promise.all([
      listPlannedExercises(day.id),
      getSessionForDay(day.id),
      listCardioSessions(day.id),
    ])
    return plannedExercises.length > 0 || session !== undefined || cardioSessions.length > 0
  }, [day?.id])

  const [appliedDayHasContent, setAppliedDayHasContent] = useState(dayHasContent)
  if (dayHasContent !== appliedDayHasContent) {
    // Content that justified staying revealed just got deleted down to
    // nothing (e.g. "Eliminar sesión") — collapse back to the blank state,
    // same as a day that was never touched.
    if (appliedDayHasContent === true && dayHasContent === false) {
      setForceShowContent(false)
    }
    setAppliedDayHasContent(dayHasContent)
  }

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
    setForceShowContent(true)
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
        <span className="day-nav-label" aria-label={formatDayHeader(selectedDate)}>
          <DayHeaderLabel date={selectedDate} />
        </span>
        <button type="button" onClick={goToNextDay} aria-label="Día siguiente">
          ›
        </button>
      </div>

      <BitacoraSection date={selectedDate} />

      {day === undefined || dayHasContent === undefined ? null : day ===
          null || (!dayHasContent && !forceShowContent) ? (
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
