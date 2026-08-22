import { useLiveQuery } from 'dexie-react-hooks'
import { findTodayOrNearestDay } from '../db/planningRepository'
import { formatDate } from '../lib/format'
import { SessionView } from './SessionView'

interface TodayPageProps {
  onEditPlan: (dayId: string) => void
}

export function TodayPage({ onEditPlan }: TodayPageProps) {
  const day = useLiveQuery(() => findTodayOrNearestDay(), [])

  if (day === undefined) return null

  if (!day) {
    return (
      <div className="page">
        <h1>Hoy</h1>
        <p className="empty-hint">
          Todavía no planificaste ningún día. Andá a Periodización para crear
          tu primer macrociclo y armar un día de entrenamiento.
        </p>
      </div>
    )
  }

  const todayKey = new Date().toDateString()
  const isToday = new Date(day.date).toDateString() === todayKey

  return (
    <div className="page">
      <h1>Hoy</h1>
      <div className="today-header">
        <div>
          <p className="today-date">
            {isToday ? 'Hoy' : formatDate(day.date)}
            {day.label && ` · ${day.label}`}
          </p>
          {!isToday && (
            <p className="today-hint">No hay un día planificado para hoy — te mostramos el más cercano.</p>
          )}
        </div>
        <button type="button" onClick={() => onEditPlan(day.id)}>
          Editar plan
        </button>
      </div>

      <SessionView dayId={day.id} />
    </div>
  )
}
