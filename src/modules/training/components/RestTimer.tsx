import { useEffect, useRef, useState } from 'react'

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

function formatClock(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '+' : ''
  const abs = Math.abs(totalSeconds)
  const minutes = Math.floor(abs / 60)
  const seconds = abs % 60
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface RestTimerProps {
  targetSeconds: number
  onTargetSecondsChange: (seconds: number) => void
}

/**
 * Mount a fresh instance (e.g. `key={lastSet.id}`) to reset the countdown —
 * simpler and more idiomatic than syncing local state to a prop via effect.
 */
export function RestTimer({
  targetSeconds,
  onTargetSecondsChange,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(targetSeconds)
  const [running, setRunning] = useState(true)
  const alertedRef = useRef(false)

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1
        if (next <= 0 && !alertedRef.current) {
          alertedRef.current = true
          playBeep()
          vibrate()
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running])

  const isDone = remaining <= 0

  return (
    <div className={`rest-timer${isDone ? ' rest-timer--done' : ''}`}>
      <span className="rest-timer-clock numeric">{formatClock(remaining)}</span>
      <div className="rest-timer-controls">
        <button type="button" onClick={() => setRunning((r) => !r)}>
          {running ? 'Pausar' : 'Reanudar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setRemaining(targetSeconds)
            alertedRef.current = false
            setRunning(true)
          }}
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={() => {
            setRemaining((prev) => prev + 15)
            onTargetSecondsChange(targetSeconds + 15)
          }}
        >
          +15s
        </button>
      </div>
    </div>
  )
}
