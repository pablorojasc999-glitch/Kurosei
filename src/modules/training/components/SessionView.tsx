import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/db/database'
import {
  addSessionExercise,
  createExecutedSet,
  deleteExecutedSet,
  deleteSession,
  deleteSessionExercise,
  endSession,
  reopenSession,
  setSessionExerciseClosed,
  startSession,
  updateExecutedSet,
} from '../db/executionRepository'
import {
  listPlannedDaysWithExercises,
  listPlannedExercises,
} from '../db/planningRepository'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import { DeloadAlert } from './DeloadAlert'
import { RepHistory } from './RepHistory'
import { RestTimer } from './RestTimer'
import { SessionSummary } from './SessionSummary'
import { formatDate, formatRestMinutes } from '../lib/format'
import type { ExecutedSet, SessionExercise } from '../domain/types'

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
  const plannedDayOptions = useLiveQuery(
    () => listPlannedDaysWithExercises(),
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

  const [showAddExerciseForm, setShowAddExerciseForm] = useState(false)
  const [newExerciseId, setNewExerciseId] = useState('')
  const [setForms, setSetForms] = useState<Record<string, SetFormState>>({})
  const [restTargets, setRestTargets] = useState<Record<string, number>>({})
  const [pickedSourceDayId, setPickedSourceDayId] = useState('')
  const [historyReps, setHistoryReps] = useState<Record<string, string>>({})
  const [confirmingReopen, setConfirmingReopen] = useState(false)
  const [editingSetId, setEditingSetId] = useState<Record<string, string | null>>({})

  const otherPlannedDays = (plannedDayOptions ?? []).filter(
    (d) => d.id !== dayId,
  )

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
    setShowAddExerciseForm(false)
  }

  const missingPlannedExercises = (plannedExercises ?? []).filter(
    (pe) => !sessionExercises?.some((se) => se.exerciseId === pe.exerciseId),
  )

  async function handleLoadPlan() {
    if (!session) return
    for (const pe of missingPlannedExercises) {
      await addSessionExercise({
        sessionId: session.id,
        exerciseId: pe.exerciseId,
        notes: pe.notes,
      })
    }
  }

  async function handleStartSession() {
    const newSession = await startSession(dayId)
    for (const pe of plannedExercises ?? []) {
      await addSessionExercise({
        sessionId: newSession.id,
        exerciseId: pe.exerciseId,
        notes: pe.notes,
      })
    }
  }

  async function handleStartSessionFromPickedDay() {
    if (!pickedSourceDayId) return
    const newSession = await startSession(dayId)
    const sourceExercises = await listPlannedExercises(pickedSourceDayId)
    for (const pe of sourceExercises) {
      await addSessionExercise({
        sessionId: newSession.id,
        exerciseId: pe.exerciseId,
        notes: pe.notes,
      })
    }
    setPickedSourceDayId('')
  }

  async function handleLoadPlanFromPickedDay() {
    if (!session || !pickedSourceDayId) return
    const sourceExercises = await listPlannedExercises(pickedSourceDayId)
    const missing = sourceExercises.filter(
      (pe) => !sessionExercises?.some((se) => se.exerciseId === pe.exerciseId),
    )
    for (const pe of missing) {
      await addSessionExercise({
        sessionId: session.id,
        exerciseId: pe.exerciseId,
        notes: pe.notes,
      })
    }
    setPickedSourceDayId('')
  }

  async function handleSubmitSet(sessionExerciseId: string) {
    const form = setForms[sessionExerciseId] ?? EMPTY_SET_FORM
    if (!form.reps) return
    const input = {
      weightKg: form.weight ? Number(form.weight) : null,
      reps: Number(form.reps),
      rpe: form.rpe ? Number(form.rpe) : null,
      eva: form.eva ? Number(form.eva) : null,
      notes: form.notes,
    }
    const editingId = editingSetId[sessionExerciseId]
    if (editingId) {
      await updateExecutedSet(editingId, input)
    } else {
      await createExecutedSet({ sessionExerciseId, ...input })
    }
    setSetForms((prev) => ({ ...prev, [sessionExerciseId]: EMPTY_SET_FORM }))
    setEditingSetId((prev) => ({ ...prev, [sessionExerciseId]: null }))
  }

  function startEditExecutedSet(sessionExerciseId: string, s: ExecutedSet) {
    setSetForms((prev) => ({
      ...prev,
      [sessionExerciseId]: {
        weight: s.weightKg !== null ? String(s.weightKg) : '',
        reps: String(s.reps),
        rpe: s.rpe !== null ? String(s.rpe) : '',
        eva: s.eva !== null ? String(s.eva) : '',
        notes: s.notes,
      },
    }))
    setEditingSetId((prev) => ({ ...prev, [sessionExerciseId]: s.id }))
  }

  function cancelEditExecutedSet(sessionExerciseId: string) {
    setSetForms((prev) => ({ ...prev, [sessionExerciseId]: EMPTY_SET_FORM }))
    setEditingSetId((prev) => ({ ...prev, [sessionExerciseId]: null }))
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
        <button type="button" onClick={handleStartSession}>
          {plannedExercises?.length
            ? 'Iniciar sesión y cargar plan'
            : 'Iniciar sesión'}
        </button>

        {otherPlannedDays.length > 0 && (
          <div className="load-plan-picker">
            <label>
              O cargar un día ya planificado
              <select
                value={pickedSourceDayId}
                onChange={(e) => setPickedSourceDayId(e.target.value)}
              >
                <option value="">Elegir día planificado</option>
                {otherPlannedDays.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label || 'Sin etiqueta'} — {formatDate(d.date)} (
                    {d.exerciseCount} ejercicio{d.exerciseCount === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!pickedSourceDayId}
              onClick={handleStartSessionFromPickedDay}
            >
              Iniciar sesión con ese plan
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="session-header">
        <span className="session-duration numeric">{formatDuration(elapsed)}</span>
        <div className="session-header-actions">
          {session.endedAt ? (
            <button type="button" onClick={() => setConfirmingReopen(true)}>
              Reabrir sesión
            </button>
          ) : (
            <button type="button" onClick={() => endSession(session.id)}>
              Finalizar sesión
            </button>
          )}
          <ConfirmDeleteButton
            label="Eliminar sesión"
            confirmMessage="¿Eliminar toda la sesión de hoy?"
            onConfirm={() => deleteSession(session.id)}
          />
        </div>
      </div>

      {confirmingReopen && (
        <div className="confirm-inline">
          <span>¿Reabrir la sesión ya finalizada?</span>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              reopenSession(session.id)
              setConfirmingReopen(false)
            }}
          >
            Sí, reabrir
          </button>
          <button type="button" onClick={() => setConfirmingReopen(false)}>
            Cancelar
          </button>
        </div>
      )}

      <SessionSummary sessionId={session.id} />

      {!session.endedAt && missingPlannedExercises.length > 0 && (
        <button type="button" className="load-plan-button" onClick={handleLoadPlan}>
          Cargar {missingPlannedExercises.length} ejercicio
          {missingPlannedExercises.length === 1 ? '' : 's'} del plan
        </button>
      )}

      {!session.endedAt && otherPlannedDays.length > 0 && (
        <div className="load-plan-picker">
          <label>
            Cargar ejercicios de otro día planificado
            <select
              value={pickedSourceDayId}
              onChange={(e) => setPickedSourceDayId(e.target.value)}
            >
              <option value="">Elegir día planificado</option>
              {otherPlannedDays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label || 'Sin etiqueta'} — {formatDate(d.date)} (
                  {d.exerciseCount} ejercicio{d.exerciseCount === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!pickedSourceDayId}
            onClick={handleLoadPlanFromPickedDay}
          >
            Cargar ejercicios
          </button>
        </div>
      )}

      <ul className="planned-exercise-list">
        {sessionExercises?.map((se) => {
          const sets = (
            executedSets?.filter((s) => s.sessionExerciseId === se.id) ?? []
          ).sort((a, b) => a.setNumber - b.setNumber)
          const form = setForms[se.id] ?? EMPTY_SET_FORM
          const nextSetNumber = sets.length + 1
          const lastSet = sets.at(-1)
          const target = restTargetFor(se.exerciseId, se.id, nextSetNumber)
          const plannedExercise = plannedExercises?.find(
            (pe) => pe.exerciseId === se.exerciseId,
          )
          const targetSets = plannedExercise
            ? plannedSets
                ?.filter((ps) => ps.plannedExerciseId === plannedExercise.id)
                .sort((a, b) => a.setNumber - b.setNumber)
            : undefined
          const historyRepsValue =
            historyReps[se.id] ??
            (targetSets?.[0] ? String(targetSets[0].targetReps) : lastSet ? String(lastSet.reps) : '')
          const matchingPlannedSet = targetSets?.find(
            (ps) => ps.setNumber === nextSetNumber,
          )
          const exerciseClosed = se.closedAt !== null
          const locked = Boolean(session.endedAt) || exerciseClosed
          const editingId = editingSetId[se.id]

          return (
            <li key={se.id} className="planned-exercise-item">
              <div className="planned-exercise-header">
                <strong>{exerciseName(se.exerciseId)}</strong>
                {!session.endedAt && (
                  <button
                    type="button"
                    onClick={() => setSessionExerciseClosed(se.id, !exerciseClosed)}
                  >
                    {exerciseClosed ? 'Reabrir ejercicio' : 'Cerrar ejercicio'}
                  </button>
                )}
                {!session.endedAt && (
                  <ConfirmDeleteButton
                    label="Quitar"
                    confirmMessage="¿Quitar este ejercicio de la sesión?"
                    onConfirm={() => deleteSessionExercise(se.id)}
                  />
                )}
              </div>

              {targetSets && targetSets.length > 0 && (
                <ul className="plan-target-list">
                  <li className="plan-target-title">Objetivo</li>
                  {targetSets.map((ps) => (
                    <li key={ps.id} className="plan-target-row">
                      <span className="set-number">{ps.setNumber}</span>
                      <span>
                        {ps.targetWeightKg ?? '-'} kg × {ps.targetReps}
                        {ps.targetRpe !== null && ` · RPE ${ps.targetRpe}`}
                        {ps.restSecondsTarget !== null &&
                          ` · ${formatRestMinutes(ps.restSecondsTarget)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <DeloadAlert exerciseId={se.exerciseId} />

              {!locked && (
                <>
                  <div className="rep-history-picker">
                    <label>
                      Ver historial a
                      <input
                        type="number"
                        inputMode="numeric"
                        value={historyRepsValue}
                        onChange={(e) =>
                          setHistoryReps((prev) => ({
                            ...prev,
                            [se.id]: e.target.value,
                          }))
                        }
                      />
                      reps
                    </label>
                  </div>
                  {historyRepsValue && (
                    <RepHistory
                      exerciseId={se.exerciseId}
                      reps={Number(historyRepsValue)}
                    />
                  )}
                </>
              )}

              {sets.length === 0 ? (
                <p className="empty-hint">Sin series registradas.</p>
              ) : (
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
                      {!locked && (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Editar serie"
                            onClick={() => startEditExecutedSet(se.id, s)}
                          >
                            ✎
                          </button>
                          <ConfirmDeleteButton
                            variant="icon"
                            label="Eliminar serie"
                            confirmMessage="¿Eliminar esta serie?"
                            onConfirm={() => deleteExecutedSet(s.id)}
                          />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {lastSet && !locked && (
                <RestTimer
                  key={lastSet.id}
                  targetSeconds={target}
                  onTargetSecondsChange={(seconds) =>
                    setRestTargets((prev) => ({ ...prev, [se.id]: seconds }))
                  }
                />
              )}

              {!locked && (
                <>
                  <div className="set-form set-form--execution">
                  <label>
                    Peso
                    <span className="planned-hint">
                      {matchingPlannedSet?.targetWeightKg != null
                        ? `plan: ${matchingPlannedSet.targetWeightKg}`
                        : ' '}
                    </span>
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
                    <span className="planned-hint">
                      {matchingPlannedSet
                        ? `plan: ${matchingPlannedSet.targetReps}`
                        : ' '}
                    </span>
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
                    @
                    <span className="planned-hint">
                      {matchingPlannedSet?.targetRpe != null
                        ? `plan: ${matchingPlannedSet.targetRpe}`
                        : ' '}
                    </span>
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
                    EVA
                    <span className="planned-hint">{' '}</span>
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
                    onClick={() => handleSubmitSet(se.id)}
                  >
                    {editingId ? 'Guardar cambios' : `+ Registrar serie ${nextSetNumber}`}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="set-form-cancel"
                      onClick={() => cancelEditExecutedSet(se.id)}
                    >
                      Cancelar
                    </button>
                  )}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {!session.endedAt && (
        showAddExerciseForm ? (
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
            <button type="button" onClick={() => setShowAddExerciseForm(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setShowAddExerciseForm(true)}>
            + Agregar ejercicio a la sesión
          </button>
        )
      )}
    </div>
  )
}
