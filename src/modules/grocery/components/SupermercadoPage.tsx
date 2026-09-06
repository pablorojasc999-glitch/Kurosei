import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSubmitGuard } from '../../../shared/hooks/useSubmitGuard'
import { useEntryDragReorder } from '../../nutrition/lib/useEntryDragReorder'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import type { GroceryItem, PurchaseCadence } from '../domain/types'
import { PURCHASE_CADENCES } from '../domain/types'
import {
  checkAllDue,
  clearChecked,
  completeShoppingRun,
  createItem,
  listItems,
  moveItemToCadence,
  softDeleteItem,
  toggleItemChecked,
  updateItem,
} from '../db/groceryRepository'
import {
  CADENCE_HINT,
  CADENCE_LABEL,
  CADENCE_SHORT,
  groupByCadence,
  isDue,
  lastBoughtLabel,
  todayKey,
} from '../lib/groceryCadence'

export function SupermercadoPage() {
  const items = useLiveQuery(() => listItems(), [])
  const today = todayKey()

  const [openCadence, setOpenCadence] = useState<PurchaseCadence | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [cadence, setCadence] = useState<PurchaseCadence>('quincenal')
  const [error, setError] = useState<string | null>(null)
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const { isSubmitting, guard } = useSubmitGuard()

  // La cadencia hace de sección, así que sirve el mismo arrastre que Nutrición.
  const drag = useEntryDragReorder(
    items?.map((i) => ({ ...i, sectionId: i.cadence })),
    PURCHASE_CADENCES.map((c) => ({ id: c })),
    (id, targetCadence, targetIndex) => {
      void moveItemToCadence(id, targetCadence as PurchaseCadence, targetIndex)
    },
  )

  const groups = groupByCadence(items ?? [], today)
  const checkedItems = (items ?? []).filter((i) => i.checked)
  const dueItems = (items ?? []).filter((i) => isDue(i, today) && !i.checked)

  function resetForm() {
    setOpenCadence(null)
    setEditingId(null)
    setName('')
    setQuantity('')
    setNote('')
    setError(null)
  }

  function startAdd(target: PurchaseCadence) {
    resetForm()
    setOpenCadence(target)
    setCadence(target)
  }

  function startEdit(item: GroceryItem) {
    setOpenCadence(item.cadence)
    setEditingId(item.id)
    setName(item.name)
    setQuantity(item.quantity)
    setNote(item.note)
    setCadence(item.cadence)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    await guard(async () => {
      try {
        if (editingId) await updateItem(editingId, { name, quantity, note, cadence })
        else await createItem({ name, cadence, quantity, note })
        resetForm()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  async function handleCompleteRun() {
    const count = await completeShoppingRun()
    setRunMessage(
      count === 1
        ? 'Compra cerrada: 1 artículo marcado como comprado hoy.'
        : `Compra cerrada: ${count} artículos marcados como comprados hoy.`,
    )
  }

  return (
    <div className="page">
      <h1>Supermercado</h1>
      <p className="empty-hint">
        Lo que compras se separa por cada cuánto lo repones. Marca lo que llevas y cierra la
        compra: eso reinicia el ciclo de cada artículo.
      </p>

      <div className="grocery-summary-row">
        {groups.map((group) => (
          <div key={group.cadence} className={`grocery-summary-card grocery-summary-card--${group.cadence}`}>
            <span>{CADENCE_SHORT[group.cadence]}</span>
            <strong>{group.items.length}</strong>
            {group.dueCount > 0 && <em>{group.dueCount} toca{group.dueCount === 1 ? '' : 'n'}</em>}
          </div>
        ))}
      </div>

      <div className="grocery-run-bar">
        <span className="grocery-run-count">
          {checkedItems.length === 0
            ? 'Nada marcado todavía'
            : `${checkedItems.length} marcado${checkedItems.length === 1 ? '' : 's'} para esta compra`}
        </span>
        <div className="grocery-run-actions">
          {dueItems.length > 0 && (
            <button type="button" onClick={() => void checkAllDue(dueItems.map((i) => i.id))}>
              Marcar lo que toca ({dueItems.length})
            </button>
          )}
          {checkedItems.length > 0 && (
            <>
              <button type="button" onClick={() => void clearChecked()}>
                Desmarcar
              </button>
              <button type="button" className="grocery-run-close" onClick={() => void handleCompleteRun()}>
                Cerrar compra
              </button>
            </>
          )}
        </div>
      </div>

      {runMessage && (
        <p className="grocery-run-message" role="status">
          {runMessage}{' '}
          <button type="button" className="grocery-run-dismiss" onClick={() => setRunMessage(null)}>
            Ocultar
          </button>
        </p>
      )}

      {groups.map((group) => (
        <section key={group.cadence}>
          <div className="grocery-section-header">
            <h2>{CADENCE_LABEL[group.cadence]}</h2>
            <button type="button" className="icon-button" aria-label={`Añadir a ${CADENCE_LABEL[group.cadence]}`} onClick={() => startAdd(group.cadence)}>
              +
            </button>
          </div>
          <p className="grocery-section-hint">{CADENCE_HINT[group.cadence]}</p>

          <div
            className="grocery-list"
            ref={(el) => {
              if (el) drag.sectionListRefs.current.set(group.cadence, el)
              else drag.sectionListRefs.current.delete(group.cadence)
            }}
          >
            {group.items.length === 0 && (
              <p className="empty-hint">Nada en esta lista todavía.</p>
            )}

            {group.items.map((item, index) => {
              const due = isDue(item, today)
              const dropHere =
                drag.dropTarget?.sectionId === group.cadence && drag.dropTarget.index === index
              return (
                <div key={item.id}>
                  {dropHere && <div className="grocery-drop-line" />}
                  <div
                    ref={(el) => {
                      if (el) drag.rowRefs.current.set(item.id, el)
                      else drag.rowRefs.current.delete(item.id)
                    }}
                    className={[
                      'grocery-row',
                      item.checked && 'grocery-row--checked',
                      due && !item.checked && 'grocery-row--due',
                      drag.draggingId === item.id && 'grocery-row--dragging',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      drag.draggingId === item.id && drag.dragOffset
                        ? { transform: `translate(${drag.dragOffset.dx}px, ${drag.dragOffset.dy}px)` }
                        : undefined
                    }
                    onPointerDown={(e) => drag.handlePointerDown(item.id, e)}
                    onPointerMove={drag.handlePointerMove}
                    onPointerUp={drag.handlePointerUp}
                    onPointerCancel={drag.handlePointerUp}
                  >
                    <button
                      type="button"
                      className={`grocery-check${item.checked ? ' grocery-check--checked' : ''}`}
                      aria-pressed={item.checked}
                      aria-label={item.checked ? `Desmarcar ${item.name}` : `Marcar ${item.name}`}
                      onClick={() => {
                        if (drag.consumeJustDragged()) return
                        void toggleItemChecked(item.id)
                      }}
                    >
                      {item.checked ? '✓' : ''}
                    </button>

                    <button
                      type="button"
                      className="grocery-row-main"
                      onClick={() => {
                        if (drag.consumeJustDragged()) return
                        startEdit(item)
                      }}
                    >
                      <span className="grocery-row-name">
                        {item.name}
                        {item.quantity && <span className="grocery-row-qty">{item.quantity}</span>}
                      </span>
                      <span className="grocery-row-meta">
                        {lastBoughtLabel(item, today)}
                        {item.note && ` · ${item.note}`}
                      </span>
                    </button>

                    <ConfirmDeleteButton
                      variant="icon"
                      className="icon-button"
                      label={`Eliminar ${item.name}`}
                      confirmMessage={`¿Eliminar "${item.name}"?`}
                      onConfirm={() => softDeleteItem(item.id)}
                    />
                  </div>
                </div>
              )
            })}

            {drag.dropTarget?.sectionId === group.cadence &&
              drag.dropTarget.index >= group.items.length && <div className="grocery-drop-line" />}
          </div>

          {openCadence === group.cadence && (
            <form className="entity-form grocery-form" onSubmit={handleSubmit}>
              <label>
                Nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Leche, arroz, detergente…"
                  autoFocus
                />
              </label>
              <label>
                Cantidad
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="2 L, 1 kg, 3 paquetes…"
                />
              </label>
              <label>
                Nota
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="La marca, el pasillo, lo que sea"
                />
              </label>
              <label>
                Cada cuánto lo compras
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as PurchaseCadence)}
                >
                  {PURCHASE_CADENCES.map((c) => (
                    <option key={c} value={c}>
                      {CADENCE_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="error">{error}</p>}
              <div className="list-card-actions">
                <button type="button" onClick={resetForm}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting}>
                  {editingId ? 'Guardar' : 'Añadir'}
                </button>
              </div>
            </form>
          )}
        </section>
      ))}
    </div>
  )
}
