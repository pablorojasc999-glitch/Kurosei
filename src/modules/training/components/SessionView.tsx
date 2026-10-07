import { useCallback, useState } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  addSessionExercise,
  createExecutedSet,
  deleteExecutedSet,
  deleteSession,
  deleteSessionExercise,
  endSession,
  updateSessionTimes,
  getSessionForDay,
  listExecutedSetsForSessionExercises,
  listSessionExercises,
  reopenSession,
  reorderSessionExercise,
  setSessionExerciseClosed,
  startSession,
  updateExecutedSet,
} from '../db/executionRepository'
import {
  copyPlannedExercisesToDay,
  listPlannedSetsForExercises,
  listPlannedDaysWithExercises,
  listPlannedExercises,
} from '../db/planningRepository'
import { listExercises } from '../db/trainingRepository'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import { DeloadAlert } from './DeloadAlert'
import { RepHistory } from './RepHistory'
import { RestTimer } from './RestTimer'
import { SessionSummary } from './SessionSummary'
import { parseReps } from '../lib/reps'
import { calculateE1rm } from '../lib/e1rm'
import { formatDate, formatRestMinutes } from '../lib/format'
import { parsePersistedRest, restStorageKey, type RestTimerState } from '../lib/restTimer'
import {
  endIsoFromTime,
  formatSessionDuration,
  sessionDurationMinutes,
  toTimeInput,
  withTimeOfDay,
} from '../lib/sessionTimes'
import type { ExecutedSet, PlannedSet } from '../domain/types'

const DEFAULT_REST_SECONDS = 120

interface ActiveRest {
  sessionExerciseId: string
  nonce: number
  /** Sólo se usa en el primer render del cronómetro — ver `RestTimer`. */
  initialState?: RestTimerState
}

/** Lo que haya quedado corriendo de antes de refrescar la página, si hay algo. */
function loadPersistedRest(dayId: string): ActiveRest | null {
  try {
    const raw = localStorage.getItem(restStorageKey(dayId))
    if (!raw) return null
    const persisted = parsePersistedRest(raw)
    if (!persisted) return null
    return { sessionExerciseId: persisted.sessionExerciseId, nonce: 0, initialState: persisted.state }
  } catch {
    return null
  }
}

/** e1RM suffix for a logged set's summary line — omitted when there's no weight to estimate from. */
function e1rmSuffix(set: Pick<ExecutedSet, 'weightKg' | 'reps' | 'rpe'>): string {
  if (set.weightKg === null || set.weightKg <= 0) return ''
  const e1rm = calculateE1rm({
    weightKg: set.weightKg,
    reps: set.reps,
    rpe: set.rpe ?? undefined,
  })
  return ` · e1RM ${Math.round(e1rm)}`
}

