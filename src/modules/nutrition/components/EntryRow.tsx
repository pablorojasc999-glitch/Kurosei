import type { FoodItem, NutritionEntry } from '../domain/types'

interface EntryRowProps {
  entry: NutritionEntry
  food: FoodItem | undefined
  isDragging: boolean
  dragOffset: { dx: number; dy: number } | null
  registerRef: (el: HTMLDivElement | null) => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onDelete: () => void
}

export function EntryRow({
  entry,
  food,
  isDragging,
  dragOffset,
  registerRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
      <span className="nutrition-entry-macros">{Math.round(entry.calories)} kcal</span>
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
