import type { FoodItem, NutritionEntry } from '../domain/types'
import { ConfirmDeleteButton } from '../../training/components/ConfirmDeleteButton'
import { formatNutrient } from '../lib/nutrients'

interface EntryRowProps {
  entry: NutritionEntry
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
}: EntryRowProps) {
  const emoji = entry.kind === 'food' && food ? food.emoji : null
  const name =
    entry.kind === 'food' && food
      ? food.name
      : entry.kind === 'food'
        ? '(alimento eliminado)'
        : entry.manualName
  const subtitle = entry.kind === 'food' && food ? food.brand : null
  const quantity =
    entry.kind === 'food' && food
      ? `${entry.quantity} ${food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit}`
      : null
  const canExpand = entry.kind === 'manual' || (entry.kind === 'food' && !!food)

  return (
    <div
      ref={registerRef}
      className={`nutrition-entry-row${isDragging ? ' nutrition-entry-row--dragging' : ''}${
        canExpand ? ' nutrition-entry-row--clickable' : ''
      }`}
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
        <strong>{name}</strong>
        {subtitle && <span className="finance-transaction-subtitle">{subtitle}</span>}
      </span>
      <span className="nutrition-entry-macros">
        {quantity && <span className="nutrition-entry-quantity">{quantity}</span>}
        <span className="nutrition-entry-kcal">{formatNutrient(entry.calories)} kcal</span>
      </span>
      <span className="nutrition-entry-check" aria-hidden="true">
        ✓
      </span>
      <span onClick={(e) => e.stopPropagation()}>
        <ConfirmDeleteButton
          variant="icon"
          className="icon-button"
          label="Eliminar registro"
          confirmMessage={`¿Eliminar "${name}"?`}
          onConfirm={onDelete}
        />
      </span>
    </div>
  )
}
