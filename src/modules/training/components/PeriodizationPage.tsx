import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/db/database'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  copyPlannedExercisesToDay,
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
  deleteDay,
  deleteMacrocycle,
  deleteMesocycle,
  deletePlannedExercise,
  deletePlannedSet,
  deleteWeek,
  duplicateWeek,
  listPlannedDaysWithExercises,
  reorderPlannedExercise,
  reorderWeek,
  setDayPlanClosed,
  setPlannedExerciseClosed,
  updateDay,
  updateMacrocycle,
  updateMesocycle,
  updatePlannedSet,
} from '../db/planningRepository'
import { parseDateInput, toDateKey } from '../lib/calendarGrid'
import { formatDate, formatRestMinutes } from '../lib/format'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import type {
  Day,
  Macrocycle,
  Mesocycle,
  PhaseType,
  PlannedExercise,
  PlannedSet,
  Week,
} from '../domain/types'

const PHASE_LABELS: Record<PhaseType, string> = {
  accumulation: 'Acumulación',
  intensification: 'Intensificación',
  peaking: 'Peaking',
  deload: 'Deload',
  custom: 'Personalizado',
}

interface PeriodizationPageProps {
  jumpToDayId?: string | null
  onJumpHandled?: () => void
}

export function PeriodizationPage({
  jumpToDayId,
  onJumpHandled,
}: PeriodizationPageProps) {
  const [macrocycleId, setMacrocycleId] = useState<string | null>(null)
  const [mesocycleId, setMesocycleId] = useState<string | null>(null)
  const [weekId, setWeekId] = useState<string | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)

  useEffect(() => {
    if (!jumpToDayId) return
    let cancelled = false
    async function resolveAndJump() {
      const day = await db.training_days.get(jumpToDayId as string)
      if (!day || cancelled) return
      const week = day.weekId ? await db.training_weeks.get(day.weekId) : null
      const mesocycle = week
        ? await db.training_mesocycles.get(week.mesocycleId)
        : null
      if (cancelled) return
      setMacrocycleId(mesocycle?.macrocycleId ?? null)
      setMesocycleId(week?.mesocycleId ?? null)
      setWeekId(day.weekId)
      setDayId(day.id)
      onJumpHandled?.()
    }
    resolveAndJump()
    return () => {
      cancelled = true
    }
  }, [jumpToDayId, onJumpHandled])

  const macrocycles = useLiveQuery(
    () => db.training_macrocycles.filter((m) => m.deletedAt === null).sortBy('startDate'),
    [],
  )
  const mesocycles = useLiveQuery(
    () =>
      macrocycleId
        ? db.training_mesocycles
            .where('macrocycleId')
            .equals(macrocycleId)
            .filter((m) => m.deletedAt === null)
            .sortBy('order')
        : Promise.resolve<Mesocycle[]>([]),
    [macrocycleId],
  )
  const weeks = useLiveQuery(
    () =>
      mesocycleId
        ? db.training_weeks
            .where('mesocycleId')
            .equals(mesocycleId)
            .filter((w) => w.deletedAt === null)
            .sortBy('order')
        : Promise.resolve<Week[]>([]),
    [mesocycleId],
  )
  const days = useLiveQuery(
    () =>
      weekId
        ? db.training_days
            .where('weekId')
            .equals(weekId)
            .filter((d) => d.deletedAt === null)
            .sortBy('date')
        : Promise.resolve<Day[]>([]),
    [weekId],
  )
  const plannedExercises = useLiveQuery(
    () =>
      dayId
        ? db.training_planned_exercises
            .where('dayId')
            .equals(dayId)
            .filter((pe) => pe.deletedAt === null)
            .sortBy('order')
        : Promise.resolve<PlannedExercise[]>([]),
    [dayId],
  )
  const exercisesLibrary = useLiveQuery(
    () => db.training_exercises.filter((e) => e.deletedAt === null).sortBy('name'),
    [],
  )
  const plannedSets = useLiveQuery(
    () =>
      db.training_planned_sets
        .filter((ps) => ps.deletedAt === null)
        .toArray(),
    [],
  )
  const plannedDayOptions = useLiveQuery(
    () => listPlannedDaysWithExercises(),
    [],
  )

  const selectedMacrocycle = macrocycles?.find((m) => m.id === macrocycleId)
  const selectedMesocycle = mesocycles?.find((m) => m.id === mesocycleId)
  const selectedWeek = weeks?.find((w) => w.id === weekId)
  const selectedDay = days?.find((d) => d.id === dayId)
  const dayLocked = selectedDay?.planClosedAt != null

  // --- forms state ---
  const [macroName, setMacroName] = useState('')
  const [macroGoal, setMacroGoal] = useState('')
  const [macroStart, setMacroStart] = useState('')
  const [macroEnd, setMacroEnd] = useState('')

  const [mesoName, setMesoName] = useState('')
  const [mesoPhase, setMesoPhase] = useState<PhaseType>('accumulation')
  const [mesoStart, setMesoStart] = useState('')
  const [mesoEnd, setMesoEnd] = useState('')

  const [dayDate, setDayDate] = useState('')
  const [dayLabel, setDayLabel] = useState('')
  const [copyFromDayId, setCopyFromDayId] = useState('')

  const [newExerciseId, setNewExerciseId] = useState('')
  const [newExerciseNotes, setNewExerciseNotes] = useState('')

  const [setForms, setSetForms] = useState<
    Record<string, { weight: string; reps: string; rpe: string; rest: string }>
  >({})
  const [editingSetId, setEditingSetId] = useState<Record<string, string | null>>({})

  const [showMacroForm, setShowMacroForm] = useState(false)
  const [showMesoForm, setShowMesoForm] = useState(false)
  const [showDayForm, setShowDayForm] = useState(false)

  const [editingMacroId, setEditingMacroId] = useState<string | null>(null)
  const [editingMesoId, setEditingMesoId] = useState<string | null>(null)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)

  const { isSubmitting: isCreatingMacro, guard: guardMacro } = useSubmitGuard()
  const { isSubmitting: isCreatingMeso, guard: guardMeso } = useSubmitGuard()
  const { isSubmitting: isCreatingWeek, guard: guardWeek } = useSubmitGuard()
  const { isSubmitting: isCreatingDay, guard: guardDay } = useSubmitGuard()
  const { isSubmitting: isAddingExercise, guard: guardAddExercise } = useSubmitGuard()
  const { isSubmitting: isSubmittingSet, guard: guardSet } = useSubmitGuard()

  function startEditMacro(m: Macrocycle) {
    setEditingMacroId(m.id)
    setMacroName(m.name)
    setMacroGoal(m.goal)
    setMacroStart(toDateKey(new Date(m.startDate)))
    setMacroEnd(toDateKey(new Date(m.endDate)))
    setShowMacroForm(true)
  }

  function resetMacroForm() {
    setEditingMacroId(null)
    setMacroName('')
    setMacroGoal('')
    setMacroStart('')
    setMacroEnd('')
    setShowMacroForm(false)
  }

  function openNewMacroForm() {
    resetMacroForm()
    setShowMacroForm(true)
  }

  function startEditMeso(m: Mesocycle) {
    setEditingMesoId(m.id)
    setMesoName(m.name)
    setMesoPhase(m.phaseType)
    setMesoStart(toDateKey(new Date(m.startDate)))
    setMesoEnd(toDateKey(new Date(m.endDate)))
    setShowMesoForm(true)
  }

  function resetMesoForm() {
    setEditingMesoId(null)
    setMesoName('')
    setMesoPhase('accumulation')
    setMesoStart('')
    setMesoEnd('')
    setShowMesoForm(false)
  }

  function openNewMesoForm() {
    resetMesoForm()
    setShowMesoForm(true)
  }

  function startEditDay(d: Day) {
    setEditingDayId(d.id)
    setDayDate(toDateKey(new Date(d.date)))
    setDayLabel(d.label)
    setCopyFromDayId('')
    setShowDayForm(true)
  }

  function resetDayForm() {
    setEditingDayId(null)
    setDayDate('')
    setDayLabel('')
    setCopyFromDayId('')
    setShowDayForm(false)
  }

  function openNewDayForm() {
    resetDayForm()
    setShowDayForm(true)
  }

  async function handleSubmitMacrocycle(e: React.FormEvent) {
    e.preventDefault()
    if (!macroName || !macroStart || !macroEnd) return
    await guardMacro(async () => {
      const input = {
        name: macroName,
        goal: macroGoal,
        startDate: parseDateInput(macroStart).toISOString(),
        endDate: parseDateInput(macroEnd).toISOString(),
      }
      if (editingMacroId) {
        await updateMacrocycle(editingMacroId, input)
      } else {
        const m = await createMacrocycle(input)
        setMacrocycleId(m.id)
      }
      resetMacroForm()
    })
  }

  async function handleSubmitMesocycle(e: React.FormEvent) {
    e.preventDefault()
    if (!macrocycleId || !mesoName || !mesoStart || !mesoEnd) return
    await guardMeso(async () => {
      const input = {
        name: mesoName,
        phaseType: mesoPhase,
        startDate: parseDateInput(mesoStart).toISOString(),
        endDate: parseDateInput(mesoEnd).toISOString(),
      }
      if (editingMesoId) {
        await updateMesocycle(editingMesoId, input)
      } else {
        const m = await createMesocycle({ macrocycleId, ...input })
        setMesocycleId(m.id)
      }
      resetMesoForm()
    })
  }

  async function handleCreateWeek() {
    if (!mesocycleId) return
    await guardWeek(async () => {
      const w = await createWeek(mesocycleId)
      setWeekId(w.id)
    })
  }

  async function handleDuplicateWeek(sourceWeekId: string) {
    const w = await duplicateWeek(sourceWeekId)
    setWeekId(w.id)
  }

  async function handleSubmitDay(e: React.FormEvent) {
    e.preventDefault()
    if (!weekId || !dayDate) return
    await guardDay(async () => {
      if (editingDayId) {
        await updateDay(editingDayId, {
          date: parseDateInput(dayDate).toISOString(),
          label: dayLabel,
        })
      } else {
        const d = await createDay({
          weekId,
          date: parseDateInput(dayDate).toISOString(),
          label: dayLabel,
        })
        if (copyFromDayId) {
          await copyPlannedExercisesToDay(copyFromDayId, d.id)
        }
      }
      resetDayForm()
    })
  }

  async function handleAddPlannedExercise(e: React.FormEvent) {
    e.preventDefault()
    if (!dayId || !newExerciseId) return
    await guardAddExercise(async () => {
      await createPlannedExercise({
        dayId,
        exerciseId: newExerciseId,
        notes: newExerciseNotes,
      })
      setNewExerciseId('')
      setNewExerciseNotes('')
    })
  }

  async function handleSubmitPlannedSet(plannedExerciseId: string) {
    const form = setForms[plannedExerciseId]
    if (!form || !form.reps) return
    await guardSet(async () => {
      const input = {
        targetWeightKg: form.weight ? Number(form.weight) : null,
        targetReps: Number(form.reps),
        targetRpe: form.rpe ? Number(form.rpe) : null,
        restSecondsTarget: form.rest ? Math.round(Number(form.rest) * 60) : null,
      }
      const editingId = editingSetId[plannedExerciseId]
      if (editingId) {
        await updatePlannedSet(editingId, input)
      } else {
        await createPlannedSet({ plannedExerciseId, ...input })
      }
      setSetForms((prev) => ({
        ...prev,
        [plannedExerciseId]: { weight: '', reps: '', rpe: '', rest: '' },
      }))
      setEditingSetId((prev) => ({ ...prev, [plannedExerciseId]: null }))
    })
  }

  function startEditPlannedSet(plannedExerciseId: string, s: PlannedSet) {
    setSetForms((prev) => ({
      ...prev,
      [plannedExerciseId]: {
        weight: s.targetWeightKg !== null ? String(s.targetWeightKg) : '',
        reps: String(s.targetReps),
        rpe: s.targetRpe !== null ? String(s.targetRpe) : '',
        rest:
          s.restSecondsTarget !== null ? String(s.restSecondsTarget / 60) : '',
      },
    }))
    setEditingSetId((prev) => ({ ...prev, [plannedExerciseId]: s.id }))
  }

  function cancelEditPlannedSet(plannedExerciseId: string) {
    setSetForms((prev) => ({
      ...prev,
      [plannedExerciseId]: { weight: '', reps: '', rpe: '', rest: '' },
    }))
    setEditingSetId((prev) => ({ ...prev, [plannedExerciseId]: null }))
  }

  function exerciseName(id: string): string {
    return exercisesLibrary?.find((e) => e.id === id)?.name ?? '?'
  }

  return (
    <div className="page">
      <h1>Periodización</h1>

      <nav className="breadcrumb">
        <button type="button" onClick={() => { setMacrocycleId(null); setMesocycleId(null); setWeekId(null); setDayId(null); resetMacroForm(); resetMesoForm(); resetDayForm() }}>
          Macrociclos
        </button>
        {selectedMacrocycle && (
          <>
            {' / '}
            <button type="button" onClick={() => { setMesocycleId(null); setWeekId(null); setDayId(null); resetMesoForm(); resetDayForm() }}>
              {selectedMacrocycle.name}
            </button>
          </>
        )}
        {selectedMesocycle && (
          <>
            {' / '}
            <button type="button" onClick={() => { setWeekId(null); setDayId(null); resetDayForm() }}>
              {selectedMesocycle.name}
            </button>
          </>
        )}
        {selectedWeek && (
          <>
            {' / '}
            <button type="button" onClick={() => { setDayId(null); resetDayForm() }}>
              Semana {selectedWeek.order + 1}
            </button>
          </>
        )}
      </nav>

      {!macrocycleId && (
        <section>
          <h2>Macrociclos</h2>
          <ul className="entity-list">
            {macrocycles?.map((m) => (
              <li key={m.id} className="list-row">
                <button type="button" onClick={() => setMacrocycleId(m.id)}>
                  {m.name} — {formatDate(m.startDate)} a {formatDate(m.endDate)}
                </button>
                <button type="button" onClick={() => startEditMacro(m)}>
                  Editar
                </button>
                <ConfirmDeleteButton
                  confirmMessage={`¿Eliminar "${m.name}"? Se borra todo lo planificado y registrado dentro.`}
                  onConfirm={() => deleteMacrocycle(m.id)}
                />
              </li>
            ))}
          </ul>
          {showMacroForm ? (
            <form onSubmit={handleSubmitMacrocycle} className="entity-form">
              <input value={macroName} onChange={(e) => setMacroName(e.target.value)} placeholder="Nombre (ej. Prep. Nacional 2027)" required />
              <input value={macroGoal} onChange={(e) => setMacroGoal(e.target.value)} placeholder="Objetivo" />
              <label>
                Fecha de inicio
                <input type="date" value={macroStart} onChange={(e) => setMacroStart(e.target.value)} required />
              </label>
              <label>
                Fecha de fin
                <input type="date" value={macroEnd} onChange={(e) => setMacroEnd(e.target.value)} required />
              </label>
              <button type="submit" disabled={isCreatingMacro}>
                {editingMacroId ? 'Guardar cambios' : 'Crear macrociclo'}
              </button>
              <button type="button" onClick={resetMacroForm}>Cancelar</button>
            </form>
          ) : (
            <button type="button" onClick={openNewMacroForm}>+ Agregar macrociclo</button>
          )}
        </section>
      )}

      {macrocycleId && !mesocycleId && (
        <section>
          <h2>Mesociclos de {selectedMacrocycle?.name}</h2>
          <ul className="entity-list">
            {mesocycles?.map((m) => (
              <li key={m.id} className="list-row">
                <button type="button" onClick={() => setMesocycleId(m.id)}>
                  {m.name} ({PHASE_LABELS[m.phaseType]}) — {formatDate(m.startDate)} a {formatDate(m.endDate)}
                </button>
                <button type="button" onClick={() => startEditMeso(m)}>
                  Editar
                </button>
                <ConfirmDeleteButton
                  confirmMessage={`¿Eliminar "${m.name}"? Se borra todo lo planificado y registrado dentro.`}
                  onConfirm={() => deleteMesocycle(m.id)}
                />
              </li>
            ))}
          </ul>
          {showMesoForm ? (
            <form onSubmit={handleSubmitMesocycle} className="entity-form">
              <input value={mesoName} onChange={(e) => setMesoName(e.target.value)} placeholder="Nombre (ej. Bloque 1)" required />
              <select value={mesoPhase} onChange={(e) => setMesoPhase(e.target.value as PhaseType)}>
                {Object.entries(PHASE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <label>
                Fecha de inicio
                <input type="date" value={mesoStart} onChange={(e) => setMesoStart(e.target.value)} required />
              </label>
              <label>
                Fecha de fin
                <input type="date" value={mesoEnd} onChange={(e) => setMesoEnd(e.target.value)} required />
              </label>
              <button type="submit" disabled={isCreatingMeso}>
                {editingMesoId ? 'Guardar cambios' : 'Crear mesociclo'}
              </button>
              <button type="button" onClick={resetMesoForm}>Cancelar</button>
            </form>
          ) : (
            <button type="button" onClick={openNewMesoForm}>+ Agregar mesociclo</button>
          )}
        </section>
      )}

      {mesocycleId && !weekId && (
        <section>
          <h2>Semanas de {selectedMesocycle?.name}</h2>
          <ul className="entity-list">
            {weeks?.map((w, index) => (
              <li key={w.id} className="list-row">
                <button type="button" onClick={() => setWeekId(w.id)}>
                  Semana {w.order + 1}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mover semana hacia arriba"
                  disabled={index === 0}
                  onClick={() => reorderWeek(w.id, 'up')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mover semana hacia abajo"
                  disabled={index === (weeks?.length ?? 0) - 1}
                  onClick={() => reorderWeek(w.id, 'down')}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="list-row-secondary"
                  onClick={() => handleDuplicateWeek(w.id)}
                >
                  Duplicar como punto de partida
                </button>
                <ConfirmDeleteButton
                  confirmMessage={`¿Eliminar la Semana ${w.order + 1}? Se borra todo lo planificado y registrado dentro.`}
                  onConfirm={() => deleteWeek(w.id)}
                />
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleCreateWeek} disabled={isCreatingWeek}>+ Agregar semana</button>
        </section>
      )}

      {weekId && !dayId && (
        <section>
          <h2>Días de la semana {selectedWeek ? selectedWeek.order + 1 : ''}</h2>
          <ul className="entity-list">
            {days?.map((d) => (
              <li key={d.id} className="list-row">
                <button type="button" onClick={() => setDayId(d.id)}>
                  {formatDate(d.date)} — {d.label || 'Sin etiqueta'}
                  {d.planClosedAt !== null && (
                    <span className="day-closed-badge" aria-label="Día cerrado">
                      ✓
                    </span>
                  )}
                </button>
                <button type="button" onClick={() => startEditDay(d)}>
                  Editar
                </button>
                <ConfirmDeleteButton
                  confirmMessage="¿Eliminar este día? Si tenía una sesión o cardio registrado, también se elimina."
                  onConfirm={() => deleteDay(d.id)}
                />
              </li>
            ))}
          </ul>
          {showDayForm ? (
            <form onSubmit={handleSubmitDay} className="entity-form">
              <label>
                Fecha
                <input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} required />
              </label>
              <input value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} placeholder="Etiqueta (ej. Tren superior)" />
              {!editingDayId && plannedDayOptions && plannedDayOptions.length > 0 && (
                <label>
                  Copiar plan de un día ya planificado (opcional)
                  <select
                    value={copyFromDayId}
                    onChange={(e) => setCopyFromDayId(e.target.value)}
                  >
                    <option value="">No copiar</option>
                    {plannedDayOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label || 'Sin etiqueta'} — {formatDate(d.date)} (
                        {d.exerciseCount} ejercicio{d.exerciseCount === 1 ? '' : 's'})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" disabled={isCreatingDay}>
                {editingDayId ? 'Guardar cambios' : 'Agregar día'}
              </button>
              <button type="button" onClick={resetDayForm}>Cancelar</button>
            </form>
          ) : (
            <button type="button" onClick={openNewDayForm}>+ Agregar día</button>
          )}
        </section>
      )}

      {dayId && (
        <section>
          <div className="planned-exercise-header">
            <h2>Plan del día</h2>
            <button
              type="button"
              onClick={() => setDayPlanClosed(dayId, !dayLocked)}
            >
              {dayLocked ? 'Reabrir día' : 'Cerrar día'}
            </button>
          </div>
          <ul className="planned-exercise-list">
            {plannedExercises?.map((pe, index) => {
              const sets = (
                plannedSets?.filter((ps) => ps.plannedExerciseId === pe.id) ?? []
              ).sort((a, b) => a.setNumber - b.setNumber)
              const form = setForms[pe.id] ?? { weight: '', reps: '', rpe: '', rest: '' }
              const exerciseClosed = pe.closedAt !== null
              const locked = dayLocked || exerciseClosed
              const editingId = editingSetId[pe.id]
              return (
                <li key={pe.id} className="planned-exercise-item">
                  <div className="planned-exercise-header">
                    <strong>{exerciseName(pe.exerciseId)}</strong>
                    {pe.notes && <span className="notes"> — {pe.notes}</span>}
                    {!dayLocked && (
                      <>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Mover ejercicio hacia arriba"
                          disabled={index === 0}
                          onClick={() => reorderPlannedExercise(pe.id, 'up')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Mover ejercicio hacia abajo"
                          disabled={index === (plannedExercises?.length ?? 0) - 1}
                          onClick={() => reorderPlannedExercise(pe.id, 'down')}
                        >
                          ↓
                        </button>
                      </>
                    )}
                    {!dayLocked && (
                      <button
                        type="button"
                        onClick={() => setPlannedExerciseClosed(pe.id, !exerciseClosed)}
                      >
                        {exerciseClosed ? 'Reabrir ejercicio' : 'Cerrar ejercicio'}
                      </button>
                    )}
                    <ConfirmDeleteButton
                      label="Quitar"
                      confirmMessage="¿Quitar este ejercicio del plan?"
                      onConfirm={() => deletePlannedExercise(pe.id)}
                    />
                  </div>
                  <ul className="sets-list">
                    {sets.map((s) => (
                      <li
                        key={s.id}
                        className={
                          editingId === s.id ? 'set-row set-row--editing' : 'set-row'
                        }
                      >
                        <span className="set-number">{s.setNumber}</span>
                        <span className="set-summary">
                          {s.targetWeightKg ?? '-'} kg × {s.targetReps}
                          {s.targetRpe !== null && ` · RPE ${s.targetRpe}`}
                          {s.restSecondsTarget !== null &&
                            ` · ${formatRestMinutes(s.restSecondsTarget)}`}
                        </span>
                        {!locked && (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label="Editar serie planificada"
                              onClick={() => startEditPlannedSet(pe.id, s)}
                            >
                              ✎
                            </button>
                            <ConfirmDeleteButton
                              variant="icon"
                              label="Eliminar serie planificada"
                              confirmMessage="¿Eliminar esta serie planificada?"
                              onConfirm={() => deletePlannedSet(s.id)}
                            />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!locked && (
                    <div className="set-form">
                      <label>
                        Peso (kg)
                        <input type="number" inputMode="decimal" value={form.weight} onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, weight: e.target.value } }))} />
                      </label>
                      <label>
                        Reps
                        <input type="number" inputMode="numeric" value={form.reps} onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, reps: e.target.value } }))} />
                      </label>
                      <label>
                        RPE
                        <input type="number" inputMode="decimal" step="0.5" value={form.rpe} onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, rpe: e.target.value } }))} />
                      </label>
                      <label>
                        Descanso (min)
                        <input type="number" inputMode="decimal" step="0.5" min={0} value={form.rest} onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, rest: e.target.value } }))} />
                      </label>
                      <button
                        type="button"
                        className="add-set-button"
                        onClick={() => handleSubmitPlannedSet(pe.id)}
                        disabled={isSubmittingSet}
                      >
                        {editingId ? 'Guardar cambios' : `+ Agregar serie ${sets.length + 1}`}
                      </button>
                      {editingId && (
                        <button
                          type="button"
                          className="set-form-cancel"
                          onClick={() => cancelEditPlannedSet(pe.id)}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {dayLocked ? (
            <p className="empty-hint">
              El plan de este día está cerrado. Tocá "Reabrir día" para
              seguir editándolo.
            </p>
          ) : (
            <form onSubmit={handleAddPlannedExercise} className="entity-form">
              <select value={newExerciseId} onChange={(e) => setNewExerciseId(e.target.value)} required>
                <option value="">Elegir ejercicio</option>
                {exercisesLibrary?.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
              <input value={newExerciseNotes} onChange={(e) => setNewExerciseNotes(e.target.value)} placeholder="Notas (opcional)" />
              <button type="submit" disabled={isAddingExercise}>Agregar ejercicio al día</button>
            </form>
          )}
        </section>
      )}
    </div>
  )
}
