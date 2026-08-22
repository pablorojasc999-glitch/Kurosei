import { useState } from 'react'

interface ConfirmDeleteButtonProps {
  onConfirm: () => void | Promise<void>
  label?: string
  confirmMessage?: string
  confirmLabel?: string
  variant?: 'button' | 'icon'
  className?: string
}

export function ConfirmDeleteButton({
  onConfirm,
  label = 'Eliminar',
  confirmMessage = '¿Eliminar?',
  confirmLabel = 'Sí, eliminar',
  variant = 'button',
  className,
}: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="confirm-inline confirm-inline--compact">
        <span>{confirmMessage}</span>
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            setConfirming(false)
            onConfirm()
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </span>
    )
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={className ?? 'icon-button'}
        onClick={() => setConfirming(true)}
        aria-label={label}
      >
        ×
      </button>
    )
  }

  return (
    <button
      type="button"
      className={className ?? 'btn-danger'}
      onClick={() => setConfirming(true)}
    >
      {label}
    </button>
  )
}
