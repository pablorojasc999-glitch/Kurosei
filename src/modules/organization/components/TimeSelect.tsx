const HOURS = Array.from({ length: 24 }, (_, h) => h.toString().padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'))

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
  label: string
}

/**
 * A 24-hour hour/minute picker built from two <select>s instead of
 * <input type="time"> — that native control renders 12-hour AM/PM on
 * Android by following the device's system time-format setting, which
 * can't be overridden from the page (the `lang` attribute has no effect
 * on it), so it can't guarantee 24-hour display the way this can.
 */
export function TimeSelect({ value, onChange, label }: TimeSelectProps) {
  const [hour, minute] = value.split(':')
  return (
    <label className="time-select-field">
      {label}
      <div className="time-select">
        <select
          aria-label={`${label} - hora`}
          value={hour}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="time-select-colon">:</span>
        <select
          aria-label={`${label} - minutos`}
          value={minute}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}
