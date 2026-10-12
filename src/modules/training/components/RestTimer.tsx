import { useEffect, useRef, useState } from 'react'
import {
  extendRest,
  formatRestClock,
  pauseRest,
  remainingSeconds,
  resumeRest,
  startRest,
  type RestTimerState,
} from '../lib/restTimer'

function playBeep(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.5)
    oscillator.onended = () => ctx.close()
  } catch {
    // audio unsupported/blocked — the visual + vibration alert still fires
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // vibration unsupported — ignore
  }
}

/** Cada cuánto se repinta. Más fino que un segundo para que al volver de la pantalla bloqueada el número ya esté puesto. */
const TICK_MS = 250

interface RestTimerProps {
  sessionExerciseId: string
  targetSeconds: number
  /**
   * El descanso guardado en `localStorage` con el que retomar, si lo hay —
   * ver `restStorageKey` en `lib/restTimer.ts`. Sólo se usa al montar: un
   * remount con `key` distinta siempre es un descanso nuevo de verdad.
   */
  initialState?: RestTimerState
  /** Dónde persistir este descanso, para sobrevivir a un refresco de la página. */
  persistKey: string
  /** Quitar el cronómetro de en medio cuando ya no hace falta. */
  onDismiss: () => void
}

/**
 * El descanso entre series.
 *
 * Monta una instancia nueva (`key`) para volver a empezar: el estado vive en el
 * componente y reiniciarlo desde fuera sería sincronizar prop y estado a mano.
 */
export function RestTimer({
  sessionExerciseId,
  targetSeconds,
  initialState,
  persistKey,
  onDismiss,
}: RestTimerProps) {
  const [state, setState] = useState<RestTimerState>(
    () => initialState ?? startRest(targetSeconds, Date.now()),
  )
  // Si viene de `initialState` (se retoma tras un refresco) puede llevar
  // menos tiempo que `targetSeconds` — calcularlo ya con `state` evita un
  // parpadeo del reloj completo antes de que el primer efecto lo corrija.
  const [remaining, setRemaining] = useState(() => remainingSeconds(state, Date.now()))
  const alertedRef = useRef(false)

  // Al refrescar la página, en web, se pierde todo el estado de React —
  // sin esto, el descanso volvía a empezar aunque el tiempo real hubiera
  // seguido corriendo. Guardarlo acá (no en Supabase: es de esta pestaña,
  // no de la cuenta) deja retomarlo tal cual al volver a abrir la pantalla.
  useEffect(() => {
    try {
      localStorage.setItem(persistKey, JSON.stringify({ sessionExerciseId, state }))
    } catch {
      // localStorage lleno o bloqueado: el cronómetro sigue andando en pantalla,
      // sólo no sobrevive a un refresco — no es motivo para romper nada.
    }
  }, [state, persistKey, sessionExerciseId])

  function dismiss() {
    try {
      localStorage.removeItem(persistKey)
    } catch {
      // ver el try/catch de arriba
    }
    onDismiss()
  }

  useEffect(() => {
    const sync = () => {
      const left = remainingSeconds(state, Date.now())
      setRemaining(left)

      if (left > 0 || alertedRef.current) return
      alertedRef.current = true
      // Si el descanso se cumplió con la pantalla apagada, el aviso ya no sirve
      // de nada y pegaría un susto al desbloquear: se marca como avisado en
      // silencio y basta con el "+0:45" en rojo.
      if (document.visibilityState === 'visible') {
        playBeep()
        vibrate()
      }
    }

    sync()
    if (state.status === 'paused') return

    const interval = window.setInterval(sync, TICK_MS)
    // Al volver de segundo plano el intervalo puede llevar minutos sin correr.
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [state])

  const isDone = remaining <= 0
  const isPaused = state.status === 'paused'

  return (
    <div className={`rest-timer${isDone ? ' rest-timer--done' : ''}`}>
      <span className="rest-timer-clock numeric" role="timer" aria-live="off">
        {formatRestClock(remaining)}
      </span>
      <div className="rest-timer-controls">
        <button
          type="button"
          onClick={() =>
            setState((prev) =>
              prev.status === 'running'
                ? pauseRest(prev, Date.now())
                : resumeRest(prev, Date.now()),
            )
          }
        >
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
        <button
          type="button"
          onClick={() => {
            alertedRef.current = false
            setState(startRest(targetSeconds, Date.now()))
          }}
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={() => {
            alertedRef.current = false
            setState((prev) => extendRest(prev, 15, Date.now()))
          }}
        >
          +15s
        </button>
        <button type="button" aria-label="Ocultar el descanso" onClick={dismiss}>
          ✕
        </button>
      </div>
    </div>
  )
}
