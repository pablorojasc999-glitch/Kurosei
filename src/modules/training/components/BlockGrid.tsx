import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  addExerciseToSlot,
  getBlockGridData,
  pinExerciseAcrossBlock,
  setPlannedSets,
} from '../db/planningRepository'
import { listExercises } from '../db/trainingRepository'
import type { Exercise } from '../domain/types'
import {
  buildBlockGrid,
  formatSet,
  type GridCell,
  type GridDaySlot,
  type GridRow,
  type GridSet,
} from '../lib/blockGrid'

/** `lun 3` — la fecha corta que cabe en la cabecera de una columna. */
function shortDate(iso: string): string {
  const d = new Date(iso)
  const weekday = d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')
  return `${weekday} ${d.getDate()}`
}

interface CellRef {
  slot: GridDaySlot
  row: GridRow
  cell: GridCell
  weekIndex: number
}

interface BlockGridProps {
  mesocycleId: string
  mesocycleName: string
  /** Para saltar del detalle de una celda al día completo. */
  onOpenDay: (weekId: string, dayId: string) => void
}

export function BlockGrid({ mesocycleId, mesocycleName, onOpenDay }: BlockGridProps) {
  const data = useLiveQuery(() => getBlockGridData(mesocycleId), [mesocycleId])
  const exercises = useLiveQuery(() => listExercises(), [])
  const [editing, setEditing] = useState<CellRef | null>(null)
  const [adding, setAdding] = useState<{ slot: GridDaySlot; weekIndex: number } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)

  if (!data || !exercises) return <p className="empty-hint">Cargando la planilla…</p>

  const grid = buildBlockGrid({ ...data, exercises })

  if (grid.weeks.length === 0) {
    return (
      <p className="empty-hint">
        Este bloque todavía no tiene semanas. Crea la primera y sus días para ver la planilla.
      </p>
    )
  }

  const rowKey = (slot: GridDaySlot, row: GridRow) => `${slot.slotIndex}:${row.exerciseId}`

  function toggleRow(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
        Todo {mesocycleName} de un vistazo: cada fila es un ejercicio y cada columna una semana.
        Toca el nombre para desplegar sus series, o una celda para editarla.
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
        <table className={`block-grid${expanded.size > 0 ? ' block-grid--detail' : ''}`}>
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

              {slot.rows.map((row) => {
                const key = rowKey(slot, row)
                const open = expanded.has(key)
                return (
                  <tr key={row.exerciseId} className={open ? 'block-grid-row--open' : undefined}>
                    <th className="block-grid-corner block-grid-name" scope="row">
                      <button
                        type="button"
                        className="block-grid-name-toggle"
                        aria-expanded={open}
                        onClick={() => toggleRow(key)}
                      >
                        <span className="block-grid-caret" aria-hidden="true">
                          {open ? '▾' : '▸'}
                        </span>
                        {row.exerciseName}
                      </button>
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={cell.weekId}>
                        {cell.plannedExerciseId ? (
                          <button
                            type="button"
                            className={`block-grid-cell${open ? ' block-grid-cell--open' : ''}`}
                            aria-label={`${row.exerciseName}, semana ${index + 1}: ${
                              cell.planned.volume || 'sin series'
                            } ${cell.planned.intensity}`}
                            onClick={() => setEditing({ slot, row, cell, weekIndex: index })}
                          >
                            {open ? (
                              <CellDetail cell={cell} />
                            ) : (
                              <>
                                <span className="block-grid-volume">
                                  {cell.planned.volume || '—'}
                                </span>
                                {cell.planned.intensity && (
                                  <span className="block-grid-intensity">
                                    {cell.planned.intensity}
                                  </span>
                                )}
                                {cell.executedSets.length > 0 && (
                                  <span className="block-grid-done">
                                    ✓ {cell.executed.volume}
                                  </span>
                                )}
                              </>
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
                )
              })}

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

/** El contenido de una celda desplegada: el plan serie a serie y, debajo, lo que se hizo. */
function CellDetail({ cell }: { cell: GridCell }) {
  return (
    <>
      {cell.plannedSets.length === 0 && <span className="block-grid-volume">—</span>}
      {cell.plannedSets.map((set, index) => (
        <span key={index} className="block-grid-set">
          {formatSet(set)}
        </span>
      ))}
      {cell.executedSets.length > 0 && (
        <>
          <span className="block-grid-set-rule" aria-hidden="true" />
          {cell.executedSets.map((set, index) => (
            <span key={index} className="block-grid-set block-grid-set--done">
              {formatSet(set)}
            </span>
          ))}
        </>
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
    <BottomSheet
      title="Añadir ejercicio"
      subtitle={`${slotLabel} · Semana ${weekNumber}`}
      onClose={onCancel}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ejercicio…"
        aria-label="Buscar ejercicio"
        autoFocus
      />
      <div className="sheet-list">
        {matches.length === 0 && <p className="empty-hint">Nada coincide con esa búsqueda.</p>}
        {matches.map((exercise) => (
          <button key={exercise.id} type="button" onClick={() => onPick(exercise.id)}>
            {exercise.name}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

/** Una serie del formulario: se guarda como texto para poder dejar campos a medio escribir. */
interface SetDraft {
  weight: string
  reps: string
  rpe: string
}

function toDraft(set: GridSet): SetDraft {
  return {
    weight: set.weightKg !== null ? String(set.weightKg) : '',
    reps: String(set.reps),
    rpe: set.rpe !== null ? String(set.rpe) : '',
  }
}

function parseOptional(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

interface CellEditorProps {
  target: CellRef
  mesocycleId: string
  onClose: () => void
  onNotice: (message: string) => void
  onOpenDay: (weekId: string, dayId: string) => void
}

function CellEditor({ target, mesocycleId, onClose, onNotice, onOpenDay }: CellEditorProps) {
  const { slot, row, cell, weekIndex } = target
  const plannedExerciseId = cell.plannedExerciseId as string
  const { isSubmitting, guard } = useSubmitGuard()
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<SetDraft[]>(() =>
    cell.plannedSets.length > 0
      ? cell.plannedSets.map(toDraft)
      : [{ weight: '', reps: '5', rpe: '' }],
  )

  function updateSet(index: number, patch: Partial<SetDraft>) {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function addSet() {
    setDrafts((current) => [...current, { ...(current[current.length - 1] ?? { weight: '', reps: '5', rpe: '' }) }])
  }

  function removeSet(index: number) {
    setDrafts((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current))
  }

  /** Iguala todas las series a la primera — el atajo para la prescripción uniforme. */
  function levelAll() {
    setDrafts((current) => current.map(() => ({ ...current[0] })))
  }

  async function handleSave(pin: boolean) {
    setError(null)
    await guard(async () => {
      try {
        const rows = drafts.map((d) => {
          const reps = Number(d.reps)
          if (!Number.isInteger(reps) || reps < 1) {
            throw new Error('Cada serie necesita un número entero de repeticiones, 1 o más.')
          }
          return {
            targetWeightKg: parseOptional(d.weight),
            targetReps: reps,
            targetRpe: parseOptional(d.rpe),
            restSecondsTarget: null,
          }
        })
        await setPlannedSets(plannedExerciseId, rows)
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
    <BottomSheet
      title={row.exerciseName}
      subtitle={`${slot.label} · Semana ${weekIndex + 1}${date ? ` · ${shortDate(date)}` : ''}`}
      onClose={onClose}
    >
      <div className="set-editor">
          <div className="set-editor-head" aria-hidden="true">
            <span>#</span>
            <span>Peso</span>
            <span>Reps</span>
            <span>RPE</span>
            <span />
          </div>
          {drafts.map((draft, index) => (
            <div key={index} className="set-editor-row">
              <span className="set-editor-number">{index + 1}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={draft.weight}
                aria-label={`Peso de la serie ${index + 1}`}
                onChange={(e) => updateSet(index, { weight: e.target.value })}
              />
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={draft.reps}
                aria-label={`Repeticiones de la serie ${index + 1}`}
                onChange={(e) => updateSet(index, { reps: e.target.value })}
              />
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={draft.rpe}
                aria-label={`RPE de la serie ${index + 1}`}
                onChange={(e) => updateSet(index, { rpe: e.target.value })}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Quitar la serie ${index + 1}`}
                disabled={drafts.length === 1}
                onClick={() => removeSet(index)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="set-editor-tools">
          <button type="button" onClick={addSet}>
            + Serie
          </button>
          <button type="button" onClick={levelAll} disabled={drafts.length < 2}>
            Igualar a la 1ª
          </button>
        </div>

        {cell.executedSets.length > 0 && (
          <div className="set-editor-done">
            <span className="set-editor-done-title">Lo que hiciste</span>
            {cell.executedSets.map((set, index) => (
              <span key={index} className="set-editor-done-row">
                {index + 1}. {formatSet(set)}
              </span>
            ))}
          </div>
        )}

      {error && <p className="error">{error}</p>}

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => void handleSave(true)}>
          Guardar y fijar
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => void handleSave(false)}>
          Guardar
        </button>
      </div>

      {cell.dayId && (
        <button
          type="button"
          className="sheet-link"
          onClick={() => onOpenDay(cell.weekId, cell.dayId as string)}
        >
          Abrir el día completo →
        </button>
      )}
    </BottomSheet>
  )
}
