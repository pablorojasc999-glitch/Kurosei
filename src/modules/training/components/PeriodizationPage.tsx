import { useCallback, useEffect, useState } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { useSupabaseSession } from '../../../shared/hooks/useSupabaseSession'
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
  getDayById,
  getMesocycleById,
  getWeekById,
  listDays,
  listMacrocycles,
  listAllWeeks,
  listMesocycles,
  listMesocyclesWithContext,
  listPlannedDaysWithExercises,
  listPlannedExercises,
  listPlannedSetsForExercises,
  listWeeks,
  reorderPlannedExercise,
  setDayPlanClosed,
  setWeekMesocycle,
  setPlannedExerciseClosed,
  updateDay,
  updateMacrocycle,
  updateMesocycle,
  updatePlannedSet,
  updateWeek,
} from '../db/planningRepository'
import { listExercises } from '../db/trainingRepository'
import { generateId } from '../../../shared/lib/id'
import { nowIso } from '../../../shared/lib/timestamps'
import { parseDateInput, toDateKey } from '../lib/calendarGrid'
import { parseReps } from '../lib/reps'
import { formatDate, formatRestMinutes } from '../lib/format'
import { mesoHue } from '../lib/macroCalendar'
import {
  formatWeekRange,
  isCurrentWeek,
  isValidWeekRange,
  mesocycleIndexInMacro,
  suggestNextDayDate,
  suggestNextWeekRange,
} from '../lib/weeks'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { ExercisePicker } from './ExercisePicker'
import { WeekStimulus } from './WeekStimulus'
import { MacroCalendar } from './MacroCalendar'
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
  const session = useSupabaseSession()
  const [macrocycleId, setMacrocycleId] = useState<string | null>(null)
  const [mesocycleId, setMesocycleId] = useState<string | null>(null)
  const [weekId, setWeekId] = useState<string | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)
  // Las semanas son lo que se planifica, así que son lo primero que se ve; los
  // macrociclos y mesociclos son la forma de agruparlas y viven aparte.
  const [section, setSection] = useState<'semanas' | 'macrociclos'>('semanas')

  useEffect(() => {
    if (!jumpToDayId || !session) return
    let cancelled = false
    async function resolveAndJump() {
      const day = await getDayById(jumpToDayId as string)
      if (!day || cancelled) return
      const week = day.weekId ? await getWeekById(day.weekId) : null
      const mesocycle = week?.mesocycleId ? await getMesocycleById(week.mesocycleId) : null
      if (cancelled) return
      setSection('semanas')
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
  }, [jumpToDayId, onJumpHandled, session])

  // Desde el calendario se toca un día suelto: hay que reconstruir la ruta
  // (mesociclo y semana) para que el detalle y las migas de pan cuadren.
  async function openDayFromCalendar(id: string) {
    const day = await getDayById(id)
    if (!day) return
    setSection('semanas')
    setWeekId(day.weekId)
    setDayId(id)
  }

  const { data: macrocycles, refresh: refreshMacrocycles } = useRemoteQuery(
    useCallback(() => listMacrocycles(), []),
  )
  const { data: mesocycles, refresh: refreshMesocycles } = useRemoteQuery(
    useCallback(
      () => (macrocycleId ? listMesocycles(macrocycleId) : Promise.resolve<Mesocycle[]>([])),
      [macrocycleId],
    ),
  )
  const { data: weeks, refresh: refreshWeeks } = useRemoteQuery(
    useCallback(
      () => (mesocycleId ? listWeeks(mesocycleId) : Promise.resolve<Week[]>([])),
      [mesocycleId],
    ),
  )
  const { data: allWeeks, refresh: refreshAllWeeks } = useRemoteQuery(
    useCallback(() => listAllWeeks(), []),
  )
  const { data: allMesocycles } = useRemoteQuery(useCallback(() => listMesocyclesWithContext(), []))
  const { data: days, refresh: refreshDays } = useRemoteQuery(
    useCallback(() => (weekId ? listDays(weekId) : Promise.resolve<Day[]>([])), [weekId]),
  )
  const { data: plannedExercises, refresh: refreshPlannedExercises } = useRemoteQuery(
    useCallback(
      () => (dayId ? listPlannedExercises(dayId) : Promise.resolve<PlannedExercise[]>([])),
      [dayId],
    ),
  )
  const { data: exercisesLibrary } = useRemoteQuery(useCallback(() => listExercises(), []))
  // Depende de `plannedExercises` (no de `dayId`) para no traer la tabla
  // entera de series planificadas: sólo las del día que se está mirando. Como
  // efecto colateral, se refresca solo cada vez que `plannedExercises` lo
  // hace — así que agregar/quitar/reordenar un ejercicio ya no necesita
  // pedirla aparte.
  const { data: plannedSets, refresh: refreshPlannedSets, setOptimistic: setPlannedSetsOptimistic } = useRemoteQuery(
    useCallback(
      () => listPlannedSetsForExercises((plannedExercises ?? []).map((pe) => pe.id)),
      [plannedExercises],
    ),
  )
  const { data: plannedDayOptions, refresh: refreshPlannedDayOptions } = useRemoteQuery(
    useCallback(() => listPlannedDaysWithExercises(), []),
  )

  const selectedMacrocycle = macrocycles?.find((m) => m.id === macrocycleId)
  const selectedMesocycle = mesocycles?.find((m) => m.id === mesocycleId)
  const selectedWeek = allWeeks?.find((w) => w.id === weekId)
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

  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [weekMesoId, setWeekMesoId] = useState('')

  const [dayDate, setDayDate] = useState('')
  const [dayLabel, setDayLabel] = useState('')
  const [copyFromDayId, setCopyFromDayId] = useState('')

  const [newExerciseId, setNewExerciseId] = useState('')
  const [newExerciseNotes, setNewExerciseNotes] = useState('')

  const [setForms, setSetForms] = useState<
    Record<
      string,
      { weight: string; reps: string; rpe: string; dropSet: boolean; restPause: boolean }
    >
  >({})
  const [editingSetId, setEditingSetId] = useState<Record<string, string | null>>({})

  const [showMacroForm, setShowMacroForm] = useState(false)
  const [showMesoForm, setShowMesoForm] = useState(false)
  const [showDayForm, setShowDayForm] = useState(false)
  const [showWeekForm, setShowWeekForm] = useState(false)
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null)

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
    if (selectedWeek) {
      setDayDate(suggestNextDayDate(selectedWeek, (days ?? []).map((d) => d.date)))
    }
    setShowDayForm(true)
  }

  function resetWeekForm() {
    setEditingWeekId(null)
    setWeekStart('')
    setWeekEnd('')
    setWeekMesoId('')
    setShowWeekForm(false)
  }

  function openNewWeekForm() {
    resetWeekForm()
    const suggestion = suggestNextWeekRange(allWeeks ?? [], new Date())
    setWeekStart(suggestion.startDate)
    setWeekEnd(suggestion.endDate)
    setShowWeekForm(true)
  }

  function startEditWeek(w: Week) {
    setEditingWeekId(w.id)
    setWeekStart(w.startDate.slice(0, 10))
    setWeekEnd(w.endDate.slice(0, 10))
    setWeekMesoId(w.mesocycleId ?? '')
    setShowWeekForm(true)
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
      await refreshMacrocycles()
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
      await refreshMesocycles()
      resetMesoForm()
    })
  }

  async function handleSubmitWeek(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidWeekRange(weekStart, weekEnd)) return
    await guardWeek(async () => {
      const input = {
        mesocycleId: weekMesoId || null,
        startDate: weekStart,
        endDate: weekEnd,
      }
      if (editingWeekId) {
        await updateWeek(editingWeekId, input)
      } else {
        const w = await createWeek(input)
        setWeekId(w.id)
      }
      await Promise.all([refreshAllWeeks(), refreshWeeks()])
      resetWeekForm()
    })
  }

  async function handleChangeWeekMesocycle(id: string, nextMesoId: string) {
    await setWeekMesocycle(id, nextMesoId || null)
    await Promise.all([refreshAllWeeks(), refreshWeeks()])
  }

  async function handleDuplicateWeek(sourceWeekId: string) {
    const w = await duplicateWeek(sourceWeekId)
    await Promise.all([refreshAllWeeks(), refreshWeeks(), refreshPlannedDayOptions()])
    setWeekId(w.id)
    setDayId(null)
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
      await Promise.all([refreshDays(), refreshPlannedDayOptions()])
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
      await Promise.all([refreshPlannedExercises(), refreshPlannedDayOptions()])
      setNewExerciseId('')
      setNewExerciseNotes('')
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
  async function handleSubmitPlannedSet(plannedExerciseId: string) {
    const form = setForms[plannedExerciseId]
    if (!form || !form.reps) return
    await guardSet(async () => {
      const input = {
        targetWeightKg: form.weight ? Number(form.weight) : null,
        targetReps: parseReps(form.reps),
        targetRpe: form.rpe ? Number(form.rpe) : null,
        dropSet: form.dropSet,
        restPause: form.restPause,
      }
      const editingId = editingSetId[plannedExerciseId]
      setSetForms((prev) => ({
        ...prev,
        [plannedExerciseId]: { weight: '', reps: '', rpe: '', dropSet: false, restPause: false },
      }))
      setEditingSetId((prev) => ({ ...prev, [plannedExerciseId]: null }))
      if (editingId) {
        const timestamp = nowIso()
        // Sin `restSecondsTarget`: el descanso ya no se planifica, pero el que
        // tengan las series viejas se respeta.
        setPlannedSetsOptimistic(
          (current) =>
            current?.map((s) => (s.id === editingId ? { ...s, ...input, updatedAt: timestamp } : s)) ?? [],
        )
        try {
          await updatePlannedSet(editingId, input)
        } finally {
          await refreshPlannedSets()
        }
      } else {
        const siblings = (plannedSets ?? []).filter((ps) => ps.plannedExerciseId === plannedExerciseId)
        const nextSetNumber = siblings.length ? Math.max(...siblings.map((ps) => ps.setNumber)) + 1 : 1
        const timestamp = nowIso()
        const id = generateId()
        const optimisticSet: PlannedSet = {
          id,
          plannedExerciseId,
          ...input,
          restSecondsTarget: null,
          setNumber: nextSetNumber,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        }
        setPlannedSetsOptimistic((current) => [...(current ?? []), optimisticSet])
        try {
          await createPlannedSet({ id, plannedExerciseId, ...input, restSecondsTarget: null })
        } finally {
          await refreshPlannedSets()
        }
      }
    })
  }

  /**
   * Agrega una serie idéntica a la anterior. Va directo, sin pasar por el
   * formulario: prescribir 3×5 iguales es lo normal, y obligar a rellenar los
   * mismos tres campos otra vez es justo lo que se quería evitar.
   */
  async function handleRepeatPlannedSet(plannedExerciseId: string, previa: PlannedSet) {
    await guardSet(async () => {
      const siblings = (plannedSets ?? []).filter((ps) => ps.plannedExerciseId === plannedExerciseId)
      const nextSetNumber = siblings.length ? Math.max(...siblings.map((ps) => ps.setNumber)) + 1 : 1
      const timestamp = nowIso()
      const id = generateId()
      const repeatedInput = {
        targetWeightKg: previa.targetWeightKg,
        targetReps: previa.targetReps,
        targetRpe: previa.targetRpe,
        restSecondsTarget: previa.restSecondsTarget,
        dropSet: previa.dropSet === true,
        restPause: previa.restPause === true,
      }
      const optimisticSet: PlannedSet = {
        id,
        plannedExerciseId,
        ...repeatedInput,
        setNumber: nextSetNumber,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }
      setPlannedSetsOptimistic((current) => [...(current ?? []), optimisticSet])
      try {
        await createPlannedSet({ id, plannedExerciseId, ...repeatedInput })
      } finally {
        await refreshPlannedSets()
      }
    })
  }

  function startEditPlannedSet(plannedExerciseId: string, s: PlannedSet) {
    setSetForms((prev) => ({
      ...prev,
      [plannedExerciseId]: {
        weight: s.targetWeightKg !== null ? String(s.targetWeightKg) : '',
        reps: String(s.targetReps),
        rpe: s.targetRpe !== null ? String(s.targetRpe) : '',
        dropSet: s.dropSet === true,
        restPause: s.restPause === true,
      },
    }))
    setEditingSetId((prev) => ({ ...prev, [plannedExerciseId]: s.id }))
  }

  function cancelEditPlannedSet(plannedExerciseId: string) {
    setSetForms((prev) => ({
      ...prev,
      [plannedExerciseId]: { weight: '', reps: '', rpe: '', dropSet: false, restPause: false },
    }))
    setEditingSetId((prev) => ({ ...prev, [plannedExerciseId]: null }))
  }

  function exerciseName(id: string): string {
    return exercisesLibrary?.find((e) => e.id === id)?.name ?? '?'
  }

  // Ya no hay copia local: sin sesión no hay periodización que mostrar.
  if (session === undefined) {
    return (
      <div className="page">
        <h1>Periodización</h1>
      </div>
    )
  }
  if (session === null) {
    return (
      <div className="page">
        <h1>Periodización</h1>
        <p className="empty-hint">
          Iniciá sesión (el ícono de arriba a la derecha) para ver y editar la periodización.
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Periodización</h1>

      <div className="sub-tabs">
        <button
          type="button"
          className={section === 'semanas' ? 'active' : ''}
          onClick={() => setSection('semanas')}
        >
          Semanas
        </button>
        <button
          type="button"
          className={section === 'macrociclos' ? 'active' : ''}
          onClick={() => setSection('macrociclos')}
        >
          Macrociclos
        </button>
      </div>

      {section === 'semanas' && (
        <nav className="breadcrumb">
          <button type="button" onClick={() => { setWeekId(null); setDayId(null); resetDayForm() }}>
            Semanas
          </button>
          {selectedWeek && (
            <>
              {' / '}
              <button type="button" onClick={() => { setDayId(null); resetDayForm() }}>
                {formatWeekRange(selectedWeek)}
              </button>
            </>
          )}
        </nav>
      )}

      {section === 'macrociclos' && (
        <nav className="breadcrumb">
          <button type="button" onClick={() => { setMacrocycleId(null); setMesocycleId(null); resetMacroForm(); resetMesoForm() }}>
            Macrociclos
          </button>
          {selectedMacrocycle && (
            <>
              {' / '}
              <button type="button" onClick={() => { setMesocycleId(null); resetMesoForm() }}>
                {selectedMacrocycle.name}
              </button>
            </>
          )}
          {selectedMesocycle && (
            <>
              {' / '}
              <button type="button" onClick={() => undefined}>
                {selectedMesocycle.name}
              </button>
            </>
          )}
        </nav>
      )}

      {section === 'semanas' && !dayId && (
        <section className="elevated-section">
          <h2>Semanas</h2>
          <div className="week-chips">
            {allWeeks?.map((w) => {
              const meso = w.mesocycleId ? allMesocycles?.find((m) => m.id === w.mesocycleId) : undefined
              const hue = meso ? mesoHue(mesocycleIndexInMacro(meso, allMesocycles ?? [])) : null
              const current = isCurrentWeek(w, toDateKey(new Date()))
              return (
                <div
                  key={w.id}
                  className={[
                    'week-chip',
                    w.id === weekId ? 'week-chip--active' : '',
                    hue !== null ? 'week-chip--meso' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={hue !== null ? ({ '--meso-hue': hue } as React.CSSProperties) : undefined}
                >
                  <button
                    type="button"
                    className="week-chip-main"
                    aria-pressed={w.id === weekId}
                    onClick={() => {
                      setWeekId(w.id)
                      resetDayForm()
                    }}
                  >
                    <span className="week-chip-range">{formatWeekRange(w)}</span>
                    <span className="week-chip-meso">{meso ? meso.name : 'Sin mesociclo'}</span>
                    {current && <span className="week-chip-now">En curso</span>}
                  </button>
                  <ConfirmDeleteButton
                    variant="icon"
                    label={`Eliminar la semana ${formatWeekRange(w)}`}
                    className="icon-button week-chip-delete"
                    confirmMessage={`¿Eliminar la semana ${formatWeekRange(w)}? Se borra todo lo planificado y registrado dentro.`}
                    onConfirm={() =>
                      deleteWeek(w.id).then(async () => {
                        if (weekId === w.id) setWeekId(null)
                        await Promise.all([refreshAllWeeks(), refreshWeeks(), refreshPlannedDayOptions()])
                      })
                    }
                  />
                </div>
              )
            })}
          </div>
          {allWeeks?.length === 0 && (
            <p className="empty-hint">Todavía no hay semanas. Cada una se planifica por separado.</p>
          )}
          <button
            type="button"
            className="finance-add-button"
            onClick={openNewWeekForm}
            disabled={isCreatingWeek}
          >
            + Nueva semana
          </button>
        </section>
      )}

      {section === 'semanas' && selectedWeek && !dayId && (
        <section className="elevated-section">
          <div className="planned-exercise-header">
            <h2>{formatWeekRange(selectedWeek)}</h2>
            <button type="button" onClick={() => startEditWeek(selectedWeek)}>
              Editar fechas
            </button>
          </div>
          <label className="week-meso-field">
            Mesociclo
            <select
              autoComplete="off"
              value={selectedWeek.mesocycleId ?? ''}
              onChange={(e) => void handleChangeWeekMesocycle(selectedWeek.id, e.target.value)}
            >
              <option value="">Sin mesociclo</option>
              {allMesocycles?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.macrocycleName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="list-row-secondary"
            onClick={() => void handleDuplicateWeek(selectedWeek.id)}
          >
            Duplicar como punto de partida
          </button>
        </section>
      )}

      {section === 'semanas' && selectedWeek && !dayId && <WeekStimulus weekId={selectedWeek.id} />}

      {showWeekForm && (
        <BottomSheet title={editingWeekId ? 'Editar semana' : 'Nueva semana'} onClose={resetWeekForm}>
          <form onSubmit={handleSubmitWeek} className="entity-form" autoComplete="off">
            <label>
              Primer día
              <input autoComplete="off" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} required />
            </label>
            <label>
              Último día
              <input autoComplete="off" type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} required />
            </label>
            {weekStart && weekEnd && !isValidWeekRange(weekStart, weekEnd) && (
              <p className="error">El último día no puede ser anterior al primero.</p>
            )}
            <label>
              Mesociclo (opcional)
              <select autoComplete="off" value={weekMesoId} onChange={(e) => setWeekMesoId(e.target.value)}>
                <option value="">Sin mesociclo</option>
                {allMesocycles?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.macrocycleName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={isCreatingWeek || !isValidWeekRange(weekStart, weekEnd)}>
              {editingWeekId ? 'Guardar cambios' : 'Crear semana'}
            </button>
            <button type="button" onClick={resetWeekForm}>Cancelar</button>
          </form>
        </BottomSheet>
      )}

      {section === 'semanas' && selectedWeek && !dayId && (
        <section className="elevated-section">
          <h2>Días de la semana</h2>
          <ul className="entity-list">
            {days?.map((d) => (
              <li key={d.id} className="list-card">
                <button type="button" className="list-card-main" onClick={() => setDayId(d.id)}>
                  <span className="list-card-line">{formatDate(d.date)}</span>
                  <span className="list-card-line list-card-line--secondary">
                    {d.label || 'Sin etiqueta'}
                    {d.planClosedAt != null && (
                      <span className="day-closed-badge" aria-label="Día cerrado">
                        ✓
                      </span>
                    )}
                  </span>
                </button>
                <div className="list-card-actions">
                  <button type="button" onClick={() => startEditDay(d)}>
                    Editar
                  </button>
                  <ConfirmDeleteButton
                    confirmMessage="¿Eliminar este día? Si tenía una sesión o cardio registrado, también se elimina."
                    onConfirm={() =>
                      deleteDay(d.id).then(async () => {
                        await Promise.all([refreshDays(), refreshPlannedDayOptions()])
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="finance-add-button" onClick={openNewDayForm}>+ Agregar día</button>
          {showDayForm && (
            <BottomSheet title={editingDayId ? 'Editar día' : 'Nuevo día'} onClose={resetDayForm}>
            <form onSubmit={handleSubmitDay} className="entity-form" autoComplete="off">
              <label>
                Fecha
                <input autoComplete="off" type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} required />
              </label>
              <input autoComplete="off" value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} placeholder="Etiqueta (ej. Tren superior)" />
              {!editingDayId && plannedDayOptions && plannedDayOptions.length > 0 && (
                <label>
                  Copiar plan de un día ya planificado (opcional)
                  <select
                    autoComplete="off"
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
            </BottomSheet>
          )}
        </section>
      )}

      {section === 'semanas' && dayId && (
        <section className="elevated-section">
          <div className="planned-exercise-header">
            <h2>Plan del día</h2>
            <button
              type="button"
              onClick={() => void setDayPlanClosed(dayId, !dayLocked).then(refreshDays)}
            >
              {dayLocked ? 'Reabrir día' : 'Cerrar día'}
            </button>
          </div>
          <ul className="planned-exercise-list">
            {plannedExercises?.map((pe, index) => {
              const sets = (
                plannedSets?.filter((ps) => ps.plannedExerciseId === pe.id) ?? []
              ).sort((a, b) => a.setNumber - b.setNumber)
              const form = setForms[pe.id] ?? { weight: '', reps: '', rpe: '', dropSet: false, restPause: false }
              const exerciseClosed = pe.closedAt !== null
              const locked = dayLocked || exerciseClosed
              const editingId = editingSetId[pe.id]
              return (
                <li key={pe.id} className="planned-exercise-item">
                  <div className="planned-exercise-card-head">
                    <div className="planned-exercise-info">
                      <strong>
                        <span className="planned-exercise-order">{index + 1}.</span>{' '}
                        {exerciseName(pe.exerciseId)}
                      </strong>
                      {pe.notes && <span className="notes">{pe.notes}</span>}
                    </div>
                    <div className="planned-exercise-actions">
                      {!dayLocked && (
                        <>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Mover ejercicio hacia arriba"
                            disabled={index === 0}
                            onClick={() => void reorderPlannedExercise(pe.id, 'up').then(refreshPlannedExercises)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Mover ejercicio hacia abajo"
                            disabled={index === (plannedExercises?.length ?? 0) - 1}
                            onClick={() => void reorderPlannedExercise(pe.id, 'down').then(refreshPlannedExercises)}
                          >
                            ↓
                          </button>
                        </>
                      )}
                      {!dayLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            void setPlannedExerciseClosed(pe.id, !exerciseClosed).then(refreshPlannedExercises)
                          }
                        >
                          {exerciseClosed ? 'Reabrir ejercicio' : 'Cerrar ejercicio'}
                        </button>
                      )}
                      <ConfirmDeleteButton
                        label="Quitar"
                        confirmMessage="¿Quitar este ejercicio del plan?"
                        onConfirm={() =>
                          deletePlannedExercise(pe.id).then(async () => {
                            await Promise.all([refreshPlannedExercises(), refreshPlannedDayOptions()])
                          })
                        }
                      />
                    </div>
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
                          {s.dropSet === true && <span className="set-tag">drop</span>}
                          {s.restPause === true && <span className="set-tag">rest-pause</span>}
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
                              onConfirm={() => deletePlannedSet(s.id).then(refreshPlannedSets)}
                            />
                          </>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!locked && (
                    <div className="set-form set-form--plan">
                      <div className="set-form-line">
                        <input
                          autoComplete="off"
                          type="number"
                          inputMode="decimal"
                          className="set-form-field"
                          placeholder="Peso"
                          aria-label="Peso en kilos"
                          value={form.weight}
                          onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, weight: e.target.value } }))}
                        />
                        <input
                          autoComplete="off"
                          type="number"
                          inputMode="numeric"
                          step="1"
                          className="set-form-field"
                          placeholder="Reps"
                          aria-label="Repeticiones"
                          value={form.reps}
                          onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, reps: e.target.value } }))}
                        />
                        <input
                          autoComplete="off"
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          className="set-form-field"
                          placeholder="RPE"
                          aria-label="RPE"
                          value={form.rpe}
                          onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, rpe: e.target.value } }))}
                        />
                        <label className={form.dropSet ? 'set-chip set-chip--on' : 'set-chip'}>
                          <input
                            type="checkbox"
                            checked={form.dropSet}
                            onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, dropSet: e.target.checked } }))}
                          />
                          drop
                        </label>
                        <label className={form.restPause ? 'set-chip set-chip--on' : 'set-chip'}>
                          <input
                            type="checkbox"
                            checked={form.restPause}
                            onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, restPause: e.target.checked } }))}
                          />
                          rest-pause
                        </label>
                      </div>
                      <button
                        type="button"
                        className="add-set-button"
                        onClick={() => handleSubmitPlannedSet(pe.id)}
                        disabled={isSubmittingSet}
                      >
                        {editingId ? 'Guardar cambios' : `+ Agregar serie ${sets.length + 1}`}
                      </button>
                      {/* Repetir es el caso normal en fuerza: 3×5 al mismo peso
                          y RPE. Desde la segunda serie en adelante, claro: la
                          primera no tiene anterior que copiar. */}
                      {!editingId && sets.length > 0 && (
                        <button
                          type="button"
                          className="repeat-set-button"
                          onClick={() => handleRepeatPlannedSet(pe.id, sets[sets.length - 1])}
                          disabled={isSubmittingSet}
                        >
                          ⟳ Repetir serie {sets.length}
                        </button>
                      )}
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
            <form onSubmit={handleAddPlannedExercise} className="entity-form" autoComplete="off">
              <ExercisePicker value={newExerciseId} onChange={setNewExerciseId} />
              <input autoComplete="off" value={newExerciseNotes} onChange={(e) => setNewExerciseNotes(e.target.value)} placeholder="Notas (opcional)" />
              <button type="submit" disabled={isAddingExercise || !newExerciseId}>
                {newExerciseId
                  ? `Agregar ${exerciseName(newExerciseId)} al día`
                  : 'Elegí un ejercicio'}
              </button>
            </form>
          )}
        </section>
      )}

      {section === 'macrociclos' && !macrocycleId && (
        <section className="elevated-section">
          <h2>Macrociclos</h2>
          <ul className="entity-list">
            {macrocycles?.map((m) => (
              <li key={m.id} className="list-card">
                <button type="button" className="list-card-main" onClick={() => setMacrocycleId(m.id)}>
                  {m.name} — {formatDate(m.startDate)} a {formatDate(m.endDate)}
                </button>
                <div className="list-card-actions">
                  <button type="button" onClick={() => startEditMacro(m)}>
                    Editar
                  </button>
                  <ConfirmDeleteButton
                    confirmMessage={`¿Eliminar "${m.name}"? Sus mesociclos se borran y las semanas quedan sueltas, con todo lo planificado.`}
                    onConfirm={() =>
                      deleteMacrocycle(m.id).then(async () => {
                        await Promise.all([refreshMacrocycles(), refreshPlannedDayOptions()])
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="finance-add-button" onClick={openNewMacroForm}>+ Agregar macrociclo</button>
          {showMacroForm && (
            <BottomSheet title={editingMacroId ? 'Editar macrociclo' : 'Nuevo macrociclo'} onClose={resetMacroForm}>
            <form onSubmit={handleSubmitMacrocycle} className="entity-form" autoComplete="off">
              <input autoComplete="off" value={macroName} onChange={(e) => setMacroName(e.target.value)} placeholder="Nombre (ej. Prep. Nacional 2027)" required />
              <input autoComplete="off" value={macroGoal} onChange={(e) => setMacroGoal(e.target.value)} placeholder="Objetivo" />
              <label>
                Fecha de inicio
                <input autoComplete="off" type="date" value={macroStart} onChange={(e) => setMacroStart(e.target.value)} required />
              </label>
              <label>
                Fecha de fin
                <input autoComplete="off" type="date" value={macroEnd} onChange={(e) => setMacroEnd(e.target.value)} required />
              </label>
              <button type="submit" disabled={isCreatingMacro}>
                {editingMacroId ? 'Guardar cambios' : 'Crear macrociclo'}
              </button>
              <button type="button" onClick={resetMacroForm}>Cancelar</button>
            </form>
            </BottomSheet>
          )}
        </section>
      )}

      {section === 'macrociclos' && selectedMacrocycle && !mesocycleId && (
        <section className="elevated-section">
          <h2>Calendario</h2>
          <MacroCalendar
            macrocycle={selectedMacrocycle}
            onOpenDay={openDayFromCalendar}
            onOpenMesocycle={setMesocycleId}
          />
        </section>
      )}

      {section === 'macrociclos' && macrocycleId && !mesocycleId && (
        <section className="elevated-section">
          <h2>Mesociclos de {selectedMacrocycle?.name}</h2>
          <ul className="entity-list">
            {mesocycles?.map((m) => (
              <li key={m.id} className="list-card">
                <button type="button" className="list-card-main" onClick={() => setMesocycleId(m.id)}>
                  {m.name} ({PHASE_LABELS[m.phaseType]}) — {formatDate(m.startDate)} a {formatDate(m.endDate)}
                </button>
                <div className="list-card-actions">
                  <button type="button" onClick={() => startEditMeso(m)}>
                    Editar
                  </button>
                  <ConfirmDeleteButton
                    confirmMessage={`¿Eliminar "${m.name}"? Sus semanas quedan sueltas, con todo lo planificado.`}
                    onConfirm={() =>
                      deleteMesocycle(m.id).then(async () => {
                        await Promise.all([refreshMesocycles(), refreshPlannedDayOptions()])
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="finance-add-button" onClick={openNewMesoForm}>+ Agregar mesociclo</button>
          {showMesoForm && (
            <BottomSheet title={editingMesoId ? 'Editar mesociclo' : 'Nuevo mesociclo'} onClose={resetMesoForm}>
            <form onSubmit={handleSubmitMesocycle} className="entity-form" autoComplete="off">
              <input autoComplete="off" value={mesoName} onChange={(e) => setMesoName(e.target.value)} placeholder="Nombre (ej. Bloque 1)" required />
              <select autoComplete="off" value={mesoPhase} onChange={(e) => setMesoPhase(e.target.value as PhaseType)}>
                {Object.entries(PHASE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <label>
                Fecha de inicio
                <input autoComplete="off" type="date" value={mesoStart} onChange={(e) => setMesoStart(e.target.value)} required />
              </label>
              <label>
                Fecha de fin
                <input autoComplete="off" type="date" value={mesoEnd} onChange={(e) => setMesoEnd(e.target.value)} required />
              </label>
              <button type="submit" disabled={isCreatingMeso}>
                {editingMesoId ? 'Guardar cambios' : 'Crear mesociclo'}
              </button>
              <button type="button" onClick={resetMesoForm}>Cancelar</button>
            </form>
            </BottomSheet>
          )}
        </section>
      )}

      {section === 'macrociclos' && mesocycleId && (
        <section className="elevated-section">
          <h2>Semanas de {selectedMesocycle?.name}</h2>
          <ul className="entity-list">
            {weeks?.map((w) => (
              <li key={w.id} className="list-card">
                <button
                  type="button"
                  className="list-card-main"
                  onClick={() => {
                    setSection('semanas')
                    setWeekId(w.id)
                    setDayId(null)
                  }}
                >
                  {formatWeekRange(w)}
                </button>
                <div className="list-card-actions">
                  <button
                    type="button"
                    className="list-row-secondary"
                    onClick={() => void handleChangeWeekMesocycle(w.id, '')}
                  >
                    Soltar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {weeks?.length === 0 && <p className="empty-hint">Todavía no hay semanas en este mesociclo.</p>}
          {(allWeeks ?? []).some((w) => w.mesocycleId !== mesocycleId) && (
            <label>
              Enlazar una semana
              <select
                autoComplete="off"
                value=""
                onChange={(e) =>
                  e.target.value && void handleChangeWeekMesocycle(e.target.value, mesocycleId as string)
                }
              >
                <option value="">Elegí una semana…</option>
                {(allWeeks ?? [])
                  .filter((w) => w.mesocycleId !== mesocycleId)
                  .map((w) => {
                    const other = allMesocycles?.find((m) => m.id === w.mesocycleId)
                    return (
                      <option key={w.id} value={w.id}>
                        {formatWeekRange(w)} · {other ? other.name : 'Sin mesociclo'}
                      </option>
                    )
                  })}
              </select>
            </label>
          )}
        </section>
      )}
    </div>
  )
}
