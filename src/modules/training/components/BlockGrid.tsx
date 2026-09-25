import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { BottomSheet } from '../../../shared/components/BottomSheet'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import {
  addExerciseToSlot,
  getBlockGridData,
  deletePlannedExercise,
  moveSlotExerciseToSlot,
  pinExerciseAcrossBlock,
  removeSlotExercise,
  reorderSlotExercise,
  setPlannedSets,
  setSlotExerciseCounts,
} from '../db/planningRepository'
import { listExercises, listMuscleGroups } from '../db/trainingRepository'
import { db } from '../../../shared/db/database'
import {
  buildEffectiveSets,
  type EffectiveSetsCell,
  type EffectiveSetsRow,
} from '../lib/effectiveSets'
import { ConfirmDeleteButton } from './ConfirmDeleteButton'
import { ExercisePicker } from './ExercisePicker'
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
  // Para el resumen del pie: qué músculo toca cada ejercicio y cuánto.
  const muscles = useLiveQuery(async () => {
    const groups = await listMuscleGroups()
    const contributions = await db.training_exercise_muscle_contributions
      .filter((c) => c.deletedAt === null)
      .toArray()
    return { names: new Map(groups.map((g) => [g.id, g.name])), contributions }
  }, [])
  // Se guarda a qué fila apunta la hoja, no una copia de la fila: con la copia,
  // marcar algo dentro de la hoja cambiaba la base pero la hoja seguía
  // enseñando el dato de cuando se abrió, y había que cerrarla para verlo.
  const [editing, setEditing] = useState<
    { slotIndex: number; exerciseId: string; weekIndex: number } | null
  >(null)
  const [adding, setAdding] = useState<{ slot: GridDaySlot; weekIndex: number } | null>(null)
  const [rowMenu, setRowMenu] = useState<{ slotIndex: number; exerciseId: string } | null>(null)
  const [effectiveDetail, setEffectiveDetail] = useState<EffectiveDetail | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!data || !exercises || !muscles) {
    return <p className="empty-hint">Cargando la planilla…</p>
  }

  const grid = buildBlockGrid({ ...data, exercises })
  // El "Día N" lo numera la planilla, así que sale de ella y no se recalcula.
  const dayLabels = new Map<string, string>()
  for (const slot of grid.slots) {
    for (const dayId of slot.dayIds) {
      if (dayId) dayLabels.set(dayId, slot.label)
    }
  }
  const effective = buildEffectiveSets({
    weeks: grid.weeks,
    days: data.days,
    plannedExercises: data.plannedExercises,
    plannedSets: data.plannedSets,
    contributions: muscles.contributions,
    muscleGroupNames: muscles.names,
    exerciseNames: new Map(exercises.map((e) => [e.id, e.name])),
    dayLabels,
  })

  if (grid.weeks.length === 0) {
    return (
      <p className="empty-hint">
        Este bloque todavía no tiene semanas. Crea la primera y sus días para ver la planilla.
      </p>
    )
  }

  const thisWeek = currentWeekIndex(grid.slots, toDateKey(new Date()))

  function findRow(slotIndex: number, exerciseId: string) {
    const slot = grid.slots.find((s) => s.slotIndex === slotIndex)
    const row = slot?.rows.find((r) => r.exerciseId === exerciseId)
    return slot && row ? { slot, row } : null
  }

  const rowMenuTarget = rowMenu ? findRow(rowMenu.slotIndex, rowMenu.exerciseId) : null
  const found = editing ? findRow(editing.slotIndex, editing.exerciseId) : null
  const editingCell = found?.row.cells[editing?.weekIndex ?? 0]
  // Si la fila desapareció —la acaban de quitar— la hoja se va con ella.
  const editingTarget: CellRef | null =
    found && editing && editingCell?.plannedExerciseId
      ? { slot: found.slot, row: found.row, cell: editingCell, weekIndex: editing.weekIndex }
      : null

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
                      <button
                        type="button"
                        className="block-grid-name-button"
                        aria-label={`Opciones de ${row.exerciseName} en ${slot.label}`}
                        onClick={() =>
                          setRowMenu({ slotIndex: slot.slotIndex, exerciseId: row.exerciseId })
                        }
                      >
                        <span className="block-grid-name-text" title={row.exerciseName}>
                          {row.exerciseName}
                        </span>
                        {row.countsState !== 'all' && (
                          <span
                            className="block-grid-name-flag"
                            title={
                              row.countsState === 'none'
                                ? 'No cuenta para las series efectivas'
                                : 'Cuenta sólo en algunas semanas'
                            }
                          >
                            {row.countsState === 'none' ? 'no cuenta' : 'parcial'}
                          </span>
                        )}
                      </button>
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
                            }${cell.countedSets === cell.setCount ? '' : ' block-grid-cell--uncounted'}`}
                            aria-label={`${row.exerciseName}, semana ${index + 1}: ${
                              cell.planned.volume || 'sin series'
                            }${done ? (asPlanned ? ', hecho tal cual' : `, hiciste ${cell.executed.volume}`) : ''}`}
                            onClick={() =>
                              setEditing({
                                slotIndex: slot.slotIndex,
                                exerciseId: row.exerciseId,
                                weekIndex: index,
                              })
                            }
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

      <EffectiveSets
        rows={effective}
        weekCount={grid.weeks.length}
        onOpen={setEffectiveDetail}
      />

      {adding && (
        <BottomSheet
          title="Añadir ejercicio"
          subtitle={`${adding.slot.label} · Semana ${adding.weekIndex + 1}`}
          onClose={() => setAdding(null)}
        >
          <ExercisePicker
            value=""
            onlyStrength
            onChange={(id) => void handleAddExercise(id)}
          />
        </BottomSheet>
      )}

      {rowMenuTarget && (
        <RowMenu
          slot={rowMenuTarget.slot}
          row={rowMenuTarget.row}
          slots={grid.slots}
          mesocycleId={mesocycleId}
          onClose={() => setRowMenu(null)}
          onNotice={setNotice}
        />
      )}

      {effectiveDetail && (
        <EffectiveDetailSheet
          detail={effectiveDetail}
          onClose={() => setEffectiveDetail(null)}
        />
      )}

      {editingTarget && (
        <CellEditor
          key={editingTarget.cell.plannedExerciseId as string}
          target={editingTarget}
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

/** Una cifra de series efectivas: un decimal, sin el `.0` de relleno. */
function formatEffective(value: number): string {
  if (value === 0) return '—'
  return `${Math.round(value * 10) / 10}`
}

/**
 * Las series efectivas programadas del bloque, por músculo y por semana.
 *
 * Va al pie de la planilla porque se lee después de armarla: primero se
 * prescribe y después se mira si el reparto quedó donde se quería.
 */
function EffectiveSets({
  rows,
  weekCount,
  onOpen,
}: {
  rows: EffectiveSetsRow[]
  weekCount: number
  onOpen: (detail: EffectiveDetail) => void
}) {
  return (
    <section className="effective-sets">
      <h3>Series efectivas por semana</h3>
      {rows.length === 0 ? (
        <p className="empty-hint">
          Todavía no hay series que contar. Se cuentan las de los ejercicios marcados como
          efectivos, ponderadas por cuánto involucran a cada músculo.
        </p>
      ) : (
        <div className="block-grid-scroll">
          <table className="block-grid effective-sets-table">
            <thead>
              <tr>
                <th className="block-grid-corner" scope="col">
                  <span className="sr-only">Músculo</span>
                </th>
                {Array.from({ length: weekCount }, (_, index) => (
                  <th key={index} scope="col">
                    S{index + 1}
                  </th>
                ))}
                <th scope="col">Tot.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th className="block-grid-corner block-grid-name" scope="row">
                    <span className="block-grid-name-text">{row.name}</span>
                  </th>
                  {row.perWeek.map((cell, index) => (
                    <td key={index} className="effective-sets-value">
                      {cell.items.length === 0 ? (
                        formatEffective(cell.value)
                      ) : (
                        <button
                          type="button"
                          className="effective-sets-open"
                          aria-label={`Ver de dónde salen las ${formatEffective(cell.value)} series de ${row.name} en la semana ${index + 1}`}
                          onClick={() =>
                            onOpen({ muscle: row.name, weekIndex: index, cell })
                          }
                        >
                          {formatEffective(cell.value)}
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="effective-sets-value effective-sets-total">
                    {formatEffective(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface EffectiveDetail {
  muscle: string
  weekIndex: number
  cell: EffectiveSetsCell
}

/**
 * De dónde sale un número de la tabla: qué ejercicio, de qué día, cuántas
 * series suyas cuentan y con cuánta implicancia.
 *
 * Un total ponderado no se puede comprobar de cabeza —"6.8 series de glúteos"
 * no dice de dónde salieron—, y sin poder abrirlo la tabla hay que creérsela.
 */
function EffectiveDetailSheet({
  detail,
  onClose,
}: {
  detail: EffectiveDetail
  onClose: () => void
}) {
  const { muscle, weekIndex, cell } = detail
  return (
    <BottomSheet
      title={muscle}
      subtitle={`Semana ${weekIndex + 1} · ${formatEffective(cell.value)} series efectivas`}
      onClose={onClose}
    >
      <ul className="effective-detail">
        {cell.items.map((item) => (
          <li key={item.plannedExerciseId}>
            <div className="effective-detail-head">
              <span className="effective-detail-name">{item.exerciseName}</span>
              <span className="effective-detail-value">{formatEffective(item.value)}</span>
            </div>
            <span className="effective-detail-meta">
              {item.dayLabel}
              {item.date ? ` · ${shortDate(item.date)}` : ''} ·{' '}
              {item.countedSets === item.totalSets
                ? `${item.countedSets} serie${item.countedSets === 1 ? '' : 's'}`
                : `${item.countedSets} de ${item.totalSets} series`}{' '}
              · implicancia {item.factor.toFixed(1)}
              {item.intensifiedSets > 0 &&
                ` · ${item.intensifiedSets} con drop o rest-pause (+30%)`}
            </span>
          </li>
        ))}
      </ul>

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </BottomSheet>
  )
}

interface RowMenuProps {
  slot: GridDaySlot
  row: GridRow
  slots: GridDaySlot[]
  mesocycleId: string
  onClose: () => void
  onNotice: (message: string) => void
}

/**
 * Lo que se puede hacer con una fila entera: moverla dentro del día, mandarla
 * a otro día, o sacarla del conteo de series efectivas.
 *
 * Todo va sobre la fila y no sobre una celda porque una fila es el mismo
 * ejercicio en las cuatro semanas: moverlo en una sola descuadraría la
 * planilla. Para una semana suelta está la propia celda.
 */
function RowMenu({ slot, row, slots, mesocycleId, onClose, onNotice }: RowMenuProps) {
  const { isSubmitting: isBusy, guard } = useSubmitGuard()
  const index = slot.rows.findIndex((r) => r.exerciseId === row.exerciseId)
  const cuenta = row.countsState !== 'none'

  async function mover(direction: 'up' | 'down') {
    await guard(async () => {
      await reorderSlotExercise(mesocycleId, slot.slotIndex, row.exerciseId, direction)
    })
    onClose()
  }

  async function quitar() {
    await guard(async () => {
      const { removed, skipped } = await removeSlotExercise(
        mesocycleId,
        slot.slotIndex,
        row.exerciseId,
      )
      if (removed === 0) {
        onNotice('No se quitó nada: esas semanas ya tienen la sesión finalizada.')
      } else if (skipped > 0) {
        onNotice(
          `Quitado de ${removed} semana${removed === 1 ? '' : 's'}; ${skipped} con la sesión ya finalizada quedaron como estaban.`,
        )
      }
    })
    onClose()
  }

  async function aOtroDia(toSlotIndex: number) {
    await guard(async () => {
      const { moved, skipped } = await moveSlotExerciseToSlot(
        mesocycleId,
        slot.slotIndex,
        toSlotIndex,
        row.exerciseId,
      )
      if (moved === 0) {
        onNotice('No se pudo mover: ese día ya tenía el ejercicio, o no existe en esas semanas.')
      } else if (skipped > 0) {
        onNotice(
          `Movido en ${moved} semana${moved === 1 ? '' : 's'}; ${skipped} quedaron como estaban.`,
        )
      }
    })
    onClose()
  }

  return (
    <BottomSheet title={row.exerciseName} subtitle={slot.label} onClose={onClose}>
      <div className="sheet-list">
        <button
          type="button"
          disabled={isBusy || index <= 0}
          onClick={() => void mover('up')}
        >
          ↑ Subir en {slot.label}
        </button>
        <button
          type="button"
          disabled={isBusy || index === -1 || index >= slot.rows.length - 1}
          onClick={() => void mover('down')}
        >
          ↓ Bajar en {slot.label}
        </button>
      </div>

      {slots.length > 1 && (
        <>
          <p className="sheet-hint">Mover a otro día</p>
          <div className="sheet-list">
            {slots
              .filter((s) => s.slotIndex !== slot.slotIndex)
              .map((s) => (
                <button
                  key={s.slotIndex}
                  type="button"
                  disabled={isBusy}
                  onClick={() => void aOtroDia(s.slotIndex)}
                >
                  → {s.label}
                </button>
              ))}
          </div>
        </>
      )}

      <p className="sheet-hint">Series efectivas</p>
      <label className="set-technique">
        <input
          type="checkbox"
          checked={cuenta}
          disabled={isBusy}
          onChange={(e) =>
            void guard(async () => {
              await setSlotExerciseCounts(
                mesocycleId,
                slot.slotIndex,
                row.exerciseId,
                e.target.checked,
              )
            })
          }
        />
        Cuentan todas sus series, en todas las semanas
      </label>
      {row.countsState === 'mixed' && (
        <p className="empty-hint">
          Ahora cuentan sólo algunas de sus series. Marcar o desmarcar acá lo aplica a todas; para
          una serie suelta, abrí su celda.
        </p>
      )}

      <p className="sheet-hint">Quitar del bloque</p>
      <ConfirmDeleteButton
        label="Quitar de todas las semanas"
        confirmMessage={`¿Quitar ${row.exerciseName} de ${slot.label} en todo el bloque?`}
        onConfirm={quitar}
      />

      <div className="sheet-actions">
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </BottomSheet>
  )
}

/** Una serie del formulario: se guarda como texto para poder dejar campos a medio escribir. */
interface SetDraft {
  weight: string
  reps: string
  rpe: string
  counts: boolean
}

function toDraft(set: GridSet): SetDraft {
  return {
    weight: set.weightKg !== null ? String(set.weightKg) : '',
    reps: String(set.reps),
    rpe: set.rpe !== null ? String(set.rpe) : '',
    counts: set.counts !== false,
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
      : [{ weight: '', reps: '5', rpe: '', counts: true }],
  )

  function updateSet(index: number, patch: Partial<SetDraft>) {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function addSet() {
    setDrafts((current) => [
      ...current,
      { ...(current[current.length - 1] ?? { weight: '', reps: '5', rpe: '', counts: true }) },
    ])
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
            countsAsEffective: d.counts,
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
            <span className="set-editor-counts-head">efec.</span>
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
              {/* Destildada, esa serie sola deja de sumar: la de aproximación
                  mueve la barra pero no es trabajo que haya que recuperar. */}
              <input
                type="checkbox"
                className="set-editor-counts"
                checked={draft.counts}
                aria-label={`La serie ${index + 1} cuenta para las series efectivas`}
                onChange={(e) => updateSet(index, { counts: e.target.checked })}
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

      {!cell.sessionEnded && (
        <ConfirmDeleteButton
          label="Quitar de esta semana"
          confirmMessage={`¿Quitar ${row.exerciseName} de la semana ${weekIndex + 1}?`}
          onConfirm={async () => {
            await deletePlannedExercise(cell.plannedExerciseId as string)
            onClose()
          }}
        />
      )}

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
