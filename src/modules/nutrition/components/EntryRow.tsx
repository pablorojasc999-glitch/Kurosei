import type { FoodItem, NutritionEntryKind } from '../domain/types'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { formatNutrient } from '../lib/nutrients'

/** Shape shared by `NutritionEntry` and `MealTemplateEntry` — everything this row reads, regardless of which one it's showing. */
interface DisplayEntry {
  kind: NutritionEntryKind
  quantity: number | null
  manualName: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

interface EntryRowProps {
  entry: DisplayEntry
  food: FoodItem | undefined
  isDragging: boolean
  dragOffset: { dx: number; dy: number } | null
  showDetail: boolean
  registerRef: (el: HTMLDivElement | null) => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onToggleDetail: () => void
  onDelete: () => void
  /** Only Registro passes these — whether this entry counts toward the day's totals, and how to flip it. Omitted entirely in Plantillas, where a template has no notion of "already eaten". */
  checked?: boolean
  onToggleChecked?: () => void
}

export function EntryRow({
  entry,
  food,
  isDragging,
  dragOffset,
  showDetail,
  registerRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onToggleDetail,
  onDelete,
  checked,
  onToggleChecked,
}: EntryRowProps) {
  const emoji = entry.kind === 'food' && food ? food.emoji : null
  const name =
    entry.kind === 'food' && food
      ? food.name
      : entry.kind === 'food'
        ? '(alimento eliminado)'
        : entry.manualName
  const quantityLabel =
    entry.kind === 'food' && food
      ? `${entry.quantity} ${food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit}`
      : null
  const canExpand = entry.kind === 'manual' || (entry.kind === 'food' && !!food)

  return (
    <div
      ref={registerRef}
      className={`nutrition-entry-row${isDragging ? ' nutrition-entry-row--dragging' : ''}${
        canExpand ? ' nutrition-entry-row--clickable' : ''
      }${onToggleChecked && !checked ? ' nutrition-entry-row--unchecked' : ''}`}
      style={
        isDragging && dragOffset
          ? { transform: `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={canExpand ? onToggleDetail : undefined}
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : undefined}
      aria-expanded={canExpand ? showDetail : undefined}
      aria-label={canExpand ? (showDetail ? 'Cerrar edición' : 'Editar registro') : undefined}
    >
      <span className="nutrition-entry-drag-handle" aria-hidden="true">
        ⠿
      </span>
      {emoji && (
        <span className="nutrition-entry-emoji" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="nutrition-entry-info">
        <strong>
          {name}
          {quantityLabel && (
            <span className="nutrition-entry-quantity-inline"> | {quantityLabel}</span>
          )}
        </strong>
        <span className="nutrition-entry-macro-line">
          <span className="nutrition-entry-macro-item">
            {formatNutrient(entry.calories)} kcal
          </span>
          <span className="nutrition-entry-macro-item">C {formatNutrient(entry.carbsG)}</span>
          <span className="nutrition-entry-macro-item">P {formatNutrient(entry.proteinG)}</span>
          <span className="nutrition-entry-macro-item">G {formatNutrient(entry.fatG)}</span>
        </span>
      </span>
      {onToggleChecked && (
        <button
          type="button"
          className={`nutrition-entry-checkbox${checked ? ' nutrition-entry-checkbox--checked' : ''}`}
          aria-pressed={checked}
          aria-label={checked ? 'Desmarcar como consumido' : 'Marcar como consumido'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleChecked()
          }}
        >
          {checked ? '✓' : ''}
        </button>
      )}
      <span onClick={(e) => e.stopPropagation()}>
        <ConfirmDeleteButton
          variant="icon"
          className="icon-button nutrition-entry-delete"
          label="Eliminar registro"
          confirmMessage={`¿Eliminar "${name}"?`}
          onConfirm={onDelete}
        />
      </span>
    </div>
  )
}
