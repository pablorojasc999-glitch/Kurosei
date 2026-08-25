interface YearNavProps {
  year: number
  onChange: (year: number) => void
}

export function YearNav({ year, onChange }: YearNavProps) {
  return (
    <div className="day-nav">
      <button type="button" aria-label="Año anterior" onClick={() => onChange(year - 1)}>
        ‹
      </button>
      <div className="day-nav-label">
        <span className="day-nav-label-line">{year} año</span>
      </div>
      <button type="button" aria-label="Año siguiente" onClick={() => onChange(year + 1)}>
        ›
      </button>
    </div>
  )
}
