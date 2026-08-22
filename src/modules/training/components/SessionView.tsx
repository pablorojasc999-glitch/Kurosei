import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/db/database'
import {
  addSessionExercise,
  createExecutedSet,
  deleteExecutedSet,
  deleteSessionExercise,
  endSession,
  reopenSession,
  startSession,
} from '../db/executionRepository'
import { DeloadAlert } from './DeloadAlert'
import { RepHistory } from './RepHistory'
import { RestTimer } from './RestTimer'
import { SessionSummary } from './SessionSummary'
import type { SessionExercise } from '../domain/types'

const DEFAULT_REST_SECONDS = 120

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':')
}

interface SetFormState {
  weight: string
  reps: string
  rpe: string
  eva: string
  notes: string
}

const EMPTY_SET_FORM: SetFormState = {
  weight: '',
  reps: '',
  rpe: '',
  eva: '',
  notes: '',
}

interface SessionViewProps {
  dayId: string
}

export function SessionView({ dayId }: SessionViewProps) {
  const session = useLiveQuery(
    () =>
      db.training_sessions
        .where('dayId')
        .equals(dayId)
        .filter((s) => s.deletedAt === null)
        .first(),
    [dayId],
  )

  const sessionExercises = useLiveQuery(
    () =>
      session
        ? db.training_session_exercises
            .where('sessionId')
            .equals(session.id)
            .filter((se) => se.deletedAt === null)
            .sortBy('order')
        : Promise.resolve<SessionExercise[]>([]),
    [session?.id],
  )

  const executedSets = useLiveQuery(
    () => db.training_executed_sets.filter((s) => s.deletedAt === null).toArray(),
    [],
  )

  const plannedExercises = useLiveQuery(
    () =>
      db.training_planned_exercises
        .where('dayId')
        .equals(dayId)
        .filter((pe) => pe.deletedAt === null)
        .toArray(),
    [dayId],
  )
  const plannedSets = useLiveQuery(
    () => db.training_planned_sets.filter((s) => s.deletedAt === null).toArray(),
    [],
  )
  const exercisesLibrary = useLiveQuery(
    () => db.training_exercises.filter((e) => e.deletedAt === null).sortBy('name'),
    [],
  )

  const [runningElapsed, setRunningElapsed] = useState(0)
  useEffect(() => {
    if (!session || session.endedAt) return
    const startedAtMs = new Date(session.startedAt).getTime()
    const tick = () =>
      setRunningElapsed(Math.floor((Date.now() - startedAtMs) / 1000))
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [session])

  const elapsed = session?.endedAt
    ? Math.floor(
        (new Date(session.endedAt).getTime() -
          new Date(session.startedAt).getTime()) /
          1000,
      )
    : runningElapsed

  const [newExerciseId, setNewExerciseId] = useState('')
  const [setForms, setSetForms] = useState<Record<string, SetFormState>>({})
  const [restTargets, setRestTargets] = useState<Record<string, number>>({})

  function exerciseName(id: string): string {
    return exercisesLibrary?.find((e) => e.id === id)?.name ?? '?'
  }

  async function handleAddExercise(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !newExerciseId) return
    await addSessionExercise({
      sessionId: session.id,
      exerciseId: newExerciseId,
      notes: '',
    })
    setNewExerciseId('')
  }

  async function handleAddSet(sessionExerciseId: string) {
    const form = setForms[sessionExerciseId] ?? EMPTY_SET_FORM
    if (!form.reps) return
    await createExecutedSet({
      sessionExerciseId,
      weightKg: form.weight ? Number(form.weight) : null,
      reps: Number(form.reps),
      rpe: form.rpe ? Number(form.rpe) : null,
      eva: form.eva ? Number(form.eva) : null,
      notes: form.notes,
    })
    setSetForms((prev) => ({ ...prev, [sessionExerciseId]: EMPTY_SET_FORM }))
  }

  function restTargetFor(
    exerciseId: string,
    sessionExerciseId: string,
    nextSetNumber: number,
  ): number {
    const plannedExercise = plannedExercises?.find(
      (pe) => pe.exerciseId === exerciseId,
    )
    const matchingPlannedSet =
      plannedExercise &&
      plannedSets?.find(
        (ps) =>
          ps.plannedExerciseId === plannedExercise.id &&
          ps.setNumber === nextSetNumber,
      )
    if (matchingPlannedSet?.restSecondsTarget) {
      return matchingPlannedSet.restSecondsTarget
    }
    return restTargets[sessionExerciseId] ?? DEFAULT_REST_SECONDS
  }

  if (!session) {
    return (
      <div>
        <p className="empty-hint">Todavía no iniciaste la sesión de este día.</p>
        <button type="button" onClick={() => startSession(dayId)}>
          Iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="session-header">
        <span className="session-duration">{formatDuration(elapsed)}</span>
        {session.endedAt ? (
          <button type="button" onClick={() => reopenSession(session.id)}>
            Reabrir sesión
          </button>
        ) : (
          <button type="button" onClick={() => endSession(session.id)}>
            Finalizar sesión
          </button>
        )}
      </div>

      <SessionSummary sessionId={session.id} />

      <ul className="planned-exercise-list">
        {sessionExercises?.map((se) => {
          const sets =
            executedSets?.filter((s) => s.sessionExerciseId === se.id) ?? []
          const form = setForms[se.id] ?? EMPTY_SET_FORM
          const nextSetNumber = sets.length + 1
          const lastSet = sets.at(-1)
          const target = restTargetFor(se.exerciseId, se.id, nextSetNumber)

          return (
            <li key={se.id} className="planned-exercise-item">
              <div className="planned-exercise-header">
                <strong>{exerciseName(se.exerciseId)}</strong>
                <button type="button" onClick={() => deleteSessionExercise(se.id)}>
                  Quitar
                </button>
              </div>

              <DeloadAlert exerciseId={se.exerciseId} />

              <ul className="sets-list">
                {sets.map((s) => (
                  <li key={s.id} className="set-row">
                    <span className="set-number">{s.setNumber}</span>
                    <span className="set-summary">
                      {s.weightKg ?? '-'} kg × {s.reps}
                      {s.rpe !== null && ` · RPE ${s.rpe}`}
                      {s.eva !== null && ` · EVA ${s.eva}`}
                      {s.notes && ` · ${s.notes}`}
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => deleteExecutedSet(s.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              {lastSet && !session.endedAt && (
                <RestTimer
                  key={lastSet.id}
                  targetSeconds={target}
                  onTargetSecondsChange={(seconds) =>
                    setRestTargets((prev) => ({ ...prev, [se.id]: seconds }))
                  }
                />
              )}

              {!session.endedAt && (
                <>
                  {form.reps && (
                    <RepHistory exerciseId={se.exerciseId} reps={Number(form.reps)} />
                  )}

                  <div className="set-form set-form--execution">
                  <label>
                    Peso (kg)
                    <input
                      type="number"
                      inputMode="decimal"
                      value={form.weight}
                      onChange={(e) =>
                        setSetForms((prev) => ({
                          ...prev,
                          [se.id]: { ...form, weight: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Reps
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.reps}
                      onChange={(e) =>
                        setSetForms((prev) => ({
                          ...prev,
                          [se.id]: { ...form, reps: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    RPE
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={form.rpe}
                      onChange={(e) =>
                        setSetForms((prev) => ({
                          ...prev,
                          [se.id]: { ...form, rpe: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    EVA (0-10)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={10}
                      value={form.eva}
                      onChange={(e) =>
                        setSetForms((prev) => ({
                          ...prev,
                          [se.id]: { ...form, eva: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="set-form-notes">
                    Notas
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) =>
                        setSetForms((prev) => ({
                          ...prev,
                          [se.id]: { ...form, notes: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="add-set-button"
                    onClick={() => handleAddSet(se.id)}
                  >
                    + Registrar serie {nextSetNumber}
                  </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {!session.endedAt && (
        <form onSubmit={handleAddExercise} className="entity-form">
          <select
            value={newExerciseId}
            onChange={(e) => setNewExerciseId(e.target.value)}
            required
          >
            <option value="">Elegir ejercicio</option>
            {exercisesLibrary?.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          <button type="submit">Agregar ejercicio a la sesión</button>
        </form>
      )}
    </div>
  )
}
