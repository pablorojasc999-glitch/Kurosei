import { useCallback, useState } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { useSupabaseSession } from '../../../shared/hooks/useSupabaseSession'
import { listCardioSessions } from '../db/cardioRepository'
import { getSessionForDay } from '../db/executionRepository'
import {
  findDayByDate,
  getOrCreateDayForDate,
  listPlannedExercises,
} from '../db/planningRepository'
import { addDays, formatDayHeader, startOfDay, toDateKey } from '../lib/calendarGrid'
import { DayCloseCard } from '../../closing/components/DayCloseCard'
import { BitacoraSection } from './BitacoraSection'
import { CardioView } from './CardioView'
import { DayHeaderLabel } from './DayHeaderLabel'
import { SessionView } from './SessionView'

interface RegistroPageProps {
  jumpToDate?: Date | null
  onEditPlan: (dayId: string) => void
}

export function RegistroPage({ jumpToDate, onEditPlan }: RegistroPageProps) {
  const session = useSupabaseSession()
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [appliedJumpToDate, setAppliedJumpToDate] = useState(jumpToDate)
  const [forceShowContent, setForceShowContent] = useState(false)
  const [appliedForceShowDate, setAppliedForceShowDate] = useState(selectedDate)

  if (jumpToDate !== appliedJumpToDate) {
    setAppliedJumpToDate(jumpToDate)
    if (jumpToDate) setSelectedDate(startOfDay(jumpToDate))
  }
  if (selectedDate !== appliedForceShowDate) {
    setAppliedForceShowDate(selectedDate)
    setForceShowContent(false)
  }

  const { data: day, refresh: refreshDay } = useRemoteQuery(
    useCallback(async () => {
      if (session === undefined) return undefined
      return session ? findDayByDate(selectedDate) : null
    }, [session, selectedDate]),
  )
  const { data: dayHasContent } = useRemoteQuery(
    useCallback(async () => {
      if (!day) return false
      const [plannedExercises, trainingSession, cardioSessions] = await Promise.all([
        listPlannedExercises(day.id),
        getSessionForDay(day.id),
        listCardioSessions(day.id),
      ])
      return plannedExercises.length > 0 || trainingSession !== undefined || cardioSessions.length > 0
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [day?.id]),
  )

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

  async function handleCreateDay() {
    await getOrCreateDayForDate(selectedDate)
    await refreshDay()
    setForceShowContent(true)
  }

  // Ya no hay copia local: sin sesión no hay registro que mostrar.
  if (session === undefined) {
    return (
      <div className="page">
        <h1>Registro</h1>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="page">
        <h1>Registro</h1>
        <p className="empty-hint">
          Iniciá sesión (el ícono de arriba a la derecha) para ver y editar tu registro.
        </p>
      </div>
    )
  }

  return (
    <div className="page">
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

      {/* Al final del día, no arriba: cerrar es lo último que se hace, y con
          el botón arriba se cerraba antes de terminar de anotar. */}
      <DayCloseCard
        date={toDateKey(selectedDate)}
        module="training"
        prompt="¿Listo con el entrenamiento de este día?"
      />
    </div>
  )
}
