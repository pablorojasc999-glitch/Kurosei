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
  targetSeconds: number
  /** Quitar el cronómetro de en medio cuando ya no hace falta. */
  onDismiss: () => void
}

/**
 * El descanso entre series.
 *
 * Monta una instancia nueva (`key`) para volver a empezar: el estado vive en el
 * componente y reiniciarlo desde fuera sería sincronizar prop y estado a mano.
 */
export function RestTimer({ targetSeconds, onDismiss }: RestTimerProps) {
  const [state, setState] = useState<RestTimerState>(() =>
    startRest(targetSeconds, Date.now()),
  )
  const [remaining, setRemaining] = useState(targetSeconds)
  const alertedRef = useRef(false)

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
        <button type="button" aria-label="Ocultar el descanso" onClick={onDismiss}>
          ✕
        </button>
      </div>
    </div>
  )
}
