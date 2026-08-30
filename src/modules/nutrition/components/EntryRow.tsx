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
  const title =
    entry.kind === 'food' && food
      ? `${food.emoji} ${food.name}`
      : entry.kind === 'food'
        ? '(alimento eliminado)'
        : entry.manualName
  const subtitle =
    entry.kind === 'food' && food
      ? `${entry.quantity} ${food.servingUnit === 'unidad' ? 'unidad' : food.servingUnit}`
      : null
  const canShowDetail = entry.kind === 'food' && !!food

  return (
    <div
      ref={registerRef}
      className={`nutrition-entry-row${isDragging ? ' nutrition-entry-row--dragging' : ''}${
        canShowDetail ? ' nutrition-entry-row--clickable' : ''
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
      onClick={canShowDetail ? onToggleDetail : undefined}
      role={canShowDetail ? 'button' : undefined}
      tabIndex={canShowDetail ? 0 : undefined}
      aria-expanded={canShowDetail ? showDetail : undefined}
      aria-label={canShowDetail ? (showDetail ? 'Ocultar detalle del alimento' : 'Ver detalle del alimento') : undefined}
    >
      <span className="nutrition-entry-drag-handle" aria-hidden="true">
        ⠿
      </span>
      <span className="nutrition-entry-info">
        <strong>{title}</strong>
        {subtitle && <span className="finance-transaction-subtitle">{subtitle}</span>}
      </span>
      <span className="nutrition-entry-macros">{formatNutrient(entry.calories)} kcal</span>
      <span onClick={(e) => e.stopPropagation()}>
        <ConfirmDeleteButton
          variant="icon"
          className="icon-button"
          label="Eliminar registro"
          confirmMessage={`¿Eliminar "${title}"?`}
          onConfirm={onDelete}
        />
      </span>
    </div>
  )
}
