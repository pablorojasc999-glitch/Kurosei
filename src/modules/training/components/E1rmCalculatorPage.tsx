import { useState } from 'react'
import { calculateE1rm, estimateWeightForTarget } from '../lib/e1rm'

const RPE_OPTIONS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1]

function formatKg(value: number): string {
  return `${Math.round(value * 10) / 10} kg`
}

export function E1rmCalculatorPage() {
  const [haveWeight, setHaveWeight] = useState('')
  const [haveReps, setHaveReps] = useState('')
  const [haveRpe, setHaveRpe] = useState('')

  const [wantReps, setWantReps] = useState('')
  const [wantRpe, setWantRpe] = useState('')

  const weightKg = Number(haveWeight)
  const reps = Number(haveReps)
  const rpe = haveRpe ? Number(haveRpe) : undefined

  const e1rm =
    haveWeight && haveReps && weightKg > 0 && reps > 0
      ? calculateE1rm({ weightKg, reps, rpe })
      : null

  const wantRepsNum = Number(wantReps)
  const wantRepsOutOfRange =
    wantReps !== '' && (!Number.isInteger(wantRepsNum) || wantRepsNum < 1 || wantRepsNum > 15)

  const wantWeight =
    e1rm !== null && wantReps && wantRpe && !wantRepsOutOfRange
      ? estimateWeightForTarget({ e1rm, reps: wantRepsNum, rpe: Number(wantRpe) })
      : null

  return (
    <div className="page">
      <h1>Calculadora de e1RM</h1>
      <p className="empty-hint">
        Usa la misma tabla de %1RM por RPE que el resto de la app para
        estimar tu una-repetición-máxima y el peso que corresponde a otra
        combinación de reps y RPE.
      </p>

      <section className="calc-card">
        <h2>Tengo</h2>
        <label>
          Peso (kg)
          <input
            type="number"
            inputMode="decimal"
            value={haveWeight}
            onChange={(e) => setHaveWeight(e.target.value)}
          />
        </label>
        <label>
          Reps
          <input
            type="number"
            inputMode="numeric"
            value={haveReps}
            onChange={(e) => setHaveReps(e.target.value)}
          />
        </label>
        <label>
          RPE
          <select value={haveRpe} onChange={(e) => setHaveRpe(e.target.value)}>
            <option value="">Sin registrar</option>
            {RPE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="calc-result">
          <span>e1RM</span>
          <span className="numeric calc-result-value">
            {e1rm !== null ? formatKg(e1rm) : '—'}
          </span>
        </div>
      </section>

      <section className="calc-card">
        <h2>Quiero</h2>
        <label>
          Reps
          <input
            type="number"
            inputMode="numeric"
            value={wantReps}
            onChange={(e) => setWantReps(e.target.value)}
          />
        </label>
        <label>
          RPE
          <select value={wantRpe} onChange={(e) => setWantRpe(e.target.value)}>
            <option value="">Elegir RPE</option>
            {RPE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="calc-result">
          <span>Peso</span>
          <span className="numeric calc-result-value">
            {wantWeight !== null ? formatKg(wantWeight) : '—'}
          </span>
        </div>
        {e1rm === null && (
          <p className="empty-hint">Completa "Tengo" primero para calcular el peso.</p>
        )}
        {wantRepsOutOfRange && (
          <p className="empty-hint">Los reps deben ser un número entero entre 1 y 15.</p>
        )}
      </section>
    </div>
  )
}