/** Las series planificadas de un ejercicio, en orden — se reutiliza antes de iniciar la sesión y durante ella. */
function PlanTargetList({ sets }: { sets: PlannedSet[] }) {
  if (sets.length === 0) return null
  return (
    <ul className="plan-target-list">
      <li className="plan-target-title">Objetivo</li>
      {sets.map((ps) => (
        <li key={ps.id} className="plan-target-row">
          <span className="set-number">{ps.setNumber}</span>
          <span>
            {ps.targetWeightKg ?? '-'} kg × {ps.targetReps}
            {ps.targetRpe !== null && ` · RPE ${ps.targetRpe}`}
            {ps.restSecondsTarget !== null && ` · ${formatRestMinutes(ps.restSecondsTarget)}`}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface SetFormState {
  weight: string
  reps: string
  rpe: string
  eva: string
  notes: string
  dropSet: boolean
  restPause: boolean
}

const EMPTY_SET_FORM: SetFormState = {
  weight: '',
  reps: '',
  rpe: '',
  eva: '',
  notes: '',
  dropSet: false,
  restPause: false,
}

interface SessionViewProps {
  dayId: string
}

export function SessionView({ dayId }: SessionViewProps) {
  // La sesión y sus series ejecutadas cambian con casi cada acción de esta
  // pantalla, así que se refrescan juntas (`refresh`) sin arrastrar al plan ni
  // a la biblioteca de ejercicios, que acá nunca se editan — pedirlos de
  // nuevo en cada serie registrada sería tráfico de sobra.
  const { data: sessionData, refresh, setOptimistic: setSessionData } = useRemoteQuery(
    useCallback(async () => {
      const session = await getSessionForDay(dayId)
      const sessionExercises = session ? await listSessionExercises(session.id) : []
      const executedSets = await listExecutedSetsForSessionExercises(
        sessionExercises.map((se) => se.id),
      )
      return { session, sessionExercises, executedSets }
    }, [dayId]),
  )
  const session = sessionData?.session
  const sessionExercises = sessionData?.sessionExercises
  const executedSets = sessionData?.executedSets

  const { data: plannedExercises } = useRemoteQuery(
    useCallback(() => listPlannedExercises(dayId), [dayId]),
  )
  // Depende de `plannedExercises` (no de `dayId`) para no traer la tabla
  // entera de series planificadas: sólo las de los ejercicios de este día.
  const { data: plannedSets } = useRemoteQuery(
    useCallback(
      () => listPlannedSetsForExercises((plannedExercises ?? []).map((pe) => pe.id)),
      [plannedExercises],
    ),
  )
  const { data: exercisesLibrary } = useRemoteQuery(useCallback(() => listExercises(), []))
  const { data: plannedDayOptions } = useRemoteQuery(
    useCallback(() => listPlannedDaysWithExercises(), []),
  )

  const [showAddExerciseForm, setShowAddExerciseForm] = useState(false)
  const [newExerciseId, setNewExerciseId] = useState('')
  const [setForms, setSetForms] = useState<Record<string, SetFormState>>({})
  // Un solo descanso a la vez, el del ejercicio en el que acabas de anotar.
  // Antes había un cronómetro por ejercicio con series: tres ejercicios, tres
  // relojes corriendo y pitando cada uno por su cuenta. Si quedó uno corriendo
  // de antes de refrescar la página, se retoma (ver `loadPersistedRest`).
  const [rest, setRest] = useState<ActiveRest | null>(() => loadPersistedRest(dayId))
  const [pickedSourceDayId, setPickedSourceDayId] = useState('')
  const [historyReps, setHistoryReps] = useState<Record<string, string>>({})
  const [confirmingReopen, setConfirmingReopen] = useState(false)
  const [editingSetId, setEditingSetId] = useState<Record<string, string | null>>({})

  const { isSubmitting: isAddingExercise, guard: guardAddExercise } = useSubmitGuard()
  const { isSubmitting: isLoadingPlan, guard: guardLoadPlan } = useSubmitGuard()
  const { isSubmitting: isStartingSession, guard: guardStartSession } = useSubmitGuard()
  const { isSubmitting: isSubmittingSet, guard: guardSet } = useSubmitGuard()

  const otherPlannedDays = (plannedDayOptions ?? []).filter(
    (d) => d.id !== dayId,
  )

  function exerciseName(id: string): string {
    return exercisesLibrary?.find((e) => e.id === id)?.name ?? '?'
  }

  async function handleAddExercise(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !newExerciseId) return
    await guardAddExercise(async () => {
      await addSessionExercise({
        sessionId: session.id,
        exerciseId: newExerciseId,
        notes: '',
      })
      await refresh()
      setNewExerciseId('')
      setShowAddExerciseForm(false)
    })
  }

  const missingPlannedExercises = (plannedExercises ?? []).filter(
    (pe) => !sessionExercises?.some((se) => se.exerciseId === pe.exerciseId),
  )

  async function handleLoadPlan() {
    if (!session) return
    await guardLoadPlan(async () => {
      for (const pe of missingPlannedExercises) {
        await addSessionExercise({
          sessionId: session.id,
          exerciseId: pe.exerciseId,
          notes: pe.notes,
        })
      }
      await refresh()
    })
  }

  async function handleStartSession() {
    await guardStartSession(async () => {
      const newSession = await startSession(dayId)
      for (const pe of plannedExercises ?? []) {
        await addSessionExercise({
          sessionId: newSession.id,
          exerciseId: pe.exerciseId,
          notes: pe.notes,
        })
      }
      await refresh()
    })
  }

  async function handleStartSessionFromPickedDay() {
    if (!pickedSourceDayId) return
    await guardStartSession(async () => {
      // Sin esto, el plan de ese otro día no existía para este día: la
      // pantalla sólo sabe mostrar lo planificado (y contra qué comparar
      // cuando se cierra el ejercicio) buscándolo en el plan del propio día.
      await copyPlannedExercisesToDay(pickedSourceDayId, dayId)
      const newSession = await startSession(dayId)
      const sourceExercises = await listPlannedExercises(pickedSourceDayId)
      for (const pe of sourceExercises) {
        await addSessionExercise({
          sessionId: newSession.id,
          exerciseId: pe.exerciseId,
          notes: pe.notes,
        })
      }
      await refresh()
      setPickedSourceDayId('')
    })
  }

  async function handleLoadPlanFromPickedDay() {
    if (!session || !pickedSourceDayId) return
    await guardLoadPlan(async () => {
      // Ver el comentario de `handleStartSessionFromPickedDay`: sin copiarlo,
      // este día no tiene de dónde sacar las series a mostrar para esos
      // ejercicios.
      await copyPlannedExercisesToDay(pickedSourceDayId, dayId)
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
      await refresh()
      setPickedSourceDayId('')
    })
  }

  /**
   * Muestra la serie (nueva o editada) al toque, calculándola igual que la
   * calcularía el servidor, y recién después manda la escritura real — la
   * pantalla no espera esa vuelta para reflejar el cambio. `refresh()` al
   * final reconcilia con lo que quedó guardado de verdad, en el `finally`
   * para que una escritura que falla deshaga lo optimista en vez de dejarlo
   * pisado para siempre.
   */
  async function handleSubmitSet(sessionExerciseId: string) {
    const form = setForms[sessionExerciseId] ?? EMPTY_SET_FORM
    if (!form.reps) return
    await guardSet(async () => {
      const input = {
        weightKg: form.weight ? Number(form.weight) : null,
        reps: parseReps(form.reps),
        rpe: form.rpe ? Number(form.rpe) : null,
        eva: form.eva ? Number(form.eva) : null,
        notes: form.notes,
        dropSet: form.dropSet,
        restPause: form.restPause,
      }
      const editingId = editingSetId[sessionExerciseId]
      setSetForms((prev) => ({ ...prev, [sessionExerciseId]: EMPTY_SET_FORM }))
      setEditingSetId((prev) => ({ ...prev, [sessionExerciseId]: null }))
      if (editingId) {
        const timestamp = nowIso()
        // `current` existe siempre que se llega acá: este handler sólo corre
        // con una sesión ya cargada en pantalla.
        setSessionData((current) => ({
          ...current!,
          executedSets: current!.executedSets.map((s) =>
            s.id === editingId ? { ...s, ...input, updatedAt: timestamp } : s,
          ),
        }))
        try {
          await updateExecutedSet(editingId, input)
        } finally {
          await refresh()
        }
      } else {
        const siblings = (executedSets ?? []).filter(
          (s) => s.sessionExerciseId === sessionExerciseId,
        )
        const nextSetNumber = siblings.length
          ? Math.max(...siblings.map((s) => s.setNumber)) + 1
          : 1
        const previousSet = [...siblings].sort((a, b) => a.setNumber - b.setNumber).at(-1)
        const timestamp = nowIso()
        const restTakenSeconds = previousSet
          ? Math.round(
              (new Date(timestamp).getTime() - new Date(previousSet.performedAt).getTime()) / 1000,
            )
          : null
        const id = generateId()
        const optimisticSet: ExecutedSet = {
          id,
          sessionExerciseId,
          ...input,
          setNumber: nextSetNumber,
          performedAt: timestamp,
          restTakenSeconds,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        }
        setSessionData((current) => ({
          ...current!,
          executedSets: [...current!.executedSets, optimisticSet],
        }))
        // El nonce hace que el cronómetro se monte de nuevo y empiece limpio,
        // ya mismo: esperar a que el servidor confirme la serie sería el
        // mismo segundo de más que esto evita en todo lo demás.
        setRest((prev) => ({ sessionExerciseId, nonce: (prev?.nonce ?? 0) + 1 }))
        try {
          await createExecutedSet({ id, sessionExerciseId, ...input })
        } finally {
          await refresh()
        }
      }
    })
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
        dropSet: s.dropSet === true,
        restPause: s.restPause === true,
      },
    }))
    setEditingSetId((prev) => ({ ...prev, [sessionExerciseId]: s.id }))
  }

  function cancelEditExecutedSet(sessionExerciseId: string) {
    setSetForms((prev) => ({ ...prev, [sessionExerciseId]: EMPTY_SET_FORM }))
    setEditingSetId((prev) => ({ ...prev, [sessionExerciseId]: null }))
  }

  function restTargetFor(exerciseId: string, nextSetNumber: number): number {
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
    return DEFAULT_REST_SECONDS
  }

  if (!session) {
    return (
      <div>
        <p className="empty-hint">Todavía no iniciaste la sesión de este día.</p>
        <button type="button" onClick={handleStartSession} disabled={isStartingSession}>
          {plannedExercises?.length
            ? 'Iniciar sesión y cargar plan'
            : 'Iniciar sesión'}
        </button>

        {otherPlannedDays.length > 0 && (
          <div className="load-plan-picker">
            <label>
              O cargar un día ya planificado
              <select
                autoComplete="off"
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
              disabled={!pickedSourceDayId || isStartingSession}
              onClick={handleStartSessionFromPickedDay}
            >
              Iniciar sesión con ese plan
            </button>
          </div>
        )}

        {/* El plan del día se enseña aunque la sesión no haya arrancado: antes
            había que iniciarla para ver siquiera qué tocaba entrenar. Gris
            porque todavía no es ni "pendiente" (rojo) ni "hecho" (verde) —
            esos dos sólo existen una vez que hay sesión. */}
        {(plannedExercises?.length ?? 0) > 0 && (
          <ul className="planned-exercise-list">
            {[...(plannedExercises ?? [])]
              .sort((a, b) => a.order - b.order)
              .map((pe) => (
                <li key={pe.id} className="planned-exercise-item planned-exercise-item--pending">
                  <div className="planned-exercise-header">
                    <strong>{exerciseName(pe.exerciseId)}</strong>
                  </div>
                  {pe.notes && <p className="cell-note-readonly">{pe.notes}</p>}
                  <PlanTargetList
                    sets={(plannedSets ?? [])
                      .filter((ps) => ps.plannedExerciseId === pe.id)
                      .sort((a, b) => a.setNumber - b.setNumber)}
                  />
                </li>
              ))}
          </ul>
        )}
      </div>
    )
  }

  const durationMinutes = sessionDurationMinutes(session.startedAt, session.endedAt)

  // Las horas se corrigen a mano porque casi nunca se abre la app justo al
  // entrar y justo al salir del gimnasio.
  async function handleStartTimeChange(time: string) {
    if (!session) return
    const startedAt = withTimeOfDay(session.startedAt, time)
    if (!startedAt) return
    // Moviendo el inicio, el término se recalcula sobre la hora que ya tenía
    // para que no quede colgado en el día anterior.
    const endedAt = session.endedAt
      ? endIsoFromTime(startedAt, toTimeInput(session.endedAt))
      : undefined
    await updateSessionTimes(session.id, { startedAt, ...(endedAt ? { endedAt } : {}) })
    await refresh()
  }

  async function handleEndTimeChange(time: string) {
    if (!session) return
    // Borrar la hora de término deja la sesión abierta otra vez.
    if (time === '') {
      await updateSessionTimes(session.id, { endedAt: null })
      await refresh()
      return
    }
    const endedAt = endIsoFromTime(session.startedAt, time)
    if (!endedAt) return
    await updateSessionTimes(session.id, { endedAt })
    await refresh()
  }

  return (
    <div>
      <div className="session-header">
        <div className="session-times">
          <label className="session-time">
            <span>Inicio</span>
            <input
              type="time"
              value={toTimeInput(session.startedAt)}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </label>
          <label className="session-time">
            <span>Término</span>
            <input
              type="time"
              value={session.endedAt ? toTimeInput(session.endedAt) : ''}
              onChange={(e) => handleEndTimeChange(e.target.value)}
            />
          </label>
          <span className="session-duration numeric">
            {durationMinutes === null ? '—' : formatSessionDuration(durationMinutes)}
          </span>
        </div>
        <div className="session-header-actions">
          {session.endedAt ? (
            <button type="button" onClick={() => setConfirmingReopen(true)}>
              Reabrir sesión
            </button>
          ) : (
            <button type="button" onClick={() => void endSession(session.id).then(refresh)}>
              Finalizar sesión
            </button>
          )}
          <ConfirmDeleteButton
            label="Eliminar sesión"
            confirmMessage="¿Eliminar toda la sesión de hoy?"
            onConfirm={() => deleteSession(session.id).then(refresh)}
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
              void reopenSession(session.id).then(refresh)
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
        <button
          type="button"
          className="load-plan-button"
          onClick={handleLoadPlan}
          disabled={isLoadingPlan}
        >
          Cargar {missingPlannedExercises.length} ejercicio
          {missingPlannedExercises.length === 1 ? '' : 's'} del plan
        </button>
      )}

      {!session.endedAt && otherPlannedDays.length > 0 && (
        <div className="load-plan-picker">
          <label>
            Cargar ejercicios de otro día planificado
            <select
              autoComplete="off"
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
            disabled={!pickedSourceDayId || isLoadingPlan}
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
          const target = restTargetFor(se.exerciseId, nextSetNumber)
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
          const exerciseIndex = sessionExercises?.findIndex((x) => x.id === se.id) ?? -1
          const showComparison = exerciseClosed
          // Closing an exercise without ever logging a set isn't "done" — it
          // should still read as pending (red), not as completed (green).
          const isComplete = exerciseClosed && sets.length > 0

          return (
            <li
              key={se.id}
              className={`planned-exercise-item ${
                isComplete ? 'planned-exercise-item--closed' : 'planned-exercise-item--open'
              }`}
            >
              <div className="planned-exercise-header">
                <strong>{exerciseName(se.exerciseId)}</strong>
                {!session.endedAt && (
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Subir ejercicio"
                      disabled={exerciseIndex <= 0}
                      onClick={() => void reorderSessionExercise(se.id, 'up').then(refresh)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Bajar ejercicio"
                      disabled={
                        exerciseIndex === -1 ||
                        exerciseIndex === (sessionExercises?.length ?? 0) - 1
                      }
                      onClick={() => void reorderSessionExercise(se.id, 'down').then(refresh)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => void setSessionExerciseClosed(se.id, !exerciseClosed).then(refresh)}
                    >
                      {exerciseClosed ? 'Reabrir ejercicio' : 'Cerrar ejercicio'}
                    </button>
                    <ConfirmDeleteButton
                      label="Quitar"
                      confirmMessage="¿Quitar este ejercicio de la sesión?"
                      onConfirm={() => deleteSessionExercise(se.id).then(refresh)}
                    />
                  </>
                )}
              </div>

              {se.notes && <p className="cell-note-readonly">{se.notes}</p>}

              {showComparison ? (
                (targetSets && targetSets.length > 0) || sets.length > 0 ? (
                  <ul className="set-compare-list">
                    {Array.from(
                      { length: Math.max(targetSets?.length ?? 0, sets.length) },
                      (_, i) => i + 1,
                    ).map((setNumber) => {
                      const planned = targetSets?.find((ps) => ps.setNumber === setNumber)
                      const actual = sets.find((s) => s.setNumber === setNumber)
                      return (
                        <li key={setNumber} className="set-compare-row">
                          <span className="set-number">{setNumber}</span>
                          <span className="set-compare-text">
                            <span className="set-compare-actual">
                              {actual ? (
                                <>
                                  {actual.weightKg ?? '-'} kg × {actual.reps}
                                  {actual.rpe !== null && ` · @${actual.rpe}`}
                                  {actual.eva !== null && ` · EVA ${actual.eva}`}
                                  {actual.dropSet === true && <span className="set-tag">DS</span>}
                                  {actual.restPause === true && <span className="set-tag">RP</span>}
                                  {actual.notes && ` · ${actual.notes}`}
                                  {e1rmSuffix(actual)}
                                </>
                              ) : (
                                'Sin registrar'
                              )}
                            </span>
                            {planned && (
                              <span className="set-compare-planned">
                                obj: {planned.targetWeightKg ?? '-'} kg × {planned.targetReps}
                                {planned.targetRpe !== null && ` · RPE ${planned.targetRpe}`}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="empty-hint">Sin series registradas.</p>
                )
              ) : (
                <PlanTargetList sets={targetSets ?? []} />
              )}

              <DeloadAlert exerciseId={se.exerciseId} />

              {!locked && (
                <>
                  <div className="rep-history-picker">
                    <label>
                      Ver historial a
                      <input
                        autoComplete="off"
                        type="number"
                        inputMode="numeric"
                        step="1"
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

              {!showComparison && (
                sets.length === 0 ? (
                  <p className="empty-hint">Sin series registradas.</p>
                ) : (
                <ul className="sets-list">
                  {sets.map((s) => (
                    <li key={s.id} className="set-row">
                      <span className="set-number">{s.setNumber}</span>
                      <span className="set-summary">
                        {s.weightKg ?? '-'} kg × {s.reps}
                        {s.rpe !== null && ` · @${s.rpe}`}
                        {s.eva !== null && ` · EVA ${s.eva}`}
                        {s.dropSet === true && <span className="set-tag">DS</span>}
                        {s.restPause === true && <span className="set-tag">RP</span>}
                        {s.notes && ` · ${s.notes}`}
                        {e1rmSuffix(s)}
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
                            onConfirm={() => deleteExecutedSet(s.id).then(refresh)}
                          />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                )
              )}

              {rest?.sessionExerciseId === se.id && !locked && (
                <RestTimer
                  key={rest.nonce}
                  sessionExerciseId={se.id}
                  targetSeconds={target}
                  initialState={rest.initialState}
                  persistKey={restStorageKey(dayId)}
                  onDismiss={() => setRest(null)}
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
                      autoComplete="off"
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
                      autoComplete="off"
                      type="number"
                      inputMode="numeric"
                      step="1"
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
                      autoComplete="off"
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
                      autoComplete="off"
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
                      autoComplete="off"
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
                  <div className="set-techniques">
                    <label className="set-technique">
                      <input
                        type="checkbox"
                        checked={form.dropSet}
                        onChange={(e) =>
                          setSetForms((prev) => ({
                            ...prev,
                            [se.id]: { ...form, dropSet: e.target.checked },
                          }))
                        }
                      />
                      Drop set
                    </label>
                    <label className="set-technique">
                      <input
                        type="checkbox"
                        checked={form.restPause}
                        onChange={(e) =>
                          setSetForms((prev) => ({
                            ...prev,
                            [se.id]: { ...form, restPause: e.target.checked },
                          }))
                        }
                      />
                      Rest pause
                    </label>
                  </div>
                  <button
                    type="button"
                    className="add-set-button"
                    onClick={() => handleSubmitSet(se.id)}
                    disabled={isSubmittingSet}
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
          <form onSubmit={handleAddExercise} className="entity-form" autoComplete="off">
            <select
              autoComplete="off"
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
            <button type="submit" disabled={isAddingExercise}>Agregar ejercicio a la sesión</button>
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
