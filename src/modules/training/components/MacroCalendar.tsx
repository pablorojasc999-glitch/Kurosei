import { useCallback, useEffect, useRef } from 'react'
import { useRemoteQuery } from '../../../shared/hooks/useRemoteQuery'
import { listAllSessions } from '../db/executionRepository'
import { listAllDays, listAllWeeks, listMesocycles } from '../db/planningRepository'
import type { Macrocycle } from '../domain/types'
import { buildMacroCalendar, mesoHue, WEEKDAY_LABELS, type CellState } from '../lib/macroCalendar'

interface MacroCalendarProps {
  macrocycle: Macrocycle
  /** Abre el día tocado; null cuando la celda no tiene plan. */
  onOpenDay: (dayId: string) => void
  onOpenMesocycle: (mesocycleId: string) => void
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
  // Una sola consulta encadenada: mesociclos y semanas → días → sesiones. Por
  // separado haría cuatro renders en cascada y un parpadeo por cada uno.
  const { data } = useRemoteQuery(
    useCallback(async () => {
      const [mesocycles, allWeeks] = await Promise.all([listMesocycles(macrocycle.id), listAllWeeks()])
      const mesoIds = new Set(mesocycles.map((m) => m.id))
      // Las semanas sin mesociclo también se ven (sin color): sacarlas haría
      // desaparecer del calendario lo que todavía no se agrupó.
      const weeks = allWeeks.filter((w) => w.mesocycleId === null || mesoIds.has(w.mesocycleId))
      const weekIds = new Set(weeks.map((w) => w.id))
      const days = (await listAllDays()).filter(
        (d) => d.weekId !== null && weekIds.has(d.weekId),
      )
      const dayIds = new Set(days.map((d) => d.id))
      const sessions = (await listAllSessions()).filter((s) => dayIds.has(s.dayId))
      return { mesocycles, weeks, days, sessions }
    }, [macrocycle.id]),
  )

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
    weeks: data.weeks,
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
              style={mesoHue(week.mesocycleIndex) !== null
                ? ({ '--meso-hue': mesoHue(week.mesocycleIndex) } as React.CSSProperties)
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
              // El tono sale del mesociclo del día, no del de la semana: un
              // bloque que empieza o termina a mitad de semana tiene que
              // pintarse desde su primer día y hasta el último, no de lunes a
              // domingo.
              const hue = mesoHue(cell.mesocycleIndex)
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
              style={{ '--meso-hue': mesoHue(m.index) } as React.CSSProperties}
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
