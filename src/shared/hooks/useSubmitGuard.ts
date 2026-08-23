import { useRef, useState } from 'react'

/**
 * Prevents an async submit handler from running twice concurrently (e.g. a
 * fast double-tap before the first call's state update re-renders the
 * button as disabled) — a second call while the first is still in flight is
 * silently ignored instead of creating a duplicate row.
 */
export function useSubmitGuard() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlight = useRef(false)

  async function guard(fn: () => Promise<void>): Promise<void> {
    if (inFlight.current) return
    inFlight.current = true
    setIsSubmitting(true)
    try {
      await fn()
    } finally {
      inFlight.current = false
      setIsSubmitting(false)
    }
  }

  return { isSubmitting, guard }
}
