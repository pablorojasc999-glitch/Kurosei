import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { db } from '../../../shared/db/database'
import type { Macrocycle } from '../domain/types'
import { buildMacroCalendar, WEEKDAY_LABELS, type CellState } from '../lib/macroCalendar'

interface MacroCalendarProps {
  macrocycle: Macrocycle
  /** Abre el día tocado; null cuando la celda no tiene plan. */
  onOpenDay: (dayId: string) => void
  onOpenMesocycle: (mesocycleId: string) => void
}

/** Un tono por mesociclo, en orden. Se repite si hay más de cinco. */
const MESO_HUES = [332, 68, 168, 262, 28]

function hueOf(index: number): number | null {
  return index < 0 ? null : MESO_HUES[index % MESO_HUES.length]
}

/** El punto de estado: hecho, planificado, o todavía nada. */
function StateDot({ state }: { state: CellState }) {
  return <span className={`macro-dot macro-dot--${state}`} />
}

/**
 * El macrociclo entero de un vistazo: una columna por semana, una fila por día
 * de la semana, y el color de cada columna dado por su mesociclo.
 *
 * Es una rejilla que se desliza en horizontal, con la columna de días fija a la
 * izquierda para no perder de vista qué fila se está mirando.
 */
export function MacroCalendar({ macrocycle, onOpenDay, onOpenMesocycle }: MacroCalendarProps) {
  // Una sola consulta encadenada: mesociclos → semanas → días → sesiones. Por
  // separado haría cuatro renders en cascada y un parpadeo por cada uno.
  const data = useLiveQuery(async () => {
    const mesocycles = await db.training_mesocycles
      .where('macrocycleId')
      .equals(macrocycle.id)
      .filter((m) => m.deletedAt === null)
      .toArray()
    const mesoIds = new Set(mesocycles.map((m) => m.id))
    const weeks = await db.training_weeks
      .filter((w) => w.deletedAt === null && mesoIds.has(w.mesocycleId))
      .toArray()
    const weekIds = new Set(weeks.map((w) => w.id))
    const days = await db.training_days
      .filter((d) => d.deletedAt === null && d.weekId !== null && weekIds.has(d.weekId))
      .toArray()
    const dayIds = new Set(days.map((d) => d.id))
    const sessions = await db.training_sessions
      .filter((s) => s.deletedAt === null && dayIds.has(s.dayId))
      .toArray()
    return { mesocycles, days, sessions }
  }, [macrocycle.id])

  // En un macrociclo largo la semana de hoy queda fuera de pantalla al entrar:
  // se centra sola para no obligar a deslizar hasta encontrarla.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scroller = scrollRef.current
    const now = scroller?.querySelector<HTMLElement>('.macro-week-head--now')
    if (!scroller || !now) return
    scroller.scrollLeft = now.offsetLeft - (scroller.clientWidth - now.offsetWidth) / 2
  }, [data])

  if (!data) {
    return <p className="empty-hint">Cargando el calendario…</p>
  }

  const calendar = buildMacroCalendar({
    macrocycle,
    mesocycles: data.mesocycles,
    days: data.days,
    sessions: data.sessions,
    today: new Date(),
  })

  return (
    <div className="macro-calendar">
      <div className="macro-grid-scroll" ref={scrollRef}>
        <div
          className="macro-grid"
          style={{ gridTemplateColumns: `auto repeat(${calendar.weeks.length}, 52px)` }}
        >
          <div className="macro-corner">sem</div>
          {calendar.weeks.map((week) => (
            <div
              key={week.start}
              className={`macro-week-head${week.containsToday ? ' macro-week-head--now' : ''}`}
              style={hueOf(week.mesocycleIndex) !== null
                ? ({ '--meso-hue': hueOf(week.mesocycleIndex) } as React.CSSProperties)
                : undefined}
            >
              {week.monthLabel && <span className="macro-month">{week.monthLabel}</span>}
              <span className="macro-week-label">
                <StateDot state={week.state} />S{week.number}
              </span>
            </div>
          ))}

          {WEEKDAY_LABELS.map((label, row) => (
            <div key={`row-${label}`} className="macro-row" style={{ gridColumn: 1, gridRow: row + 2 }}>
              {label}
            </div>
          ))}

          {calendar.weeks.map((week, col) =>
            week.cells.map((cell, row) => {
              const hue = hueOf(week.mesocycleIndex)
              const className = [
                'macro-cell',
                cell.outside ? 'macro-cell--outside' : '',
                // El relleno dice a qué mesociclo pertenece el día, no si se
                // entrenó: de eso se encarga el punto. Por eso lo llevan todos
                // los días del bloque y no sólo los que tienen plan.
                hue !== null && !cell.outside ? 'macro-cell--meso' : '',
                cell.isToday ? 'macro-cell--today' : '',
                week.containsToday ? 'macro-cell--in-now' : '',
              ]
                .filter(Boolean)
                .join(' ')
              const content = (
                <>
                  {cell.slot && <span className="macro-slot">{cell.slot}</span>}
                  <span className="macro-date">{cell.dayOfMonth}</span>
                  {cell.state !== 'empty' && <StateDot state={cell.state} />}
                </>
              )
              const style =
                hue !== null ? ({ '--meso-hue': hue } as React.CSSProperties) : undefined
              return cell.dayId ? (
                <button
                  key={cell.date}
                  type="button"
                  className={className}
                  style={{ ...style, gridColumn: col + 2, gridRow: row + 2 }}
                  onClick={() => onOpenDay(cell.dayId as string)}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={cell.date}
                  className={className}
                  style={{ ...style, gridColumn: col + 2, gridRow: row + 2 }}
                >
                  {content}
                </div>
              )
            }),
          )}
        </div>
      </div>

      {calendar.mesocycles.length > 0 && (
        <div className="macro-meso-strip">
          {calendar.mesocycles.map((m) => (
            <button
              key={m.id}
              type="button"
              className="macro-meso-chip"
              style={{ '--meso-hue': hueOf(m.index) } as React.CSSProperties}
              onClick={() => onOpenMesocycle(m.id)}
            >
              <span className="macro-meso-name">
                M{m.index + 1} · {m.name}
              </span>
              <span className="macro-meso-dots">
                {m.weekStates.map((state, i) => (
                  <StateDot key={i} state={state} />
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
