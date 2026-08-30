import type { FoodItem, NutritionEntry } from '../domain/types'
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

  return (
    <div
      ref={registerRef}
      className={`nutrition-entry-row${isDragging ? ' nutrition-entry-row--dragging' : ''}`}
      style={
        isDragging && dragOffset
          ? { transform: `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="nutrition-entry-drag-handle" aria-hidden="true">
        ⠿
      </span>
      <span className="nutrition-entry-info">
        <strong>{title}</strong>
        {subtitle && <span className="finance-transaction-subtitle">{subtitle}</span>}
      </span>
      <span className="nutrition-entry-macros">{formatNutrient(entry.calories)} kcal</span>
      {entry.kind === 'food' && food && (
        <button
          type="button"
          className="icon-button"
          aria-label={showDetail ? 'Ocultar detalle' : 'Ver detalle del alimento'}
          onClick={onToggleDetail}
        >
          ⓘ
        </button>
      )}
      <button
        type="button"
        className="icon-button"
        aria-label="Eliminar registro"
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  )
}
