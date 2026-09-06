import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  addExerciseToSlot,
  getBlockGridData,
  listPlannedSets,
  pinExerciseAcrossBlock,
  setUniformPrescription,
} from '../db/planningRepository'
import { listExercises } from '../db/trainingRepository'
import type { Exercise } from '../domain/types'
import { buildBlockGrid, type GridCell, type GridDaySlot, type GridRow } from '../lib/blockGrid'

/** `lun 3` — la fecha corta que cabe en la cabecera de una columna. */
function shortDate(iso: string): string {
  const d = new Date(iso)
  const weekday = d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')
  return `${weekday} ${d.getDate()}`
}

interface EditorTarget {
  slot: GridDaySlot
  row: GridRow
  cell: GridCell
  weekIndex: number
}

interface BlockGridProps {
  mesocycleId: string
  mesocycleName: string
  /** Para saltar del detalle de una celda a la planificación serie a serie. */
  onOpenDay: (weekId: string, dayId: string) => void
}

export function BlockGrid({ mesocycleId, mesocycleName, onOpenDay }: BlockGridProps) {
  const data = useLiveQuery(() => getBlockGridData(mesocycleId), [mesocycleId])
  const exercises = useLiveQuery(() => listExercises(), [])
  const [editing, setEditing] = useState<EditorTarget | null>(null)
  const [adding, setAdding] = useState<{ slot: GridDaySlot; weekIndex: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!data || !exercises) return <p className="empty-hint">Cargando la planilla…</p>

  const grid = buildBlockGrid(
    data.weeks,
    data.days,
    data.plannedExercises,
    data.plannedSets,
    exercises,
  )

  if (grid.weeks.length === 0) {
    return (
      <p className="empty-hint">
        Este bloque todavía no tiene semanas. Crea la primera y sus días para ver la planilla.
      </p>
    )
  }

  async function handleAddExercise(exerciseId: string) {
    if (!adding) return
    const week = grid.weeks[adding.weekIndex]
    const created = await addExerciseToSlot(week.id, adding.slot.slotIndex, exerciseId)
    if (!created) setNotice('Esa semana no tiene ese día, así que no se pudo añadir.')
    setAdding(null)
  }

  return (
    <>
      <p className="empty-hint">
        Todo {mesocycleName} de un vistazo: cada fila es un ejercicio y cada columna una semana,
        así la progresión se lee de corrido. Toca una celda para editarla.
      </p>

      {notice && (
        <p className="grid-notice" role="status">
          {notice}{' '}
          <button type="button" className="grid-notice-dismiss" onClick={() => setNotice(null)}>
            Ocultar
          </button>
        </p>
      )}

      <div className="block-grid-scroll">
        <table className="block-grid">
          <thead>
            <tr>
              <th className="block-grid-corner" scope="col">
                <span className="sr-only">Ejercicio</span>
              </th>
              {grid.weeks.map((week, index) => (
                <th key={week.id} scope="col">
                  S{index + 1}
                </th>
              ))}
            </tr>
          </thead>

          {grid.slots.map((slot) => (
            <tbody key={slot.slotIndex}>
              <tr className="block-grid-slot">
                <th className="block-grid-corner" scope="row">
                  {slot.label}
                </th>
                {slot.dates.map((date, index) => (
                  <td key={grid.weeks[index].id}>
                    {date ? (
                      <button
                        type="button"
                        className="block-grid-date"
                        onClick={() =>
                          onOpenDay(grid.weeks[index].id, slot.dayIds[index] as string)
                        }
                      >
                        {shortDate(date)}
                      </button>
                    ) : (
                      <span className="block-grid-missing">—</span>
                    )}
                  </td>
                ))}
              </tr>

              {slot.rows.length === 0 && (
                <tr>
                  <th className="block-grid-corner block-grid-name" scope="row">
                    <span className="empty-hint">Sin ejercicios</span>
                  </th>
                  {grid.weeks.map((week, index) => (
                    <td key={week.id}>
                      {slot.dayIds[index] && (
                        <button
                          type="button"
                          className="block-grid-cell block-grid-cell--empty"
                          aria-label={`Añadir un ejercicio a ${slot.label}, semana ${index + 1}`}
                          onClick={() => setAdding({ slot, weekIndex: index })}
                        >
                          +
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {slot.rows.map((row) => (
                <tr key={row.exerciseId}>
                  <th className="block-grid-corner block-grid-name" scope="row">
                    {row.exerciseName}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={cell.weekId}>
                      {cell.plannedExerciseId ? (
                        <button
                          type="button"
                          className="block-grid-cell"
                          aria-label={`${row.exerciseName}, semana ${index + 1}: ${
                            cell.volume || 'sin series'
                          } ${cell.intensity}`}
                          onClick={() => setEditing({ slot, row, cell, weekIndex: index })}
                        >
                          <span className="block-grid-volume">{cell.volume || '—'}</span>
                          {cell.intensity && (
                            <span className="block-grid-intensity">{cell.intensity}</span>
                          )}
                        </button>
                      ) : slot.dayIds[index] ? (
                        <button
                          type="button"
                          className="block-grid-cell block-grid-cell--empty"
                          aria-label={`Añadir ${row.exerciseName} a la semana ${index + 1}`}
                          onClick={() =>
                            void addExerciseToSlot(
                              grid.weeks[index].id,
                              slot.slotIndex,
                              row.exerciseId,
                            )
                          }
                        >
                          +
                        </button>
                      ) : (
                        <span className="block-grid-missing">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              <tr className="block-grid-add-row">
                <th className="block-grid-corner" scope="row">
                  <button
                    type="button"
                    className="block-grid-add"
                    onClick={() => setAdding({ slot, weekIndex: 0 })}
                  >
                    + Ejercicio
                  </button>
                </th>
                {grid.weeks.map((week) => (
                  <td key={week.id} />
                ))}
              </tr>
            </tbody>
          ))}
        </table>
      </div>

      {adding && (
        <ExercisePicker
          exercises={exercises}
          slotLabel={adding.slot.label}
          weekNumber={adding.weekIndex + 1}
          onPick={(id) => void handleAddExercise(id)}
          onCancel={() => setAdding(null)}
        />
      )}

      {editing && (
        <CellEditor
          key={editing.cell.plannedExerciseId as string}
          target={editing}
          mesocycleId={mesocycleId}
          onClose={() => setEditing(null)}
          onNotice={setNotice}
          onOpenDay={onOpenDay}
        />
      )}
    </>
  )
}

interface ExercisePickerProps {
  exercises: Exercise[]
  slotLabel: string
  weekNumber: number
  onPick: (exerciseId: string) => void
  onCancel: () => void
}

function ExercisePicker({
  exercises,
  slotLabel,
  weekNumber,
  onPick,
  onCancel,
}: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const matches = exercises
    .filter((e) => e.type === 'strength')
    .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <section className="grid-sheet">
      <h3>
        Añadir a {slotLabel} · Semana {weekNumber}
      </h3>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ejercicio…"
        aria-label="Buscar ejercicio"
        autoFocus
      />
      <div className="grid-sheet-list">
        {matches.length === 0 && <p className="empty-hint">Nada coincide con esa búsqueda.</p>}
        {matches.map((exercise) => (
          <button key={exercise.id} type="button" onClick={() => onPick(exercise.id)}>
            {exercise.name}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
    </section>
  )
}

interface CellEditorProps {
  target: EditorTarget
  mesocycleId: string
  onClose: () => void
  onNotice: (message: string) => void
  onOpenDay: (weekId: string, dayId: string) => void
}

function CellEditor({ target, mesocycleId, onClose, onNotice, onOpenDay }: CellEditorProps) {
  const { slot, row, cell, weekIndex } = target
  const plannedExerciseId = cell.plannedExerciseId as string
  const sets = useLiveQuery(() => listPlannedSets(plannedExerciseId), [plannedExerciseId])
  const { isSubmitting, guard } = useSubmitGuard()
  const [error, setError] = useState<string | null>(null)

  // El formulario arranca desde lo que ya hay: la primera serie representa a
  // todas, que es justamente la prescripción uniforme que se edita acá.
  const first = sets?.[0]
  const [form, setForm] = useState<{
    sets: string
    reps: string
    weight: string
    rpe: string
  } | null>(null)
  const current = form ?? {
    sets: sets ? String(sets.length || 3) : '3',
    reps: first ? String(first.targetReps) : '5',
    weight: first?.targetWeightKg !== null && first?.targetWeightKg !== undefined
      ? String(first.targetWeightKg)
      : '',
    rpe: first?.targetRpe !== null && first?.targetRpe !== undefined ? String(first.targetRpe) : '',
  }
  const update = (patch: Partial<typeof current>) => setForm({ ...current, ...patch })

  function parseOptional(value: string): number | null {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function handleSave(pin: boolean) {
    setError(null)
    await guard(async () => {
      try {
        const setCount = Number(current.sets)
        const reps = Number(current.reps)
        if (!Number.isInteger(setCount) || setCount < 1) {
          throw new Error('Las series tienen que ser un entero de 1 o más.')
        }
        if (!Number.isInteger(reps) || reps < 1) {
          throw new Error('Las repeticiones tienen que ser un entero de 1 o más.')
        }
        await setUniformPrescription(plannedExerciseId, {
          sets: setCount,
          reps,
          weightKg: parseOptional(current.weight),
          rpe: parseOptional(current.rpe),
          restSecondsTarget: first?.restSecondsTarget ?? null,
        })
        if (pin) {
          const result = await pinExerciseAcrossBlock(
            mesocycleId,
            slot.slotIndex,
            row.exerciseId,
            plannedExerciseId,
          )
          onNotice(
            result.skipped === 0
              ? `${row.exerciseName} quedó igual en ${slot.label} de las ${result.applied} semanas.`
              : `${row.exerciseName} se aplicó en ${result.applied} semanas. ${result.skipped} no tienen ${slot.label}.`,
          )
        }
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  const date = slot.dates[weekIndex]

  return (
    <section className="grid-sheet">
      <h3>{row.exerciseName}</h3>
      <p className="grid-sheet-context">
        {slot.label} · Semana {weekIndex + 1}
        {date && ` · ${shortDate(date)}`}
      </p>

      <div className="grid-sheet-fields">
        <label>
          Series
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={current.sets}
            onChange={(e) => update({ sets: e.target.value })}
          />
        </label>
        <label>
          Reps
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={current.reps}
            onChange={(e) => update({ reps: e.target.value })}
          />
        </label>
        <label>
          Peso (kg)
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={current.weight}
            onChange={(e) => update({ weight: e.target.value })}
          />
        </label>
        <label>
          RPE
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={current.rpe}
            onChange={(e) => update({ rpe: e.target.value })}
          />
        </label>
      </div>

      <p className="grid-sheet-note">
        Guarda las series iguales entre sí. Para que varíen una a una, edítalas en el día.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="grid-sheet-actions">
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => void handleSave(true)}>
          Guardar y fijar en el bloque
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => void handleSave(false)}>
          Guardar
        </button>
      </div>

      {cell.dayId && (
        <button
          type="button"
          className="grid-sheet-link"
          onClick={() => onOpenDay(cell.weekId, cell.dayId as string)}
        >
          Editar serie por serie en el día →
        </button>
      )}
    </section>
  )
}
