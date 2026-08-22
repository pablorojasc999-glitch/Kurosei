import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import { createCardioSession, deleteCardioSession } from '../db/cardioRepository'

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

interface CardioViewProps {
  dayId: string
}

export function CardioView({ dayId }: CardioViewProps) {
  const cardioSessions = useLiveQuery(
    () =>
      db.training_cardio_sessions
        .where('dayId')
        .equals(dayId)
        .filter((s) => s.deletedAt === null)
        .sortBy('startedAt'),
    [dayId],
  )
  const cardioExercises = useLiveQuery(
    () =>
      db.training_exercises
        .filter((e) => e.deletedAt === null && e.type === 'cardio')
        .sortBy('name'),
    [],
  )

  const [exerciseId, setExerciseId] = useState('')
  const [startedAt, setStartedAt] = useState(() =>
    toDatetimeLocalValue(new Date()),
  )
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [rpe, setRpe] = useState('')
  const [eva, setEva] = useState('')
  const [notes, setNotes] = useState('')

  function exerciseName(id: string): string {
    return cardioExercises?.find((e) => e.id === id)?.name ?? '?'
  }

  async function handleAddCardioSession(e: React.FormEvent) {
    e.preventDefault()
    if (!exerciseId || !startedAt || !duration) return
    await createCardioSession({
      dayId,
      exerciseId,
      startedAt: new Date(startedAt).toISOString(),
      durationMinutes: Number(duration),
      distanceKm: distance ? Number(distance) : null,
      rpe: rpe ? Number(rpe) : null,
      eva: eva ? Number(eva) : null,
      notes,
    })
    setExerciseId('')
    setStartedAt(toDatetimeLocalValue(new Date()))
    setDuration('')
    setDistance('')
    setRpe('')
    setEva('')
    setNotes('')
  }

  if (!cardioExercises?.length) {
    return (
      <p className="empty-hint">
        Todavía no cargaste ejercicios de cardio en tu biblioteca — agregá uno
        con tipo "Cardio" para poder registrar sesiones.
      </p>
    )
  }

  return (
    <div>
      <ul className="entity-list">
        {cardioSessions?.map((s) => (
          <li key={s.id} className="cardio-item">
            <div>
              <strong>{exerciseName(s.exerciseId)}</strong>
              <div className="cardio-summary">
                {formatTime(s.startedAt)} · {s.durationMinutes} min
                {s.distanceKm !== null && ` · ${s.distanceKm} km`}
                {s.rpe !== null && ` · RPE ${s.rpe}`}
                {s.eva !== null && ` · EVA ${s.eva}`}
                {s.notes && ` · ${s.notes}`}
              </div>
            </div>
            <button
              type="button"
              className="btn-danger"
              onClick={() => deleteCardioSession(s.id)}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAddCardioSession} className="entity-form">
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          required
        >
          <option value="">Elegir ejercicio de cardio</option>
          {cardioExercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
        <label>
          Hora de inicio
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            required
          />
        </label>
        <label>
          Duración (min)
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
          />
        </label>
        <label>
          Distancia (km, opcional)
          <input
            type="number"
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </label>
        <label>
          RPE (opcional)
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
          />
        </label>
        <label>
          EVA (0-10, opcional)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={eva}
            onChange={(e) => setEva(e.target.value)}
          />
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (opcional)"
        />
        <button type="submit">Agregar cardio</button>
      </form>
    </div>
  )
}
