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
import { toDateKey } from '../lib/calendarGrid'
import {
  buildBlockGrid,
  compareSets,
  currentWeekIndex,
  executedMatchesPlan,
  formatSet,
  setMatchesPlan,
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
  /** Para saltar del detalle de una celda al día completo. */
  onOpenDay: (weekId: string, dayId: string) => void
}

export function BlockGrid({ mesocycleId, onOpenDay }: BlockGridProps) {
  const data = useLiveQuery(() => getBlockGridData(mesocycleId), [mesocycleId])
  const exercises = useLiveQuery(() => listExercises(), [])
  const [editing, setEditing] = useState<CellRef | null>(null)
  const [adding, setAdding] = useState<{ slot: GridDaySlot; weekIndex: number } | null>(null)
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

  const thisWeek = currentWeekIndex(grid.slots, toDateKey(new Date()))

  async function handleAddExercise(exerciseId: string) {
    if (!adding) return
    const week = grid.weeks[adding.weekIndex]
    const created = await addExerciseToSlot(week.id, adding.slot.slotIndex, exerciseId)
    if (!created) setNotice('Esa semana no tiene ese día, así que no se pudo añadir.')
    setAdding(null)
  }

  return (
    <>
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
                <th
                  key={week.id}
                  scope="col"
                  className={index === thisWeek ? 'block-grid-week--current' : undefined}
                >
                  S{index + 1}
                  {index === thisWeek && <span className="sr-only"> (semana en curso)</span>}
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
                return (
                  <tr key={row.exerciseId}>
                    <th className="block-grid-corner block-grid-name" scope="row">
                      <span className="block-grid-name-text" title={row.exerciseName}>
                        {row.exerciseName}
                      </span>
                    </th>
                    {row.cells.map((cell, index) => {
                      const done = cell.executedSets.length > 0
                      const asPlanned =
                        done && executedMatchesPlan(cell.plannedSets, cell.executedSets)
                      // Cuando te saliste del plan, manda lo que hiciste: es el dato
                      // nuevo. Si lo cumpliste, el plan y lo hecho dicen lo mismo.
                      const shown = done && !asPlanned ? cell.executed : cell.planned
                      const state = !done ? '' : asPlanned ? ' block-grid-cell--done' : ' block-grid-cell--differs'
                      // El pie dice cuántas series cuando el titular es un rango:
                      // sin eso, "8-10" no distingue tres series de diez.
                      const footnote = shown.varied ? `×${shown.sets}` : shown.intensity
                      return (
                      <td key={cell.weekId}>
                        {cell.plannedExerciseId ? (
                          <button
                            type="button"
                            className={`block-grid-cell${state}${
                              index === thisWeek ? ' block-grid-cell--current' : ''
                            }`}
                            aria-label={`${row.exerciseName}, semana ${index + 1}: ${
                              cell.planned.volume || 'sin series'
                            }${done ? (asPlanned ? ', hecho tal cual' : `, hiciste ${cell.executed.volume}`) : ''}`}
                            onClick={() => setEditing({ slot, row, cell, weekIndex: index })}
                          >
                            <span className="block-grid-volume">{shown.volume || '—'}</span>
                            {footnote && (
                              <span className="block-grid-intensity">{footnote}</span>
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
                          // Esa semana no tiene ese día: un hueco lo dice mejor que
                          // un guion, que se confundía con el "+" de "falta añadirlo".
                          <span className="block-grid-gap" aria-hidden="true" />
                        )}
                      </td>
                      )
                    })}
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
                    + Ejercicio en S1
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

const sumReps = (sets: GridSet[]) => sets.reduce((total, set) => total + set.reps, 0)

/** La línea que se lee primero: si cumpliste el plan y, si no, en qué te saliste. */
function Verdict({ planned, executed }: { planned: GridSet[]; executed: GridSet[] }) {
  if (executedMatchesPlan(planned, executed)) {
    return (
      <p className="cell-verdict cell-verdict--done">
        Tal cual lo planeado: {planned.length}{' '}
        {planned.length === 1 ? 'serie' : 'series'}.
      </p>
    )
  }

  const delta = sumReps(executed) - sumReps(planned)
  return (
    <p className="cell-verdict cell-verdict--differs">
      {executed.length} de {planned.length} {planned.length === 1 ? 'serie' : 'series'} ·{' '}
      {delta === 0
        ? 'mismas reps en total'
        : `${delta > 0 ? '+' : ''}${delta} reps en total`}
    </p>
  )
}

/**
 * El plan y lo hecho en paralelo, una fila por serie.
 *
 * Antes eran dos listas separadas y en idiomas distintos —el plan como
 * formulario, lo hecho como texto— así que para saber si la tercera serie salió
 * como la planeaste había que contar en una y luego en la otra.
 */
function PlanVsDone({ planned, executed }: { planned: GridSet[]; executed: GridSet[] }) {
  const rows = compareSets(planned, executed)

  return (
    <div className="cell-compare">
      <div className="cell-compare-head" aria-hidden="true">
        <span>#</span>
        <span>Plan</span>
        <span>Hecho</span>
      </div>
      {rows.map((pair, index) => {
        const delta =
          pair.planned && pair.executed ? pair.executed.reps - pair.planned.reps : null
        // Se mira lo mismo que el veredicto —reps y peso— para que no diga que
        // te saliste mientras todas las filas salen en verde.
        const matches =
          pair.planned !== null &&
          pair.executed !== null &&
          setMatchesPlan(pair.planned, pair.executed)
        const state =
          pair.executed === null
            ? ' cell-compare-done--missing'
            : matches
              ? ' cell-compare-done--equal'
              : ' cell-compare-done--differs'
        return (
          <div key={index} className="cell-compare-row">
            <span className="cell-compare-number">{index + 1}</span>
            <span className="cell-compare-planned">
              {pair.planned ? formatSet(pair.planned) : '—'}
            </span>
            <span className={`cell-compare-done${state}`}>
              {pair.executed ? formatSet(pair.executed) : 'sin hacer'}
              {delta !== null && delta !== 0 && (
                <small>
                  {delta > 0 ? '+' : ''}
                  {delta}
                </small>
              )}
            </span>
          </div>
        )
      })}
    </div>
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
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ejercicio…"
        aria-label="Buscar ejercicio"
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
      {cell.executedSets.length > 0 && (
        <Verdict planned={cell.plannedSets} executed={cell.executedSets} />
      )}

      {cell.sessionEnded ? (
        // El día está cerrado: cambiar el plan ya no cambia nada, y dejar el
        // formulario invitaba a editar una prescripción que ya se ejecutó.
        <p className="cell-closed-note">
          Este día está finalizado: el plan queda como quedó.
        </p>
      ) : (
        <>
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
                autoComplete="off"
                type="number"
                inputMode="decimal"
                step="0.5"
                value={draft.weight}
                aria-label={`Peso de la serie ${index + 1}`}
                onChange={(e) => updateSet(index, { weight: e.target.value })}
              />
              <input
                autoComplete="off"
                type="number"
                inputMode="numeric"
                min={1}
                value={draft.reps}
                aria-label={`Repeticiones de la serie ${index + 1}`}
                onChange={(e) => updateSet(index, { reps: e.target.value })}
              />
              <input
                autoComplete="off"
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
        </>
      )}

        {cell.executedSets.length > 0 && (
          <PlanVsDone planned={cell.plannedSets} executed={cell.executedSets} />
        )}

      {error && <p className="error">{error}</p>}

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          {cell.sessionEnded ? 'Cerrar' : 'Cancelar'}
        </button>
        {!cell.sessionEnded && (
          <>
            <button type="button" disabled={isSubmitting} onClick={() => void handleSave(true)}>
              Guardar y fijar
            </button>
            <button type="button" disabled={isSubmitting} onClick={() => void handleSave(false)}>
              Guardar
            </button>
          </>
        )}
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
