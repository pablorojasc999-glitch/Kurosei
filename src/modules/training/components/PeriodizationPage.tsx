import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../shared/db/database'
import {
  createDay,
  createMacrocycle,
  createMesocycle,
  createPlannedExercise,
  createPlannedSet,
  createWeek,
  deletePlannedExercise,
  deletePlannedSet,
  duplicateWeek,
} from '../db/planningRepository'
import { SessionView } from './SessionView'
import type {
  Day,
  Mesocycle,
  PhaseType,
  PlannedExercise,
  Week,
} from '../domain/types'

const PHASE_LABELS: Record<PhaseType, string> = {
  accumulation: 'Acumulación',
  intensification: 'Intensificación',
  peaking: 'Peaking',
  deload: 'Deload',
  custom: 'Personalizado',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function PeriodizationPage() {
  const [macrocycleId, setMacrocycleId] = useState<string | null>(null)
  const [mesocycleId, setMesocycleId] = useState<string | null>(null)
  const [weekId, setWeekId] = useState<string | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)
  const [dayView, setDayView] = useState<'plan' | 'session'>('plan')

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

  const selectedMacrocycle = macrocycles?.find((m) => m.id === macrocycleId)
  const selectedMesocycle = mesocycles?.find((m) => m.id === mesocycleId)
  const selectedWeek = weeks?.find((w) => w.id === weekId)

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

  const [newExerciseId, setNewExerciseId] = useState('')
  const [newExerciseNotes, setNewExerciseNotes] = useState('')

  const [setForms, setSetForms] = useState<
    Record<string, { weight: string; reps: string; rpe: string; rest: string }>
  >({})

  async function handleCreateMacrocycle(e: React.FormEvent) {
    e.preventDefault()
    if (!macroName || !macroStart || !macroEnd) return
    const m = await createMacrocycle({
      name: macroName,
      goal: macroGoal,
      startDate: new Date(macroStart).toISOString(),
      endDate: new Date(macroEnd).toISOString(),
    })
    setMacroName('')
    setMacroGoal('')
    setMacroStart('')
    setMacroEnd('')
    setMacrocycleId(m.id)
  }

  async function handleCreateMesocycle(e: React.FormEvent) {
    e.preventDefault()
    if (!macrocycleId || !mesoName || !mesoStart || !mesoEnd) return
    const m = await createMesocycle({
      macrocycleId,
      name: mesoName,
      phaseType: mesoPhase,
      startDate: new Date(mesoStart).toISOString(),
      endDate: new Date(mesoEnd).toISOString(),
    })
    setMesoName('')
    setMesoPhase('accumulation')
    setMesoStart('')
    setMesoEnd('')
    setMesocycleId(m.id)
  }

  async function handleCreateWeek() {
    if (!mesocycleId) return
    const w = await createWeek(mesocycleId)
    setWeekId(w.id)
  }

  async function handleDuplicateWeek(sourceWeekId: string) {
    const w = await duplicateWeek(sourceWeekId)
    setWeekId(w.id)
  }

  async function handleCreateDay(e: React.FormEvent) {
    e.preventDefault()
    if (!weekId || !dayDate) return
    const d = await createDay({
      weekId,
      date: new Date(dayDate).toISOString(),
      label: dayLabel,
    })
    setDayDate('')
    setDayLabel('')
    setDayId(d.id)
  }

  async function handleAddPlannedExercise(e: React.FormEvent) {
    e.preventDefault()
    if (!dayId || !newExerciseId) return
    await createPlannedExercise({
      dayId,
      exerciseId: newExerciseId,
      notes: newExerciseNotes,
    })
    setNewExerciseId('')
    setNewExerciseNotes('')
  }

  async function handleAddPlannedSet(plannedExerciseId: string) {
    const form = setForms[plannedExerciseId]
    if (!form || !form.reps) return
    await createPlannedSet({
      plannedExerciseId,
      targetWeightKg: form.weight ? Number(form.weight) : null,
      targetReps: Number(form.reps),
      targetRpe: form.rpe ? Number(form.rpe) : null,
      restSecondsTarget: form.rest ? Number(form.rest) : null,
    })
    setSetForms((prev) => ({
      ...prev,
      [plannedExerciseId]: { weight: '', reps: '', rpe: '', rest: '' },
    }))
  }

  function exerciseName(id: string): string {
    return exercisesLibrary?.find((e) => e.id === id)?.name ?? '?'
  }

  return (
    <div className="page">
      <h1>Periodización</h1>

      <nav className="breadcrumb">
        <button type="button" onClick={() => { setMacrocycleId(null); setMesocycleId(null); setWeekId(null); setDayId(null) }}>
          Macrociclos
        </button>
        {selectedMacrocycle && (
          <>
            {' / '}
            <button type="button" onClick={() => { setMesocycleId(null); setWeekId(null); setDayId(null) }}>
              {selectedMacrocycle.name}
            </button>
          </>
        )}
        {selectedMesocycle && (
          <>
            {' / '}
            <button type="button" onClick={() => { setWeekId(null); setDayId(null) }}>
              {selectedMesocycle.name}
            </button>
          </>
        )}
        {selectedWeek && (
          <>
            {' / '}
            <button type="button" onClick={() => setDayId(null)}>
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
              <li key={m.id}>
                <button type="button" onClick={() => setMacrocycleId(m.id)}>
                  {m.name} — {formatDate(m.startDate)} a {formatDate(m.endDate)}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateMacrocycle} className="entity-form">
            <input value={macroName} onChange={(e) => setMacroName(e.target.value)} placeholder="Nombre (ej. Prep. Nacional 2027)" required />
            <input value={macroGoal} onChange={(e) => setMacroGoal(e.target.value)} placeholder="Objetivo" />
            <input type="date" value={macroStart} onChange={(e) => setMacroStart(e.target.value)} required />
            <input type="date" value={macroEnd} onChange={(e) => setMacroEnd(e.target.value)} required />
            <button type="submit">Crear macrociclo</button>
          </form>
        </section>
      )}

      {macrocycleId && !mesocycleId && (
        <section>
          <h2>Mesociclos de {selectedMacrocycle?.name}</h2>
          <ul className="entity-list">
            {mesocycles?.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setMesocycleId(m.id)}>
                  {m.name} ({PHASE_LABELS[m.phaseType]}) — {formatDate(m.startDate)} a {formatDate(m.endDate)}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateMesocycle} className="entity-form">
            <input value={mesoName} onChange={(e) => setMesoName(e.target.value)} placeholder="Nombre (ej. Bloque 1)" required />
            <select value={mesoPhase} onChange={(e) => setMesoPhase(e.target.value as PhaseType)}>
              {Object.entries(PHASE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input type="date" value={mesoStart} onChange={(e) => setMesoStart(e.target.value)} required />
            <input type="date" value={mesoEnd} onChange={(e) => setMesoEnd(e.target.value)} required />
            <button type="submit">Crear mesociclo</button>
          </form>
        </section>
      )}

      {mesocycleId && !weekId && (
        <section>
          <h2>Semanas de {selectedMesocycle?.name}</h2>
          <ul className="entity-list">
            {weeks?.map((w) => (
              <li key={w.id} className="week-row">
                <button type="button" onClick={() => setWeekId(w.id)}>
                  Semana {w.order + 1}
                </button>
                <button type="button" onClick={() => handleDuplicateWeek(w.id)}>
                  Duplicar como punto de partida
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleCreateWeek}>+ Agregar semana</button>
        </section>
      )}

      {weekId && !dayId && (
        <section>
          <h2>Días de la semana {selectedWeek ? selectedWeek.order + 1 : ''}</h2>
          <ul className="entity-list">
            {days?.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setDayId(d.id)}>
                  {formatDate(d.date)} — {d.label || 'Sin etiqueta'}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateDay} className="entity-form">
            <input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} required />
            <input value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} placeholder="Etiqueta (ej. Tren superior)" />
            <button type="submit">Agregar día</button>
          </form>
        </section>
      )}

      {dayId && (
        <section>
          <div className="sub-tabs">
            <button
              type="button"
              className={dayView === 'plan' ? 'active' : ''}
              onClick={() => setDayView('plan')}
            >
              Plan
            </button>
            <button
              type="button"
              className={dayView === 'session' ? 'active' : ''}
              onClick={() => setDayView('session')}
            >
              Sesión
            </button>
          </div>

          {dayView === 'session' && <SessionView dayId={dayId} />}
        </section>
      )}

      {dayId && dayView === 'plan' && (
        <section>
          <h2>Plan del día</h2>
          <ul className="planned-exercise-list">
            {plannedExercises?.map((pe) => {
              const sets = plannedSets?.filter((ps) => ps.plannedExerciseId === pe.id) ?? []
              const form = setForms[pe.id] ?? { weight: '', reps: '', rpe: '', rest: '' }
              return (
                <li key={pe.id} className="planned-exercise-item">
                  <div className="planned-exercise-header">
                    <strong>{exerciseName(pe.exerciseId)}</strong>
                    {pe.notes && <span className="notes"> — {pe.notes}</span>}
                    <button type="button" onClick={() => deletePlannedExercise(pe.id)}>Quitar</button>
                  </div>
                  <ul className="sets-list">
                    {sets.map((s) => (
                      <li key={s.id} className="set-row">
                        <span className="set-number">{s.setNumber}</span>
                        <span className="set-summary">
                          {s.targetWeightKg ?? '-'} kg × {s.targetReps}
                          {s.targetRpe !== null && ` · RPE ${s.targetRpe}`}
                          {s.restSecondsTarget !== null && ` · ${s.restSecondsTarget}s`}
                        </span>
                        <button type="button" className="icon-button" onClick={() => deletePlannedSet(s.id)}>×</button>
                      </li>
                    ))}
                  </ul>

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
                      Descanso (s)
                      <input type="number" inputMode="numeric" value={form.rest} onChange={(e) => setSetForms((prev) => ({ ...prev, [pe.id]: { ...form, rest: e.target.value } }))} />
                    </label>
                    <button type="button" className="add-set-button" onClick={() => handleAddPlannedSet(pe.id)}>
                      + Agregar serie {sets.length + 1}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <form onSubmit={handleAddPlannedExercise} className="entity-form">
            <select value={newExerciseId} onChange={(e) => setNewExerciseId(e.target.value)} required>
              <option value="">Elegir ejercicio</option>
              {exercisesLibrary?.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <input value={newExerciseNotes} onChange={(e) => setNewExerciseNotes(e.target.value)} placeholder="Notas (opcional)" />
            <button type="submit">Agregar ejercicio al día</button>
          </form>
        </section>
      )}
    </div>
  )
}
